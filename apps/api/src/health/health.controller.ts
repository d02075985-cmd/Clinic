import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AllowDuringMaintenance } from '../common/maintenance/maintenance.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @AllowDuringMaintenance()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        success: true,
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
