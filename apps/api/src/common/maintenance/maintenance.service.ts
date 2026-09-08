import { Injectable } from '@nestjs/common';

@Injectable()
export class MaintenanceService {
  private active = false;
  private reason?: string;

  enter(reason: string): void {
    if (this.active) {
      throw new Error('Maintenance mode is already active');
    }
    this.active = true;
    this.reason = reason;
  }

  leave(): void {
    this.active = false;
    this.reason = undefined;
  }

  isActive(): boolean {
    return this.active;
  }

  getStatus(): { active: boolean; reason?: string } {
    return { active: this.active, ...(this.reason ? { reason: this.reason } : {}) };
  }
}
