import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EmitirGiftcardDto } from '../dto/giftcard.dto';
import { GiftcardsService } from '../giftcards.service';

/** Emisión manual (soporte/regalo) — la venta de giftcards como producto del catálogo queda para una fase posterior */
@Controller('admin/giftcards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class GiftcardsAdminController {
  constructor(private readonly giftcardsService: GiftcardsService) {}

  @Get()
  listar() {
    return this.giftcardsService.listarAdmin();
  }

  @Post()
  emitir(@Body() dto: EmitirGiftcardDto) {
    return this.giftcardsService.emitir(dto);
  }
}
