import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promocion } from '../database/entities/promocion.entity';
import { PromocionesAdminController } from './admin/promociones-admin.controller';
import { PromocionesService } from './promociones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion])],
  controllers: [PromocionesAdminController],
  providers: [PromocionesService],
  exports: [PromocionesService],
})
export class PromocionesModule {}
