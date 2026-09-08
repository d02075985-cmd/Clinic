import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { AuditModule } from '../audit/audit.module';
import { MaintenanceModule } from '../common/maintenance/maintenance.module';

@Module({
  imports: [AuditModule, MaintenanceModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService], // needed so NotificationsModule can inject it
})
export class BackupModule {}
