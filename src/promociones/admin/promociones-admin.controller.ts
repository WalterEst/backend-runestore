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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ActualizarPromocionDto,
  CrearPromocionDto,
} from '../dto/promocion.dto';
import { PromocionesService } from '../promociones.service';

@Controller('admin/promociones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PromocionesAdminController {
  constructor(private readonly promocionesService: PromocionesService) {}

  @Get()
  listar() {
    return this.promocionesService.listarAdmin();
  }

  @Post()
  crear(@Body() dto: CrearPromocionDto) {
    return this.promocionesService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPromocionDto,
  ) {
    return this.promocionesService.actualizar(id, dto);
  }

  @Patch(':id/toggle-activa')
  toggleActiva(@Param('id', ParseIntPipe) id: number) {
    return this.promocionesService.toggleActiva(id);
  }
}
