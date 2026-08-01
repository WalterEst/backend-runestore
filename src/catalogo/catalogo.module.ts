import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from '../database/entities/categoria.entity';
import { HistorialPrecio } from '../database/entities/historial-precio.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';
import { Producto } from '../database/entities/producto.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { Talla } from '../database/entities/talla.entity';
import { R2Service } from '../common/r2/r2.service';
import { CatalogoController } from './catalogo.controller';
import { CatalogoAdminController } from './admin/catalogo-admin.controller';
import { CategoriasService } from './categorias.service';
import { ProductosService } from './productos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      Categoria,
      Talla,
      ProductoVariante,
      ProductoImagen,
      HistorialPrecio,
      MovimientoInventario,
    ]),
  ],
  controllers: [CatalogoController, CatalogoAdminController],
  providers: [ProductosService, CategoriasService, R2Service],
})
export class CatalogoModule {}
