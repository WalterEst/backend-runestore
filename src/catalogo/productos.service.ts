import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { slugify } from '../common/util/slug.util';
import { Categoria } from '../database/entities/categoria.entity';
import { HistorialPrecio } from '../database/entities/historial-precio.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';
import { Producto } from '../database/entities/producto.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { Talla } from '../database/entities/talla.entity';
import {
  ActualizarPrecioDto,
  ActualizarProductoDto,
  ActualizarVarianteDto,
  AjustarStockDto,
  CrearProductoDto,
  CrearVarianteDto,
  QueryCatalogoDto,
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
      .leftJoinAndSelect('producto.categorias', 'categoria')
      .where('producto.activo = 1');

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
      relations: { categorias: true },
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

  async listarAdmin(): Promise<(ProductoListado & { stockTotal: number })[]> {
    const productos = await this.productos.find({
      relations: { categorias: true },
      order: { creadoEn: 'DESC' },
    });
    const enriquecidos = await this.enriquecerConImagenYColores(productos);
    if (productos.length === 0) return [];

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

    return enriquecidos.map((p) => ({
      ...p,
      stockTotal: stockPorProducto.get(p.id) ?? 0,
    }));
  }

  async obtenerAdmin(id: number): Promise<Producto> {
    const producto = await this.productos.findOne({
      where: { id },
      relations: { categorias: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async crear(dto: CrearProductoDto): Promise<Producto> {
    const slug = await this.generarSlugUnico(dto.nombre);
    const categorias = await this.categorias.find({
      where: { id: In(dto.categoriaIds) },
    });
    if (categorias.length !== dto.categoriaIds.length) {
      throw new BadRequestException('Alguna categoría no existe');
    }

    const producto = this.productos.create({
      nombre: dto.nombre,
      slug,
      descripcion: dto.descripcion,
      descripcionCorta: dto.descripcionCorta ?? null,
      anime: dto.anime ?? null,
      precio: dto.precio,
      destacado: !!dto.destacado,
      activo: true,
      categorias,
    });

    // El trigger trg_historial_precio_alta ya inserta la primera fila de historial_precios al INSERT
    return this.productos.save(producto);
  }

  async actualizar(id: number, dto: ActualizarProductoDto): Promise<Producto> {
    const producto = await this.obtenerAdmin(id);

    if (dto.categoriaIds) {
      const categorias = await this.categorias.find({
        where: { id: In(dto.categoriaIds) },
      });
      if (categorias.length !== dto.categoriaIds.length) {
        throw new BadRequestException('Alguna categoría no existe');
      }
      producto.categorias = categorias;
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

      const movimiento = await manager.save(
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
      });
      if (!varianteActualizada)
        throw new NotFoundException('Variante no encontrada');
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

    return this.variantes.save(
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
