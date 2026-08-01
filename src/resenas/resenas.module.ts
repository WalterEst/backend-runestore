import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Resena } from '../database/entities/resena.entity';
import { ResenasAdminController } from './admin/resenas-admin.controller';
import { ResenasController } from './resenas.controller';
import { ResenasService } from './resenas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resena, Orden, OrdenItem])],
  controllers: [ResenasController, ResenasAdminController],
  providers: [ResenasService],
})
export class ResenasModule {}
