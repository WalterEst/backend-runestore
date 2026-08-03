import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { slugify } from '../common/util/slug.util';
import { Categoria } from '../database/entities/categoria.entity';
import { HistorialPrecio } from '../database/entities/historial-precio.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';
import { Producto } from '../database/entities/producto.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { Talla } from '../database/entities/talla.entity';
import {
  ActualizarCostoDto,
  ActualizarPrecioDto,
  ActualizarProductoDto,
  ActualizarVarianteDto,
  AjustarStockDto,
  CrearProductoDto,
  CrearTallaDto,
  CrearVarianteDto,
  QueryCatalogoDto,
  QueryInventarioDto,
  RegistrarImagenDto,
} from './dto/producto.dto';

export interface ResultadoPaginado<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
}

export type ProductoListado = Producto & {
  imagenUrl: string | null;
  colores: string[];
};

const LIMITE_PAGINA_DEFAULT = 24;
const LIMITE_PAGINA_MAXIMO = 100;

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Talla) private readonly tallas: Repository<Talla>,
    @InjectRepository(ProductoVariante)
    private readonly variantes: Repository<ProductoVariante>,
    @InjectRepository(ProductoImagen)
    private readonly imagenes: Repository<ProductoImagen>,
    @InjectRepository(HistorialPrecio)
    private readonly historialPrecios: Repository<HistorialPrecio>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientos: Repository<MovimientoInventario>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listadoPublico(
    query: QueryCatalogoDto,
  ): Promise<ResultadoPaginado<ProductoListado>> {
    const limite = Math.min(
      query.limite ?? LIMITE_PAGINA_DEFAULT,
      LIMITE_PAGINA_MAXIMO,
    );
    const pagina = query.pagina ?? 1;

    const qb = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      // Las poleras "blanco" son insumo interno de bodega: la tienda pública solo vende productos ya estampados
      .where('producto.activo = 1')
      .andWhere("producto.tipoProducto = 'estampado'");

    if (query.q) {
      qb.andWhere(
        'MATCH(producto.nombre, producto.descripcion) AGAINST (:q IN NATURAL LANGUAGE MODE)',
        { q: query.q },
      );
    }
    if (query.categoria) {
      qb.andWhere('categoria.slug = :categoriaSlug', {
        categoriaSlug: query.categoria,
      });
    }
    if (query.anime) {
      qb.andWhere('producto.anime = :anime', { anime: query.anime });
    }
    if (query.destacado !== undefined) {
      qb.andWhere('producto.destacado = :destacado', {
        destacado: query.destacado,
      });
    }
    if (query.precioMin !== undefined) {
      qb.andWhere('producto.precio >= :precioMin', {
        precioMin: query.precioMin,
      });
    }
    if (query.precioMax !== undefined) {
      qb.andWhere('producto.precio <= :precioMax', {
        precioMax: query.precioMax,
      });
    }
    if (query.talla) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM producto_variantes pv INNER JOIN tallas t ON t.id = pv.talla_id WHERE pv.producto_id = producto.id AND t.codigo = :talla AND pv.activa = 1)',
        { talla: query.talla },
      );
    }

    const [items, total] = await qb
      .orderBy('producto.creadoEn', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    const itemsEnriquecidos = await this.enriquecerConImagenYColores(items);
    return { items: itemsEnriquecidos, total, pagina, limite };
  }

  /** Primera imagen + colores distintos de variantes activas, en lote (evita N+1) */
  private async enriquecerConImagenYColores(
    productos: Producto[],
  ): Promise<ProductoListado[]> {
    if (productos.length === 0) return [];
    const productoIds = productos.map((p) => p.id);

    const [imagenes, variantes] = await Promise.all([
      this.imagenes.find({
        where: { productoId: In(productoIds) },
        order: { orden: 'ASC' },
      }),
      this.variantes.find({
        where: { productoId: In(productoIds), activa: true },
      }),
    ]);

    const primeraImagenPorProducto = new Map<number, string>();
    for (const imagen of imagenes) {
      if (!primeraImagenPorProducto.has(imagen.productoId)) {
        primeraImagenPorProducto.set(imagen.productoId, imagen.url);
      }
    }

    const coloresPorProducto = new Map<number, Set<string>>();
    for (const variante of variantes) {
      if (!variante.color) continue;
      const set =
        coloresPorProducto.get(variante.productoId) ?? new Set<string>();
      set.add(variante.color);
      coloresPorProducto.set(variante.productoId, set);
    }

    return productos.map((producto) => ({
      ...producto,
      imagenUrl: primeraImagenPorProducto.get(producto.id) ?? null,
      colores: [...(coloresPorProducto.get(producto.id) ?? [])],
    }));
  }

  async detallePublico(slug: string): Promise<Producto> {
    const producto = await this.productos.findOne({
      where: { slug, activo: true },
      relations: { categoria: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const [imagenes, variantes] = await Promise.all([
      this.imagenes.find({
        where: { productoId: producto.id },
        order: { orden: 'ASC' },
      }),
      this.variantes.find({
        where: { productoId: producto.id, activa: true },
        relations: { talla: true },
      }),
    ]);

    return { ...producto, imagenes, variantes } as Producto & {
      imagenes: ProductoImagen[];
      variantes: ProductoVariante[];
    };
  }

  /**
   * Listado de inventario del admin: agrupado por producto (no por variante), con filtros
   * de tipo (blanco/estampado), categoría, búsqueda de texto (nombre o SKU de alguna
   * variante) y "solo stock bajo". A diferencia del catálogo público, sí incluye "blanco".
   */
  async listarAdmin(
    query: QueryInventarioDto = {},
  ): Promise<ResultadoPaginado<ProductoListado & { stockTotal: number }>> {
    const limite = Math.min(
      query.limite ?? LIMITE_PAGINA_DEFAULT,
      LIMITE_PAGINA_MAXIMO,
    );
    const pagina = query.pagina ?? 1;

    const qb = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria');

    if (query.tipoProducto) {
      qb.andWhere('producto.tipoProducto = :tipoProducto', {
        tipoProducto: query.tipoProducto,
      });
    }
    if (query.categoriaId) {
      qb.andWhere('producto.categoriaId = :categoriaId', {
        categoriaId: query.categoriaId,
      });
    }
    if (query.q) {
      qb.andWhere(
        '(producto.nombre LIKE :q OR EXISTS (SELECT 1 FROM producto_variantes pv WHERE pv.producto_id = producto.id AND pv.sku LIKE :q))',
        { q: `%${query.q}%` },
      );
    }
    if (query.stockBajo) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM producto_variantes pv WHERE pv.producto_id = producto.id AND pv.activa = 1 AND pv.stock <= pv.stock_minimo)',
      );
    }

    const [productos, total] = await qb
      .orderBy('producto.creadoEn', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    const enriquecidos = await this.enriquecerConImagenYColores(productos);
    if (productos.length === 0) return { items: [], total, pagina, limite };

    const variantes = await this.variantes.find({
      where: { productoId: In(productos.map((p) => p.id)) },
    });
    const stockPorProducto = new Map<number, number>();
    for (const variante of variantes) {
      stockPorProducto.set(
        variante.productoId,
        (stockPorProducto.get(variante.productoId) ?? 0) + variante.stock,
      );
    }

    const items = enriquecidos.map((p) => ({
      ...p,
      stockTotal: stockPorProducto.get(p.id) ?? 0,
    }));
    return { items, total, pagina, limite };
  }

  /** Misma lógica de filtros que listarAdmin, sin paginar — usado por la exportación a Excel */
  private async listarParaExportar(
    query: Pick<QueryInventarioDto, 'tipoProducto' | 'categoriaId' | 'q' | 'stockBajo'>,
  ): Promise<Producto[]> {
    const qb = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria');

    if (query.tipoProducto) {
      qb.andWhere('producto.tipoProducto = :tipoProducto', {
        tipoProducto: query.tipoProducto,
      });
    }
    if (query.categoriaId) {
      qb.andWhere('producto.categoriaId = :categoriaId', {
        categoriaId: query.categoriaId,
      });
    }
    if (query.q) {
      qb.andWhere(
        '(producto.nombre LIKE :q OR EXISTS (SELECT 1 FROM producto_variantes pv WHERE pv.producto_id = producto.id AND pv.sku LIKE :q))',
        { q: `%${query.q}%` },
      );
    }
    if (query.stockBajo) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM producto_variantes pv WHERE pv.producto_id = producto.id AND pv.activa = 1 AND pv.stock <= pv.stock_minimo)',
      );
    }

    return qb.orderBy('producto.nombre', 'ASC').getMany();
  }

  /** Genera el .xlsx del inventario (una fila por variante) respetando los mismos filtros que el listado */
  async exportarExcel(
    query: Pick<QueryInventarioDto, 'tipoProducto' | 'categoriaId' | 'q' | 'stockBajo'>,
  ): Promise<Workbook> {
    const productos = await this.listarParaExportar(query);
    const productoIds = productos.map((p) => p.id);
    const variantes = productoIds.length
      ? await this.variantes.find({
          where: { productoId: In(productoIds) },
          relations: { talla: true },
          order: { productoId: 'ASC' },
        })
      : [];
    const variantesPorProducto = new Map<number, ProductoVariante[]>();
    for (const variante of variantes) {
      const lista = variantesPorProducto.get(variante.productoId) ?? [];
      lista.push(variante);
      variantesPorProducto.set(variante.productoId, lista);
    }

    const workbook = new Workbook();
    workbook.creator = 'RUNE — Panel de administración';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Inventario');
    hoja.columns = [
      { header: 'Producto', key: 'producto', width: 36 },
      { header: 'Tipo', key: 'tipo', width: 22 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Talla', key: 'talla', width: 8 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Stock mínimo', key: 'stockMinimo', width: 14 },
      { header: 'Precio', key: 'precio', width: 12 },
      { header: 'Precio oferta', key: 'precioOferta', width: 14 },
      { header: 'Costo', key: 'costo', width: 12 },
      { header: 'Variante activa', key: 'activa', width: 14 },
      { header: 'Producto activo', key: 'productoActivo', width: 14 },
    ];
    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A0A0A' },
    };
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const etiquetaTipo: Record<string, string> = {
      blanco: 'Polera sin estampado',
      estampado: 'Con estampado / Colección',
    };

    for (const producto of productos) {
      const filasProducto = variantesPorProducto.get(producto.id) ?? [];
      if (filasProducto.length === 0) {
        hoja.addRow({
          producto: producto.nombre,
          tipo: etiquetaTipo[producto.tipoProducto],
          categoria: producto.categoria.nombre,
          sku: '—',
          talla: '—',
          color: '—',
          stock: 0,
          stockMinimo: '—',
          precio: producto.precio ?? '',
          precioOferta: producto.precioOferta ?? '',
          costo: producto.costo ?? '',
          activa: '—',
          productoActivo: producto.activo ? 'Sí' : 'No',
        });
        continue;
      }
      for (const variante of filasProducto) {
        const fila = hoja.addRow({
          producto: producto.nombre,
          tipo: etiquetaTipo[producto.tipoProducto],
          categoria: producto.categoria.nombre,
          sku: variante.sku,
          talla: variante.talla.codigo,
          color: variante.color ?? '—',
          stock: variante.stock,
          stockMinimo: variante.stockMinimo,
          precio: producto.precio !== null ? producto.precio + variante.precioExtra : '',
          precioOferta: producto.precioOferta ?? '',
          costo: producto.costo ?? '',
          activa: variante.activa ? 'Sí' : 'No',
          productoActivo: producto.activo ? 'Sí' : 'No',
        });
        if (variante.stock <= variante.stockMinimo) {
          fila.getCell('stock').font = { color: { argb: 'FFE11B22' }, bold: true };
        }
      }
    }

    hoja.autoFilter = { from: 'A1', to: 'M1' };
    return workbook;
  }

  async obtenerAdmin(
    id: number,
  ): Promise<Producto & { imagenes: ProductoImagen[] }> {
    const producto = await this.productos.findOne({
      where: { id },
      relations: { categoria: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const imagenes = await this.imagenes.find({
      where: { productoId: id },
      order: { orden: 'ASC' },
    });
    return { ...producto, imagenes };
  }

  async crear(dto: CrearProductoDto): Promise<Producto> {
    const slug = await this.generarSlugUnico(dto.nombre);
    const categoria = await this.categorias.findOne({
      where: { id: dto.categoriaId },
    });
    if (!categoria) throw new BadRequestException('La categoría no existe');

    if (dto.tipoProducto === 'estampado' && !dto.precio) {
      throw new BadRequestException(
        'Los productos con estampado requieren un precio de venta',
      );
    }
    if (dto.tipoProducto === 'blanco' && !dto.costo) {
      throw new BadRequestException(
        'Los insumos (sin estampado) requieren un costo',
      );
    }

    const producto = this.productos.create({
      nombre: dto.nombre,
      slug,
      descripcion: dto.descripcion,
      descripcionCorta: dto.descripcionCorta ?? null,
      anime: dto.anime ?? null,
      tipoProducto: dto.tipoProducto,
      categoriaId: categoria.id,
      precio: dto.tipoProducto === 'estampado' ? (dto.precio ?? null) : null,
      costo: dto.tipoProducto === 'blanco' ? (dto.costo ?? null) : null,
      destacado: !!dto.destacado,
      activo: true,
    });

    // El trigger trg_historial_precio_alta ya inserta la primera fila de historial_precios al INSERT
    // (solo si precio no es NULL — los insumos no generan historial de precio)
    const guardado = await this.productos.save(producto);
    // save() no trae la relación categoria poblada (solo categoriaId) — el frontend la
    // necesita para mostrar el nombre de la categoría en la fila recién agregada sin recargar todo.
    return { ...guardado, categoria };
  }

  async actualizar(id: number, dto: ActualizarProductoDto): Promise<Producto> {
    const producto = await this.obtenerAdmin(id);

    if (dto.categoriaId) {
      const categoria = await this.categorias.findOne({
        where: { id: dto.categoriaId },
      });
      if (!categoria) throw new BadRequestException('La categoría no existe');
      producto.categoriaId = categoria.id;
      producto.categoria = categoria;
    }

    Object.assign(producto, {
      nombre: dto.nombre ?? producto.nombre,
      descripcion: dto.descripcion ?? producto.descripcion,
      descripcionCorta: dto.descripcionCorta ?? producto.descripcionCorta,
      anime: dto.anime ?? producto.anime,
      destacado: dto.destacado ?? producto.destacado,
      activo: dto.activo ?? producto.activo,
    });

    return this.productos.save(producto);
  }

  /**
   * Elimina un producto (insumo o terminado) por completo — a diferencia de "activo",
   * esto es irreversible. Se bloquea si todavía tiene stock (hay que llevarlo a 0 con una
   * merma primero) o si la BD rechaza el borrado por FK (movimientos/reservas activas):
   * en ambos casos es más seguro desactivarlo que perder ese historial.
   */
  async eliminar(id: number): Promise<void> {
    const producto = await this.productos.findOne({ where: { id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const stockTotal = await this.variantes
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.stock), 0)', 'total')
      .where('v.productoId = :id', { id })
      .getRawOne<{ total: string }>();
    if (Number(stockTotal?.total ?? 0) > 0) {
      throw new ConflictException(
        'No se puede eliminar: todavía tiene stock. Ajusta el stock a 0 (merma) antes de eliminarlo.',
      );
    }

    try {
      await this.productos.delete(id);
    } catch (err) {
      const codigo = (err as { code?: string; errno?: number }).code;
      const errno = (err as { code?: string; errno?: number }).errno;
      if (codigo === 'ER_ROW_IS_REFERENCED_2' || errno === 1451) {
        throw new ConflictException(
          'No se puede eliminar: tiene movimientos de stock o pedidos asociados. Desactívalo en su lugar.',
        );
      }
      throw err;
    }
  }

  /**
   * Cambio de precio desde el panel admin: el trigger trg_historial_precio ya inserta
   * la fila en historial_precios al hacer el UPDATE (ver RunarStore.sql); acá solo
   * completamos esa misma fila con usuario_id + motivo, dentro de la misma transacción
   * — nunca duplicamos el INSERT (regla del documento maestro y CLAUDE.md).
   */
  async actualizarPrecio(
    id: number,
    dto: ActualizarPrecioDto,
    usuarioId: number,
  ): Promise<Producto> {
    return this.dataSource.transaction(async (manager) => {
      const producto = await manager.findOne(Producto, { where: { id } });
      if (!producto) throw new NotFoundException('Producto no encontrado');

      const precioOfertaNuevo = dto.precioOferta ?? null;
      const cambioReal =
        producto.precio !== dto.precio ||
        producto.precioOferta !== precioOfertaNuevo;

      await manager.update(
        Producto,
        { id },
        {
          precio: dto.precio,
          precioOferta: precioOfertaNuevo,
        },
      );

      if (cambioReal) {
        const filas = await manager.query<{ id: number }[]>(
          'SELECT LAST_INSERT_ID() as id',
        );
        const [{ id: historialId }] = filas;
        await manager.update(
          HistorialPrecio,
          { id: historialId },
          { usuarioId, motivo: dto.motivo },
        );
      }

      const actualizado = await manager.findOne(Producto, { where: { id } });
      if (!actualizado) throw new NotFoundException('Producto no encontrado');
      return actualizado;
    });
  }

  /**
   * Cambio de costo de un insumo (tipoProducto=blanco). A diferencia del precio, no
   * fiscaliza SERNAC ni tiene historial — es un dato interno de compra a proveedor.
   */
  async actualizarCosto(id: number, dto: ActualizarCostoDto): Promise<Producto> {
    const producto = await this.productos.findOne({ where: { id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.tipoProducto !== 'blanco') {
      throw new BadRequestException(
        'Solo los insumos (sin estampado) tienen costo — este producto usa precio',
      );
    }

    await this.productos.update({ id }, { costo: dto.costo });
    const actualizado = await this.productos.findOne({ where: { id } });
    if (!actualizado) throw new NotFoundException('Producto no encontrado');
    return actualizado;
  }

  /**
   * Reposición/ajuste/merma manual desde el panel admin (bodeguero). Todo cambio
   * de stock inserta fila en movimientos_inventario con el stock resultante —
   * sin excepciones (ver CLAUDE.md).
   */
  async ajustarStock(
    varianteId: number,
    dto: AjustarStockDto,
    usuarioId: number,
  ): Promise<{ variante: ProductoVariante; movimiento: MovimientoInventario }> {
    return this.dataSource.transaction(async (manager) => {
      const variante = await manager
        .createQueryBuilder(ProductoVariante, 'v')
        .setLock('pessimistic_write')
        .where('v.id = :id', { id: varianteId })
        .getOne();
      if (!variante) throw new NotFoundException('Variante no encontrada');

      const stockResultante = variante.stock + dto.cantidad;
      if (stockResultante < 0) {
        throw new BadRequestException(
          `El ajuste dejaría el stock en negativo (actual: ${variante.stock})`,
        );
      }

      await manager.update(
        ProductoVariante,
        { id: varianteId },
        { stock: stockResultante },
      );

      const movimientoGuardado = await manager.save(
        manager.create(MovimientoInventario, {
          varianteId,
          tipo: dto.tipo,
          cantidad: dto.cantidad,
          stockResultante,
          referencia: dto.referencia ?? null,
          usuarioId,
        }),
      );

      const varianteActualizada = await manager.findOne(ProductoVariante, {
        where: { id: varianteId },
        relations: { talla: true },
      });
      if (!varianteActualizada)
        throw new NotFoundException('Variante no encontrada');

      // Se recarga con las relaciones producto/talla porque el listado de movimientos
      // del frontend las muestra directo, sin volver a pedir cada variante por separado.
      const movimiento = await manager.findOne(MovimientoInventario, {
        where: { id: movimientoGuardado.id },
        relations: { variante: { producto: true, talla: true } },
      });
      if (!movimiento) throw new NotFoundException('Movimiento no encontrado');

      return { variante: varianteActualizada, movimiento };
    });
  }

  async listarMovimientos(limite = 50): Promise<MovimientoInventario[]> {
    return this.movimientos.find({
      relations: { variante: { producto: true, talla: true } },
      order: { creadoEn: 'DESC' },
      take: Math.min(limite, 200),
    });
  }

  async crearVariante(
    productoId: number,
    dto: CrearVarianteDto,
  ): Promise<ProductoVariante> {
    await this.obtenerAdmin(productoId);
    const talla = await this.tallas.findOne({ where: { id: dto.tallaId } });
    if (!talla) throw new BadRequestException('Talla no existe');

    const skuExistente = await this.variantes.findOne({
      where: { sku: dto.sku },
    });
    if (skuExistente)
      throw new ConflictException('Ya existe una variante con ese SKU');

    const guardada = await this.variantes.save(
      this.variantes.create({
        productoId,
        tallaId: dto.tallaId,
        color: dto.color ?? null,
        sku: dto.sku,
        stock: dto.stock,
        stockMinimo: dto.stockMinimo ?? 3,
        precioExtra: dto.precioExtra ?? 0,
        activa: true,
      }),
    );
    // save() no trae la relación talla poblada (solo tallaId) — el frontend la necesita
    // para mostrar el código de talla en la fila recién agregada sin recargar todo.
    return { ...guardada, talla };
  }

  async listarTodasLasVariantes(): Promise<ProductoVariante[]> {
    return this.variantes.find({
      relations: { producto: true, talla: true },
      order: { id: 'ASC' },
    });
  }

  async actualizarVariante(
    varianteId: number,
    dto: ActualizarVarianteDto,
  ): Promise<ProductoVariante> {
    const variante = await this.variantes.findOne({
      where: { id: varianteId },
    });
    if (!variante) throw new NotFoundException('Variante no encontrada');
    Object.assign(variante, dto);
    return this.variantes.save(variante);
  }

  async listarVariantes(productoId: number): Promise<ProductoVariante[]> {
    return this.variantes.find({
      where: { productoId },
      relations: { talla: true },
      order: { id: 'ASC' },
    });
  }

  async listarTallas(): Promise<Talla[]> {
    return this.tallas.find({ order: { orden: 'ASC' } });
  }

  async crearTalla(dto: CrearTallaDto): Promise<Talla> {
    const codigo = dto.codigo.trim().toUpperCase();
    const existente = await this.tallas.findOne({ where: { codigo } });
    if (existente) throw new ConflictException('Ya existe una talla con ese código');

    const ordenMaximo = await this.tallas
      .createQueryBuilder('talla')
      .select('MAX(talla.orden)', 'max')
      .getRawOne<{ max: number | null }>();

    return this.tallas.save(
      this.tallas.create({
        codigo,
        orden: dto.orden ?? (ordenMaximo?.max ?? 0) + 1,
      }),
    );
  }

  async registrarImagen(
    productoId: number,
    dto: RegistrarImagenDto,
  ): Promise<ProductoImagen> {
    await this.obtenerAdmin(productoId);
    return this.imagenes.save(
      this.imagenes.create({
        productoId,
        url: dto.url,
        altText: dto.altText ?? null,
        orden: dto.orden ?? 0,
      }),
    );
  }

  async eliminarImagen(imagenId: number): Promise<void> {
    const resultado = await this.imagenes.delete({ id: imagenId });
    if (!resultado.affected)
      throw new NotFoundException('Imagen no encontrada');
  }

  /**
   * El slug se genera siempre desde el nombre del producto — nunca lo escribe el admin
   * (el servicio de gestión de archivos/URLs lo necesita determinístico). Si ya existe
   * un producto con ese slug (mismo nombre, o nombre que normaliza igual), se le agrega
   * un sufijo numérico hasta encontrar uno libre.
   */
  private async generarSlugUnico(nombre: string): Promise<string> {
    const base = slugify(nombre) || 'producto';
    let candidato = base;
    let intento = 1;
    while (await this.productos.findOne({ where: { slug: candidato } })) {
      intento += 1;
      candidato = `${base}-${intento}`;
    }
    return candidato;
  }
}
