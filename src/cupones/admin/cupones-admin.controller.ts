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
import { ActualizarCuponDto, CrearCuponDto } from '../dto/cupon.dto';
import { CuponesService } from '../cupones.service';

@Controller('admin/cupones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CuponesAdminController {
  constructor(private readonly cuponesService: CuponesService) {}

  @Get()
  listar() {
    return this.cuponesService.listarAdmin();
  }

  @Post()
  crear(@Body() dto: CrearCuponDto) {
    return this.cuponesService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCuponDto,
  ) {
    return this.cuponesService.actualizar(id, dto);
  }
}
