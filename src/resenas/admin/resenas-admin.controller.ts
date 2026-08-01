import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ResenasService } from '../resenas.service';

/** Moderación previa anti-spam — admin y soporte pueden aprobar/rechazar */
@Controller('admin/resenas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'soporte')
export class ResenasAdminController {
  constructor(private readonly resenasService: ResenasService) {}

  @Get('pendientes')
  listarPendientes() {
    return this.resenasService.listarPendientesAdmin();
  }

  @Patch(':id/aprobar')
  aprobar(@Param('id', ParseIntPipe) id: number) {
    return this.resenasService.moderar(id, true);
  }

  @Patch(':id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number) {
    return this.resenasService.moderar(id, false);
  }
}
