import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrito } from '../database/entities/carrito.entity';
import { CarritoItem } from '../database/entities/carrito-item.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { CarritoController } from './carrito.controller';
import { CarritoService } from './carrito.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Carrito,
      CarritoItem,
      ProductoVariante,
      ProductoImagen,
    ]),
  ],
  controllers: [CarritoController],
  providers: [CarritoService],
  exports: [CarritoService],
})
export class CarritoModule {}
