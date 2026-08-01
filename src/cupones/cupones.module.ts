import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cupon } from '../database/entities/cupon.entity';
import { CuponUso } from '../database/entities/cupon-uso.entity';
import { CuponesAdminController } from './admin/cupones-admin.controller';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cupon, CuponUso])],
  controllers: [CuponesController, CuponesAdminController],
  providers: [CuponesService],
  exports: [CuponesService],
})
export class CuponesModule {}
