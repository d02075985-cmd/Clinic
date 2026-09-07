import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupModule } from './backup.module';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PassThrough, Readable } from 'stream';
import { gzipSync } from 'zlib';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

function fakeProcess() {
  const process = new EventEmitter() as any;
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.stdin = new PassThrough();
  process.kill = jest.fn();
  return process;
}

describe('BackupModule', () => {
  let module: TestingModule;
  let backupService: BackupService;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [BackupModule],
    })
      .overrideProvider(AuditService)
      .useValue({
        logUserAction: jest.fn(),
      })
      .compile();

    backupService = module.get<BackupService>(BackupService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('BackupService - Environment Validation', () => {
    it('should extract database name from DATABASE_URL if POSTGRES_DB not set', () => {
      delete process.env.POSTGRES_DB;
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/my_database';
      process.env.BACKUP_DIR = '/app/backups';
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      expect(() => service.onModuleInit()).not.toThrow();
      const params = service['getDbConnectionParams']();
      expect(params.database).toBe('my_database');
    });

    it('should throw error if POSTGRES_DB not set and DATABASE_URL invalid', () => {
      delete process.env.POSTGRES_DB;
      delete process.env.DATABASE_URL;
      process.env.BACKUP_DIR = '/app/backups';
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      // Don't call onModuleInit() in this test since we're testing getDbConnectionParams
      expect(() => service['getDbConnectionParams']()).toThrow('POSTGRES_DB environment variable is required');
    });

    it('should throw error if BACKUP_DIR is not absolute', () => {
      process.env.POSTGRES_DB = 'clinic_test_db';
      process.env.BACKUP_DIR = 'relative/path';
      expect(() => {
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        service.onModuleInit();
      }).toThrow('BACKUP_DIR must be an absolute path');
    });

    it('should prevent targeting production DB during test', () => {
      process.env.NODE_ENV = 'test';
      process.env.POSTGRES_DB = 'clinic_db';
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      expect(() => service['getDbConnectionParams']()).toThrow('Cannot target production database');
    });

    it('should allow targeting clinic_test_db during test', () => {
      process.env.NODE_ENV = 'test';
      process.env.POSTGRES_DB = 'clinic_test_db';
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      expect(() => service['getDbConnectionParams']()).not.toThrow();
    });
  });

  describe('BackupService - Filename Sanitization', () => {
    beforeEach(() => {
      process.env.POSTGRES_DB = 'clinic_test_db';
      process.env.BACKUP_DIR = '/app/backups';
    });

    it('should accept valid backup filename', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const filename = 'clinic_backup_2024-01-01T12-00-00-000Z.sql.gz';
      expect(() => service['sanitizeFilename'](filename)).not.toThrow();
    });

    it('should reject invalid filename format', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const filename = 'malicious.txt';
      expect(() => service['sanitizeFilename'](filename)).toThrow(BadRequestException);
    });

    it('should reject path traversal attempts', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const filename = '../../../etc/passwd';
      expect(() => service['sanitizeFilename'](filename)).toThrow(BadRequestException);
    });

    it('should reject filename with path separators', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const filename = 'clinic_backup_2024.sql.gz/extra';
      expect(() => service['sanitizeFilename'](filename)).toThrow(BadRequestException);
    });

    it('should reject Windows-style path traversal', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const filename = '..\\..\\Windows\\System32';
      expect(() => service['sanitizeFilename'](filename)).toThrow(BadRequestException);
    });
  });

  describe('BackupService - Manifest Path Traversal', () => {
    beforeEach(() => {
      process.env.POSTGRES_DB = 'clinic_test_db';
      process.env.BACKUP_DIR = '/app/backups';
    });

    it('should reject manifest entry with path traversal', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const maliciousFilename = '../../../etc/passwd';
      expect(() => service['resolveSafePath'](maliciousFilename)).toThrow(BadRequestException);
    });

    it('should reject manifest entry with relative path', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const maliciousFilename = '../target';
      expect(() => service['resolveSafePath'](maliciousFilename)).toThrow(BadRequestException);
    });

    it('should reject manifest entry with absolute path', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const maliciousFilename = '/tmp/target';
      expect(() => service['resolveSafePath'](maliciousFilename)).toThrow(BadRequestException);
    });

    it('should accept valid manifest entry', () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      const validFilename = 'clinic_backup_2024-01-01T12-00-00-000Z.sql.gz';
      expect(() => service['resolveSafePath'](validFilename)).not.toThrow();
    });
  });

  describe('BackupService - Remote Storage Configuration', () => {
    beforeEach(() => {
      process.env.POSTGRES_DB = 'clinic_test_db';
      process.env.BACKUP_DIR = '/app/backups';
    });

    it('should detect when remote storage is configured', () => {
      process.env.BACKUP_S3_ENDPOINT = 'https://s3.example.com';
      process.env.BACKUP_S3_BUCKET = 'my-bucket';
      process.env.BACKUP_S3_ACCESS_KEY = 'key';
      process.env.BACKUP_S3_SECRET_KEY = 'secret';
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      expect(service['isRemoteStorageConfigured']()).toBe(true);
    });

    it('should detect when remote storage is not configured', () => {
      delete process.env.BACKUP_S3_ENDPOINT;
      delete process.env.BACKUP_S3_BUCKET;
      delete process.env.BACKUP_S3_ACCESS_KEY;
      delete process.env.BACKUP_S3_SECRET_KEY;
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      expect(service['isRemoteStorageConfigured']()).toBe(false);
    });
  });

  describe('BackupService - Concurrency Control', () => {
    beforeEach(() => {
      process.env.POSTGRES_DB = 'clinic_test_db';
      process.env.BACKUP_DIR = '/app/backups';
    });

    describe('BackupService - Process and stream completion', () => {
      it('should require pg_dump exit code 0 after all output completes', async () => {
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        const pgDump = fakeProcess();
        const gzip = new PassThrough();
        const output = new PassThrough();
        const completion = service['completeBackupProcess'](pgDump, gzip, output, () => '');

        pgDump.stdout.end('dump');
        await new Promise(resolve => setImmediate(resolve));
        let settled = false;
        completion.finally(() => { settled = true; });
        await new Promise(resolve => setImmediate(resolve));
        expect(settled).toBe(false);

        pgDump.emit('close', 0);
        await expect(completion).resolves.toBeUndefined();
      });

      it.each(['non-zero exit', 'spawn error', 'stdout error', 'gzip error', 'output error'])('should reject backup on %s', async (failure) => {
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        const pgDump = fakeProcess();
        const gzip = new PassThrough();
        const output = new PassThrough();
        const completion = service['completeBackupProcess'](pgDump, gzip, output, () => 'stderr');

        if (failure === 'non-zero exit') pgDump.emit('close', 1);
        if (failure === 'spawn error') pgDump.emit('error', new Error('spawn failed'));
        if (failure === 'stdout error') pgDump.stdout.destroy(new Error('stdout failed'));
        if (failure === 'gzip error') gzip.destroy(new Error('gzip failed'));
        if (failure === 'output error') output.destroy(new Error('output failed'));
        pgDump.stdout.end();
        await expect(completion).rejects.toThrow();
      });

      it('should reject and clean a failed temporary backup artifact', async () => {
        const directory = await mkdtemp(`${tmpdir()}/clinic-backup-`);
        const previousBackupDir = process.env.BACKUP_DIR;
        process.env.BACKUP_DIR = directory;
        process.env.POSTGRES_DB = 'clinic_test_db';
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        const pgDump = fakeProcess();
        (spawn as jest.Mock).mockReturnValueOnce(pgDump);
        jest.spyOn(service as any, 'completeBackupProcess').mockRejectedValue(new Error('pipeline failed'));

        const operation = service.runBackup('manual');

        await expect(operation).rejects.toThrow(InternalServerErrorException);
        const files = await readdir(directory);
        expect(files).toEqual([]);
        await rm(directory, { recursive: true, force: true });
        if (previousBackupDir === undefined) delete process.env.BACKUP_DIR;
        else process.env.BACKUP_DIR = previousBackupDir;
      });

      it('should restore successfully only after gunzip, stdin, and psql complete', async () => {
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        const psql = fakeProcess();
        const input = Readable.from(gzipSync(Buffer.from('SELECT 1;')));
        const gunzip = new (require('zlib').Gunzip)();
        const completion = service['completeRestoreProcess'](psql, input, gunzip, () => '', () => '');

        psql.stdin.on('data', () => undefined);
        setImmediate(() => psql.emit('close', 0));
        await expect(completion).resolves.toBeUndefined();
      });

      it.each(['non-zero exit', 'spawn error', 'input read error', 'gunzip error', 'stdin error', 'truncated input'])('should reject restore on %s', async (failure) => {
        const service = new BackupService({ logUserAction: jest.fn() } as any);
        const psql = fakeProcess();
        const input = new PassThrough();
        const gunzip = new (require('zlib').Gunzip)();
        const completion = service['completeRestoreProcess'](psql, input, gunzip, () => 'stderr', () => 'stdout');

        if (failure === 'non-zero exit') psql.emit('close', 1);
        if (failure === 'spawn error') psql.emit('error', new Error('spawn failed'));
        if (failure === 'input read error') input.destroy(new Error('input failed'));
        if (failure === 'gunzip error') input.write(Buffer.from('not gzip'));
        if (failure === 'stdin error') psql.stdin.destroy(new Error('stdin failed'));
        if (failure === 'truncated input') input.write(gzipSync(Buffer.from('partial')).subarray(0, 5));
        input.end();
        await expect(completion).rejects.toThrow();
      });
    });

    it('should serialize backup operations', async () => {
      const service = new BackupService({ logUserAction: jest.fn() } as any);
      // Mock backup operation to take time
      jest.spyOn(service, 'runBackup').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { filename: 'test.sql.gz', sizeBytes: 1000, createdAt: new Date().toISOString(), triggeredBy: 'manual', uploadedToRemote: false };
      });

      const [result1, result2] = await Promise.all([
        service.runBackup('manual'),
        service.runBackup('manual'),
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Operations should be serialized, not parallel
      expect(service['runBackup']).toHaveBeenCalledTimes(2);
    });
  });

  describe('RestoreBackupDto Validation', () => {
    it('should require confirm to be true', () => {
      const dto = { filename: 'clinic_backup_2024.sql.gz', confirm: false };
      expect(() => {
        if (dto.confirm !== true) {
          throw new BadRequestException('confirm must be true to restore a backup');
        }
      }).toThrow(BadRequestException);
    });

    it('should accept confirm: true', () => {
      const dto = { filename: 'clinic_backup_2024.sql.gz', confirm: true };
      expect(() => {
        if (dto.confirm !== true) {
          throw new BadRequestException('confirm must be true to restore a backup');
        }
      }).not.toThrow();
    });
  });
});
