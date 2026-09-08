import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaintenanceService } from './maintenance.service';
import { ALLOW_DURING_MAINTENANCE } from './maintenance.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_MAINTENANCE, [
      context.getHandler(),
      context.getClass(),
    ])) {
      return true;
    }
    if (this.maintenance.isActive()) {
      throw new ServiceUnavailableException({
        code: 'MAINTENANCE_IN_PROGRESS',
        message: 'Service temporarily unavailable during maintenance',
      });
    }
    return true;
  }
}
