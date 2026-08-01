import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CrearEnvioDto } from './dto/envio.dto';
import { EnviosService } from './envios.service';

/** Bodeguero gestiona stock y genera envíos/etiquetas; admin tiene el mismo acceso — ver Parte 5.1 */
@Controller('admin/envios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'bodeguero')
export class EnviosController {
  constructor(private readonly enviosService: EnviosService) {}

  @Get()
  listar() {
    return this.enviosService.listar();
  }

  @Post('ordenes/:ordenId')
  crear(
    @Param('ordenId', ParseIntPipe) ordenId: number,
    @Body() dto: CrearEnvioDto,
  ) {
    return this.enviosService.crear(ordenId, dto);
  }

  @Patch(':id/despachar')
  despachar(@Param('id', ParseIntPipe) id: number) {
    return this.enviosService.despachar(id);
  }

  @Patch(':id/entregado')
  marcarEntregado(@Param('id', ParseIntPipe) id: number) {
    return this.enviosService.marcarEntregado(id);
  }
}
