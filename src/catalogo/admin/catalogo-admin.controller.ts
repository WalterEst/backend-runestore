import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/types';
import { R2Service } from '../../common/r2/r2.service';
import { CategoriasService } from '../categorias.service';
import { ProductosService } from '../productos.service';
import {
  ActualizarCategoriaDto,
  CrearCategoriaDto,
} from '../dto/categoria.dto';
import {
  ActualizarCostoDto,
  ActualizarPrecioDto,
  ActualizarProductoDto,
  ActualizarVarianteDto,
  AjustarStockDto,
  CrearProductoDto,
  CrearTallaDto,
  CrearVarianteDto,
  QueryInventarioDto,
  RegistrarImagenDto,
} from '../dto/producto.dto';
import { PresignedUrlDto } from '../dto/presigned-url.dto';

/** CRUD de catálogo — solo admin. Ver Parte 5.1 del documento maestro: bodeguero/soporte no editan productos/precios. */
@Controller('admin/catalogo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CatalogoAdminController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly categoriasService: CategoriasService,
    private readonly r2Service: R2Service,
  ) {}

  @Get('productos')
  listarProductos(@Query() query: QueryInventarioDto) {
    return this.productosService.listarAdmin(query);
  }

  @Get('inventario/exportar')
  @Roles('admin', 'bodeguero')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="inventario-rune.xlsx"')
  async exportarInventario(
    @Query() query: QueryInventarioDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const workbook = await this.productosService.exportarExcel(query);
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  }

  @Get('productos/:id')
  obtenerProducto(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.obtenerAdmin(id);
  }

  @Post('productos')
  crearProducto(@Body() dto: CrearProductoDto) {
    return this.productosService.crear(dto);
  }

  @Patch('productos/:id')
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.productosService.actualizar(id, dto);
  }

  @Patch('productos/:id/precio')
  actualizarPrecio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPrecioDto,
    @UsuarioActual() usuario: JwtPayload,
  ) {
    return this.productosService.actualizarPrecio(id, dto, usuario.sub);
  }

  @Patch('productos/:id/costo')
  actualizarCosto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCostoDto,
  ) {
    return this.productosService.actualizarCosto(id, dto);
  }

  @Delete('productos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarProducto(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.productosService.eliminar(id);
  }

  @Get('productos/:id/variantes')
  listarVariantes(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.listarVariantes(id);
  }

  @Post('productos/:id/variantes')
  crearVariante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearVarianteDto,
  ) {
    return this.productosService.crearVariante(id, dto);
  }

  @Patch('variantes/:varianteId')
  actualizarVariante(
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @Body() dto: ActualizarVarianteDto,
  ) {
    return this.productosService.actualizarVariante(varianteId, dto);
  }

  /** Bodeguero también gestiona stock/movimientos — ver Parte 5.1 del documento maestro */
  @Post('variantes/:varianteId/ajustar-stock')
  @Roles('admin', 'bodeguero')
  ajustarStock(
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @Body() dto: AjustarStockDto,
    @UsuarioActual() usuario: JwtPayload,
  ) {
    return this.productosService.ajustarStock(varianteId, dto, usuario.sub);
  }

  @Get('movimientos')
  @Roles('admin', 'bodeguero')
  listarMovimientos() {
    return this.productosService.listarMovimientos();
  }

  @Post('productos/:id/imagenes/presigned-url')
  generarPresignedUrl(
    @Param('id', ParseIntPipe) _id: number,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.r2Service.generarUrlSubida(dto.mimeType, 'productos');
  }

  @Post('productos/:id/imagenes')
  registrarImagen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarImagenDto,
  ) {
    return this.productosService.registrarImagen(id, dto);
  }

  @Delete('productos/:id/imagenes/:imagenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarImagen(
    @Param('id', ParseIntPipe) _id: number,
    @Param('imagenId', ParseIntPipe) imagenId: number,
  ): Promise<void> {
    await this.productosService.eliminarImagen(imagenId);
  }

  @Get('tallas')
  listarTallas() {
    return this.productosService.listarTallas();
  }

  @Post('tallas')
  crearTalla(@Body() dto: CrearTallaDto) {
    return this.productosService.crearTalla(dto);
  }

  @Get('variantes')
  @Roles('admin', 'bodeguero')
  listarTodasLasVariantes() {
    return this.productosService.listarTodasLasVariantes();
  }

  @Get('categorias')
  listarCategorias() {
    return this.categoriasService.listarAdmin();
  }

  @Post('categorias')
  crearCategoria(@Body() dto: CrearCategoriaDto) {
    return this.categoriasService.crear(dto);
  }

  @Patch('categorias/:id')
  actualizarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
  ) {
    return this.categoriasService.actualizar(id, dto);
  }
}
