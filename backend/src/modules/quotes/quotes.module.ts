import { Module } from '@nestjs/common';
import { ContractorsModule } from '../contractors/contractors.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({ imports: [ContractorsModule, NotificationsModule], controllers: [QuotesController], providers: [QuotesService], exports: [QuotesService] })
export class QuotesModule {}
