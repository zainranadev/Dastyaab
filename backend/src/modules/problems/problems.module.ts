import { Module } from '@nestjs/common';
import { ContractorsModule } from '../contractors/contractors.module';
import { MediaModule } from '../media/media.module';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  imports: [ContractorsModule, MediaModule],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
