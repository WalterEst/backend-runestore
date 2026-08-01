import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { ProductosService } from './productos.service';
import { QueryCatalogoDto } from './dto/producto.dto';

/** Endpoints públicos de solo lectura: catálogo, búsqueda y detalle de producto */
@Controller('catalogo')
export class CatalogoController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly categoriasService: CategoriasService,
  ) {}

  @Get('productos')
  listarProductos(@Query() query: QueryCatalogoDto) {
    return this.productosService.listadoPublico(query);
  }

  @Get('productos/:slug')
  obtenerProducto(@Param('slug') slug: string) {
    return this.productosService.detallePublico(slug);
  }

  @Get('categorias')
  listarCategorias() {
    return this.categoriasService.listarPublico();
  }
}
