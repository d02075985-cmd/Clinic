import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { VisitsModule } from './visits/visits.module';
import { ServicesModule } from './services/services.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        const requiredEnvVars = [
          'NODE_ENV',
          'PORT',
          'DATABASE_URL',
          'JWT_SECRET',
          'JWT_REFRESH_SECRET',
        ];

        // FRONTEND_URL is required in production to prevent CORS fallback to localhost
        if (config.NODE_ENV === 'production') {
          requiredEnvVars.push('FRONTEND_URL');
        }

        const missingEnvVars = requiredEnvVars.filter((envVar) => !config[envVar]);

        if (missingEnvVars.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missingEnvVars.join(', ')}`,
          );
        }

        return {
          ...config,
          NODE_ENV: config.NODE_ENV,
          PORT: parseInt(config.PORT, 10),
          DATABASE_URL: config.DATABASE_URL,
          JWT_SECRET: config.JWT_SECRET,
          JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET,
          FRONTEND_URL: config.FRONTEND_URL,
        };
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    VisitsModule,
    ServicesModule,
    InvoicesModule,
    PaymentsModule,
    ReportsModule,
    BackupModule,
  ],
})
export class AppModule {}
