import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService } from './maintenance.service';

@Global()
@Module({
  providers: [
    MaintenanceService,
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
