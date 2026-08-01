import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import type { EstadoBoleta } from '../database/entities/boleta.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/boletas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BoletasAdminController {
  constructor(
    @InjectRepository(Boleta) private readonly boletas: Repository<Boleta>,
  ) {}

  @Get()
  listar(@Query('estado') estado?: EstadoBoleta) {
    return this.boletas.find({
      where: estado ? { estado } : {},
      order: { id: 'DESC' },
      take: 200,
    });
  }
}
