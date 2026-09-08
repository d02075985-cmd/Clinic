import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HealthController } from '../../health/health.controller';
import { AllowDuringMaintenance } from './maintenance.decorator';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService } from './maintenance.service';

describe('Maintenance mode', () => {
  let service: MaintenanceService;
  let guard: MaintenanceGuard;
  let reflector: Reflector;

  beforeEach(() => {
    service = new MaintenanceService();
    reflector = new Reflector();
    guard = new MaintenanceGuard(service, reflector);
  });

  function context(handler: (...args: any[]) => any = () => true, target: any = class TestController {}): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => target,
    } as unknown as ExecutionContext;
  }

  it('rejects normal requests with a stable maintenance error', () => {
    service.enter('restore');
    expect(() => guard.canActivate(context())).toThrow(expect.objectContaining({
      response: expect.objectContaining({ code: 'MAINTENANCE_IN_PROGRESS' }),
    }));
  });

  it('allows the health endpoint while maintenance is active', async () => {
    service.enter('restore');
    const healthHandler = HealthController.prototype.check;
    AllowDuringMaintenance()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check')!);
    expect(guard.canActivate(context(healthHandler, HealthController))).toBe(true);
    await expect(new HealthController({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any).check()).resolves.toMatchObject({ status: 'healthy' });
  });

  it('clears maintenance after a handled operation failure', () => {
    service.enter('restore');
    service.leave();
    expect(service.isActive()).toBe(false);
  });

  it('can remain active when rollback safety cannot be established', () => {
    service.enter('restore');
    expect(service.isActive()).toBe(true);
    expect(service.getStatus()).toEqual({ active: true, reason: 'restore' });
  });
});
