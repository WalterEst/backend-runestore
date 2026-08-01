import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Carrito } from '../database/entities/carrito.entity';
import { CarritoItem } from '../database/entities/carrito-item.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { calcularStockDisponible } from '../common/inventario/stock.util';
import { AgregarItemDto, ActualizarItemDto } from './dto/carrito-item.dto';

export interface ContextoCarrito {
  usuarioId?: number;
  sessionId?: string;
}

export interface ItemCarritoDetallado {
  id: number;
  varianteId: number;
  productoNombre: string;
  productoSlug: string;
  talla: string;
  color: string | null;
  imagenUrl: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ResumenCarrito {
  carritoId: number;
  items: ItemCarritoDetallado[];
  cantidadTotal: number;
  subtotal: number;
}

@Injectable()
export class CarritoService {
  constructor(
    @InjectRepository(Carrito) private readonly carritos: Repository<Carrito>,
    @InjectRepository(CarritoItem)
    private readonly items: Repository<CarritoItem>,
    @InjectRepository(ProductoVariante)
    private readonly variantes: Repository<ProductoVariante>,
    @InjectRepository(ProductoImagen)
    private readonly imagenes: Repository<ProductoImagen>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** sessionId a usar si el carrito de invitado se creó recién (el controller la setea como cookie) */
  async obtenerOCrear(
    ctx: ContextoCarrito,
  ): Promise<{ carrito: Carrito; sessionIdNueva?: string }> {
    if (ctx.usuarioId) {
      let carrito = await this.carritos.findOne({
        where: { usuarioId: ctx.usuarioId, estado: 'activo' },
      });
      if (!carrito) {
        carrito = await this.carritos.save(
          this.carritos.create({ usuarioId: ctx.usuarioId, estado: 'activo' }),
        );
      }
      return { carrito };
    }

    if (ctx.sessionId) {
      const carrito = await this.carritos.findOne({
        where: {
          sessionId: ctx.sessionId,
          estado: 'activo',
          usuarioId: IsNull(),
        },
      });
      if (carrito) return { carrito };
    }

    const sessionIdNueva = randomUUID();
    const carrito = await this.carritos.save(
      this.carritos.create({ sessionId: sessionIdNueva, estado: 'activo' }),
    );
    return { carrito, sessionIdNueva };
  }

  async resumen(
    ctx: ContextoCarrito,
  ): Promise<ResumenCarrito & { sessionIdNueva?: string }> {
    const { carrito, sessionIdNueva } = await this.obtenerOCrear(ctx);
    const items = await this.items.find({
      where: { carritoId: carrito.id },
      relations: { variante: { producto: true, talla: true } },
    });
    return { ...(await this.armarResumen(carrito.id, items)), sessionIdNueva };
  }

  async agregarItem(
    ctx: ContextoCarrito,
    dto: AgregarItemDto,
  ): Promise<ResumenCarrito & { sessionIdNueva?: string }> {
    const { carrito, sessionIdNueva } = await this.obtenerOCrear(ctx);

    const variante = await this.variantes.findOne({
      where: { id: dto.varianteId, activa: true },
      relations: { producto: true },
    });
    if (!variante || !variante.producto.activo) {
      throw new NotFoundException('Variante no encontrada');
    }

    const existente = await this.items.findOne({
      where: { carritoId: carrito.id, varianteId: dto.varianteId },
    });
    const cantidadFinal = (existente?.cantidad ?? 0) + dto.cantidad;

    const disponible = await calcularStockDisponible(
      this.dataSource.manager,
      variante.id,
      variante.stock,
    );
    if (cantidadFinal > disponible) {
      throw new BadRequestException(
        `Solo quedan ${Math.max(disponible, 0)} unidades disponibles de esta variante`,
      );
    }

    const precioUnitario =
      (variante.producto.precioOferta ?? variante.producto.precio) +
      variante.precioExtra;

    if (existente) {
      existente.cantidad = cantidadFinal;
      await this.items.save(existente);
    } else {
      await this.items.save(
        this.items.create({
          carritoId: carrito.id,
          varianteId: dto.varianteId,
          cantidad: dto.cantidad,
          precioUnitario,
        }),
      );
    }

    const items = await this.items.find({
      where: { carritoId: carrito.id },
      relations: { variante: { producto: true, talla: true } },
    });
    return { ...(await this.armarResumen(carrito.id, items)), sessionIdNueva };
  }

  async actualizarItem(
    ctx: ContextoCarrito,
    itemId: number,
    dto: ActualizarItemDto,
  ): Promise<ResumenCarrito> {
    const { carrito } = await this.obtenerOCrear(ctx);
    const item = await this.items.findOne({
      where: { id: itemId, carritoId: carrito.id },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado en el carrito');

    if (dto.cantidad === 0) {
      await this.items.delete({ id: itemId });
    } else {
      const variante = await this.variantes.findOne({
        where: { id: item.varianteId },
      });
      if (!variante) throw new NotFoundException('Variante no encontrada');
      const disponible = await calcularStockDisponible(
        this.dataSource.manager,
        variante.id,
        variante.stock,
      );
      if (dto.cantidad > disponible) {
        throw new BadRequestException(
          `Solo quedan ${Math.max(disponible, 0)} unidades disponibles de esta variante`,
        );
      }
      item.cantidad = dto.cantidad;
      await this.items.save(item);
    }

    const items = await this.items.find({
      where: { carritoId: carrito.id },
      relations: { variante: { producto: true, talla: true } },
    });
    return this.armarResumen(carrito.id, items);
  }

  async eliminarItem(
    ctx: ContextoCarrito,
    itemId: number,
  ): Promise<ResumenCarrito> {
    const { carrito } = await this.obtenerOCrear(ctx);
    const resultado = await this.items.delete({
      id: itemId,
      carritoId: carrito.id,
    });
    if (!resultado.affected)
      throw new NotFoundException('Ítem no encontrado en el carrito');

    const items = await this.items.find({
      where: { carritoId: carrito.id },
      relations: { variante: { producto: true, talla: true } },
    });
    return this.armarResumen(carrito.id, items);
  }

  async vaciar(ctx: ContextoCarrito): Promise<void> {
    const { carrito } = await this.obtenerOCrear(ctx);
    await this.items.delete({ carritoId: carrito.id });
  }

  /** Fusión del carrito de invitado al iniciar sesión: se llama justo después del login */
  async fusionar(
    usuarioId: number,
    sessionId: string | undefined,
  ): Promise<void> {
    if (!sessionId) return;

    const carritoInvitado = await this.carritos.findOne({
      where: { sessionId, estado: 'activo', usuarioId: IsNull() },
    });
    if (!carritoInvitado) return;

    const { carrito: carritoUsuario } = await this.obtenerOCrear({ usuarioId });
    const itemsInvitado = await this.items.find({
      where: { carritoId: carritoInvitado.id },
    });

    for (const itemInvitado of itemsInvitado) {
      const existente = await this.items.findOne({
        where: {
          carritoId: carritoUsuario.id,
          varianteId: itemInvitado.varianteId,
        },
      });
      if (existente) {
        existente.cantidad += itemInvitado.cantidad;
        await this.items.save(existente);
      } else {
        await this.items.save(
          this.items.create({
            carritoId: carritoUsuario.id,
            varianteId: itemInvitado.varianteId,
            cantidad: itemInvitado.cantidad,
            precioUnitario: itemInvitado.precioUnitario,
          }),
        );
      }
    }

    await this.items.delete({ carritoId: carritoInvitado.id });
    await this.carritos.update(
      { id: carritoInvitado.id },
      { estado: 'abandonado' },
    );
  }

  private async armarResumen(
    carritoId: number,
    items: CarritoItem[],
  ): Promise<ResumenCarrito> {
    const productoIds = [...new Set(items.map((i) => i.variante.producto.id))];
    const primeraImagenPorProducto = new Map<number, string>();
    if (productoIds.length > 0) {
      const imagenes = await this.imagenes.find({
        where: { productoId: In(productoIds) },
        order: { orden: 'ASC' },
      });
      for (const imagen of imagenes) {
        if (!primeraImagenPorProducto.has(imagen.productoId)) {
          primeraImagenPorProducto.set(imagen.productoId, imagen.url);
        }
      }
    }

    const detalle: ItemCarritoDetallado[] = items.map((item) => ({
      id: item.id,
      varianteId: item.varianteId,
      productoNombre: item.variante.producto.nombre,
      productoSlug: item.variante.producto.slug,
      talla: item.variante.talla.codigo,
      color: item.variante.color,
      imagenUrl:
        primeraImagenPorProducto.get(item.variante.producto.id) ?? null,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.precioUnitario * item.cantidad,
    }));

    return {
      carritoId,
      items: detalle,
      cantidadTotal: detalle.reduce((acc, i) => acc + i.cantidad, 0),
      subtotal: detalle.reduce((acc, i) => acc + i.subtotal, 0),
    };
  }
}
