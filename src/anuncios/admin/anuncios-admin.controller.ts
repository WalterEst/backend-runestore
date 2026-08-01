import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CrearAnuncioDto } from '../dto/anuncio.dto';
import { AnunciosService } from '../anuncios.service';

@Controller('admin/anuncios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AnunciosAdminController {
  constructor(private readonly anunciosService: AnunciosService) {}

  @Get()
  listar() {
    return this.anunciosService.listarAdmin();
  }

  @Post()
  crear(@Body() dto: CrearAnuncioDto) {
    return this.anunciosService.crear(dto);
  }

  @Patch(':id/toggle-activo')
  toggleActivo(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.toggleActivo(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.anunciosService.eliminar(id);
  }
}
