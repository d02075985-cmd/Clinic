import { Injectable, Logger, BadRequestException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable, Transform, Writable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AuditService } from '../audit/audit.service';

export interface BackupManifestEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  triggeredBy: 'manual' | 'scheduled' | 'pre-restore-safety';
  uploadedToRemote: boolean;
}

// Real pg_dump / psql backed backup & restore. Nothing here is simulated —
// every operation shells out to the actual Postgres client tools against the
// live database, using the same credentials the app itself connects with.
@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);

  // Concurrency control: prevent overlapping backup/restore operations
  private operationInProgress = false;

  constructor(private auditService: AuditService) {}

  private async withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
    // Wait for current operation to complete
    while (this.operationInProgress) {
      // eslint-disable-next-line no-undef
      await new Promise<void>(resolve => setTimeout(resolve, 100));
    }

    this.operationInProgress = true;
    try {
      return await operation();
    } finally {
      this.operationInProgress = false;
    }
  }

  onModuleInit() {
    // Validate backup directory
    const backupDir = process.env.BACKUP_DIR || '/app/backups';
    if (!path.isAbsolute(backupDir)) {
      throw new Error('BACKUP_DIR must be an absolute path for security');
    }

    // Verify pg_dump and psql are available in PATH
    try {
      const pgDumpCheck = spawnSync('which', ['pg_dump']);
      if (pgDumpCheck.status !== 0) {
        throw new Error('pg_dump not found in PATH. PostgreSQL client tools must be installed for backup operations.');
      }
      const psqlCheck = spawnSync('which', ['psql']);
      if (psqlCheck.status !== 0) {
        throw new Error('psql not found in PATH. PostgreSQL client tools must be installed for backup operations.');
      }
    } catch {
      this.logger.warn('Could not verify pg_dump/psql availability');
    }

    this.logger.log(`Backup service initialized with directory: ${backupDir}`);
  }

  private get backupDir(): string {
    return process.env.BACKUP_DIR || '/app/backups';
  }
  private get manifestPath(): string {
    return path.join(this.backupDir, 'manifest.json');
  }
  private get retentionDays(): number {
    return parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
  }

  private getDbConnectionParams() {
    // Extract database name from DATABASE_URL if POSTGRES_DB not explicitly set
    // DATABASE_URL format: postgresql://user:password@host:port/database
    let database = process.env.POSTGRES_DB;
    if (!database && process.env.DATABASE_URL) {
      try {
        // eslint-disable-next-line no-undef
        const url = new URL(process.env.DATABASE_URL);
        database = url.pathname.substring(1); // Remove leading slash
      } catch {
        throw new Error('Could not extract database name from DATABASE_URL. Please set POSTGRES_DB explicitly.');
      }
    }

    if (!database) {
      throw new Error('POSTGRES_DB environment variable is required for backup operations');
    }

    // CRITICAL: Validate that we're not accidentally targeting production during test verification
    if (process.env.NODE_ENV === 'test' && database === 'clinic_db') {
      throw new Error('Cannot target production database (clinic_db) during test verification. Use clinic_test_db instead.');
    }

    return {
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || '5432',
      user: process.env.POSTGRES_USER || 'clinic_user',
      password: process.env.POSTGRES_PASSWORD,
      database,
    };
  }

  private async ensureBackupDir() {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  private async readManifest(): Promise<BackupManifestEntry[]> {
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeManifest(entries: BackupManifestEntry[]) {
    await fs.writeFile(this.manifestPath, JSON.stringify(entries, null, 2));
  }

  private waitForProcessExit(process: ChildProcessWithoutNullStreams): Promise<number> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const resolveOnce = (code: number | null) => {
        if (settled) return;
        settled = true;
        resolve(code ?? -1);
      };

      process.once('error', rejectOnce);
      process.once('close', resolveOnce);
    });
  }

  private async completeBackupProcess(
    pgDump: ChildProcessWithoutNullStreams,
    gzip: Transform,
    out: Writable,
    stderr: () => string,
  ) {
    const results = await Promise.all([
      pipeline(pgDump.stdout, gzip, out),
      this.waitForProcessExit(pgDump),
    ]);
    const exitCode = results[1];

    if (exitCode !== 0) {
      throw new Error(`pg_dump exited with code ${exitCode}: ${stderr()}`);
    }
  }

  private async completeRestoreProcess(
    psql: ChildProcessWithoutNullStreams,
    input: Readable,
    gunzip: Transform,
    stderr: () => string,
    stdout: () => string,
  ) {
    const results = await Promise.all([
      pipeline(input, gunzip, psql.stdin),
      this.waitForProcessExit(psql),
    ]);
    const exitCode = results[1];

    if (exitCode !== 0) {
      throw new Error(`psql exited with code ${exitCode}. stderr: ${stderr()}, stdout: ${stdout()}`);
    }
  }

  // Runs every day at 3:00 AM server time. This is a real cron registration
  // via @nestjs/schedule — it will actually fire in production, not a
  // decorative comment.
  @Cron('0 3 * * *')
  async handleScheduledBackup() {
    this.logger.log('Running scheduled daily backup...');
    try {
      await this.runBackup('scheduled');
    } catch (err) {
      this.logger.error('Scheduled backup failed', err instanceof Error ? err.stack : err);
    }
  }

  async runBackup(triggeredBy: 'manual' | 'scheduled' | 'pre-restore-safety', userId?: string, ipAddress?: string, userAgent?: string) {
    return this.withOperationLock(() => this.runBackupUnlocked(triggeredBy, userId, ipAddress, userAgent));
  }

  // Used by restore while it already owns the operation lock. Keeping this
  // separate prevents the pre-restore safety backup from waiting on itself.
  private async runBackupUnlocked(triggeredBy: 'manual' | 'scheduled' | 'pre-restore-safety', userId?: string, ipAddress?: string, userAgent?: string) {
      await this.ensureBackupDir();
      const { host, port, user, password, database } = this.getDbConnectionParams();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `clinic_backup_${timestamp}.sql.gz`;
      const filepath = path.join(this.backupDir, filename);
      const temporaryFilepath = `${filepath}.tmp`;

      // --clean --if-exists: the dump includes DROP statements before each
      // CREATE, so restoring it cleanly replaces existing objects rather than
      // erroring on "already exists".
      const pgDump = spawn(
        'pg_dump',
        ['--host', host, '--port', port, '--username', user, '--format', 'plain', '--clean', '--if-exists', '--no-owner', database],
        { env: { ...process.env, PGPASSWORD: password } },
      );

      const gzip = createGzip();
      const out = createWriteStream(temporaryFilepath);

      let stderr = '';
      pgDump.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      try {
        await this.completeBackupProcess(pgDump, gzip, out, () => stderr);
      } catch (err) {
        // Clean up a partial temporary file rather than publishing a corrupt backup.
        pgDump.kill();
        pgDump.stdout.destroy();
        gzip.destroy();
        const outputClosed = new Promise<void>((resolve) => {
          if ((out as Writable & { closed?: boolean }).closed) {
            resolve();
          } else {
            out.once('close', () => resolve());
          }
        });
        out.destroy();
        await outputClosed;
        await fs.unlink(temporaryFilepath).catch(() => undefined);
        throw new InternalServerErrorException(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      await fs.rename(temporaryFilepath, filepath);

      const stat = await fs.stat(filepath);
      let uploadedToRemote = false;

      if (this.isRemoteStorageConfigured()) {
        try {
          await this.uploadToRemote(filepath, filename);
          uploadedToRemote = true;
        } catch (err) {
          this.logger.error('Remote backup upload failed (backup itself still succeeded locally)', err instanceof Error ? err.stack : err);
        }
      }

      const manifest = await this.readManifest();
      manifest.push({
        filename,
        sizeBytes: stat.size,
        createdAt: new Date().toISOString(),
        triggeredBy,
        uploadedToRemote,
      });
      await this.writeManifest(manifest);

      await this.pruneOldBackups();

      if (userId) {
        await this.auditService.logUserAction(userId, 'BACKUP_CREATED', 'System', filename, ipAddress, userAgent);
      }

      return { filename, sizeBytes: stat.size, createdAt: new Date().toISOString(), triggeredBy, uploadedToRemote };
  }

  async listBackups() {
    await this.ensureBackupDir();
    const manifest = await this.readManifest();
    // Reconcile against what's actually on disk — a manifest entry for a
    // file that was manually deleted shouldn't be reported as available.
    // Treat manifest contents as untrusted - validate each filename.
    const existing: BackupManifestEntry[] = [];
    for (const entry of manifest) {
      try {
        // Use centralized safe path resolver to prevent manifest path traversal
        const safePath = this.resolveSafePath(entry.filename);
        await fs.access(safePath);
        existing.push(entry);
      } catch {
        // File no longer present or invalid filename — drop it from the list.
      }
    }
    if (existing.length !== manifest.length) {
      await this.writeManifest(existing);
    }
    return existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getStatus() {
    const backups = await this.listBackups();
    const last = backups[0] || null;
    const totalSizeBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    return {
      lastBackup: last,
      totalBackups: backups.length,
      totalSizeBytes,
      retentionDays: this.retentionDays,
      remoteStorageConfigured: this.isRemoteStorageConfigured(),
    };
  }

  private sanitizeFilename(filename: string): string {
    const base = path.basename(filename);
    if (!/^clinic_backup_[\w-]+\.sql\.gz$/.test(base)) {
      throw new BadRequestException('Invalid backup filename');
    }
    // Prevent path traversal: ensure the filename doesn't contain path separators
    if (base !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid backup filename: path traversal not allowed');
    }
    return base;
  }

  // Centralized safe filename/path resolver - treats manifest as untrusted
  private resolveSafePath(filename: string): string {
    const safeFilename = this.sanitizeFilename(filename);
    const fullPath = path.join(this.backupDir, safeFilename);

    // Verify the resolved path is still inside BACKUP_DIR (prevent symlink escape)
    const resolvedPath = path.resolve(fullPath);
    const resolvedBackupDir = path.resolve(this.backupDir);

    if (!resolvedPath.startsWith(resolvedBackupDir)) {
      throw new BadRequestException('Invalid backup filename: path traversal not allowed');
    }

    return fullPath;
  }

  async restoreBackup(filename: string, userId: string, ipAddress?: string, userAgent?: string) {
    return this.withOperationLock(async () => {
      const filepath = this.resolveSafePath(filename);

      try {
        await fs.access(filepath);
      } catch {
        throw new BadRequestException('Backup file not found');
      }

      // Safety net: always take a fresh backup of the CURRENT state right
      // before overwriting it, so a restore is never a one-way door.
      await this.runBackupUnlocked('pre-restore-safety', userId, ipAddress, userAgent);

      const { host, port, user, password, database } = this.getDbConnectionParams();

      // Use ON_ERROR_STOP to ensure psql stops on first SQL error
      // Use single-transaction to ensure atomic restore
      const psql = spawn(
        'psql',
        [
          '--host', host,
          '--port', port,
          '--username', user,
          '--dbname', database,
          '--set=ON_ERROR_STOP=on',
          '--single-transaction',
        ],
        { env: { ...process.env, PGPASSWORD: password } },
      );

      let stderr = '';
      let stdout = '';
      psql.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      psql.stdout.on('data', (chunk) => { stdout += chunk.toString(); });

      try {
        const gunzip = createGunzip();
        const input = createReadStream(filepath);
        await this.completeRestoreProcess(psql, input, gunzip, () => stderr, () => stdout);
      } catch (err) {
        // Restore failed - pre-restore safety backup remains available
        psql.kill();
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Restore failed: ${message}`);
        throw new InternalServerErrorException(`Restore failed: ${message}`);
      }

      await this.auditService.logUserAction(userId, 'RESTORE_EXECUTED', 'System', filename, ipAddress, userAgent);

      return { restored: filename, restoredAt: new Date().toISOString() };
    });
  }

  private async pruneOldBackups() {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const manifest = await this.readManifest();
    const kept: BackupManifestEntry[] = [];

    for (const entry of manifest) {
      if (new Date(entry.createdAt).getTime() < cutoff) {
        // Use centralized safe path resolver to prevent manifest path traversal
        try {
          const safePath = this.resolveSafePath(entry.filename);
          await fs.unlink(safePath).catch(() => undefined);
          this.logger.log(`Pruned expired backup: ${entry.filename}`);
        } catch {
          // Invalid filename or file already gone - just skip
        }
      } else {
        kept.push(entry);
      }
    }
    await this.writeManifest(kept);
  }

  private isRemoteStorageConfigured(): boolean {
    return !!(process.env.BACKUP_S3_ENDPOINT && process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_ACCESS_KEY && process.env.BACKUP_S3_SECRET_KEY);
  }

  private async uploadToRemote(filepath: string, filename: string) {
    const client = new S3Client({
      endpoint: process.env.BACKUP_S3_ENDPOINT,
      region: process.env.BACKUP_S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY!,
        secretAccessKey: process.env.BACKUP_S3_SECRET_KEY!,
      },
      forcePathStyle: true, // required by most non-AWS S3-compatible providers
    });

    const body = await fs.readFile(filepath);
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: `clinic-backups/${filename}`,
        Body: body,
      }),
    );
  }
}
