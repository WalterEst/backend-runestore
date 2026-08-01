import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthOpcionalGuard } from '../auth/guards/jwt-auth-opcional.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { ValidarCuponDto } from './dto/cupon.dto';
import { CuponesService } from './cupones.service';

@Controller('cupones')
export class CuponesController {
  constructor(private readonly cuponesService: CuponesService) {}

  @Post('validar')
  @UseGuards(JwtAuthOpcionalGuard)
  validar(
    @Body() dto: ValidarCuponDto,
    @UsuarioActual() usuario: JwtPayload | undefined,
  ) {
    return this.cuponesService.previsualizar(
      dto.codigo,
      dto.subtotal,
      usuario?.sub,
    );
  }
}
