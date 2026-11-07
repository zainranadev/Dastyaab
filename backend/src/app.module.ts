import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { StatusModule } from './common/status/status.service';
import { validateEnv } from './config/env';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChatModule } from './modules/chat/chat.module';
import { ContractorsModule } from './modules/contractors/contractors.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tests prefer .env.test so they can never hit the dev database by accident.
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    // Global default; auth routes are stricter. Skipped in tests so e2e runs are not throttled.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120, skipIf: () => process.env.NODE_ENV === 'test' }]),
    PrismaModule,
    StatusModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ContractorsModule,
    MediaModule,
    ProblemsModule,
    QuotesModule,
    BookingsModule,
    ReviewsModule,
    NotificationsModule,
    ChatModule,
    AdminModule,
  ],
  providers: [
    // Order matters: throttle -> authenticate -> authorize by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
