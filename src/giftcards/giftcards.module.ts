import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Giftcard } from '../database/entities/giftcard.entity';
import { GiftcardMovimiento } from '../database/entities/giftcard-movimiento.entity';
import { GiftcardsAdminController } from './admin/giftcards-admin.controller';
import { GiftcardsController } from './giftcards.controller';
import { GiftcardsService } from './giftcards.service';

@Module({
  imports: [TypeOrmModule.forFeature([Giftcard, GiftcardMovimiento])],
  controllers: [GiftcardsController, GiftcardsAdminController],
  providers: [GiftcardsService],
  exports: [GiftcardsService],
})
export class GiftcardsModule {}
