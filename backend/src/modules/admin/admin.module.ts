import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { ContractorsModule } from '../contractors/contractors.module';
import { ProblemsModule } from '../problems/problems.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ContractorsModule, ProblemsModule, BookingsModule, ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
