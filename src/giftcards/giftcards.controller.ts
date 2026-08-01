import { Controller, Get, Param } from '@nestjs/common';
import { GiftcardsService } from './giftcards.service';

@Controller('giftcards')
export class GiftcardsController {
  constructor(private readonly giftcardsService: GiftcardsService) {}

  @Get(':codigo/saldo')
  consultarSaldo(@Param('codigo') codigo: string) {
    return this.giftcardsService.consultarSaldo(codigo);
  }
}
