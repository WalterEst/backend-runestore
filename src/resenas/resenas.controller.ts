import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { CrearResenaDto } from './dto/resena.dto';
import { ResenasService } from './resenas.service';

@Controller()
export class ResenasController {
  constructor(private readonly resenasService: ResenasService) {}

  @Get('catalogo/productos/:productoId/resenas')
  listarPublicas(@Param('productoId', ParseIntPipe) productoId: number) {
    return this.resenasService.listarPublicas(productoId);
  }

  @Post('resenas')
  @UseGuards(JwtAuthGuard)
  crear(@UsuarioActual() usuario: JwtPayload, @Body() dto: CrearResenaDto) {
    return this.resenasService.crear(usuario.sub, dto);
  }
}
