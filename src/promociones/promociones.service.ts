import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Promocion } from '../database/entities/promocion.entity';
import { ActualizarPromocionDto, CrearPromocionDto } from './dto/promocion.dto';

@Injectable()
export class PromocionesService {
  constructor(
    @InjectRepository(Promocion)
    private readonly promociones: Repository<Promocion>,
  ) {}

  async listarAdmin(): Promise<Promocion[]> {
    return this.promociones.find({ order: { fechaInicio: 'DESC' } });
  }

  async crear(dto: CrearPromocionDto): Promise<Promocion> {
    return this.promociones.save(
      this.promociones.create({
        nombre: dto.nombre,
        tipo: dto.tipo,
        valor: dto.valor,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        aplicaTodo: dto.aplicaTodo ?? true,
        activa: true,
      }),
    );
  }

  async actualizar(
    id: number,
    dto: ActualizarPromocionDto,
  ): Promise<Promocion> {
    const promocion = await this.promociones.findOne({ where: { id } });
    if (!promocion) throw new NotFoundException('Promoción no encontrada');

    Object.assign(promocion, {
      nombre: dto.nombre ?? promocion.nombre,
      valor: dto.valor ?? promocion.valor,
      fechaInicio: dto.fechaInicio
        ? new Date(dto.fechaInicio)
        : promocion.fechaInicio,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : promocion.fechaFin,
      activa: dto.activa ?? promocion.activa,
    });
    return this.promociones.save(promocion);
  }

  /** Kill-switch manual — ver documento maestro Parte 3.2 */
  async toggleActiva(id: number): Promise<Promocion> {
    const promocion = await this.promociones.findOne({ where: { id } });
    if (!promocion) throw new NotFoundException('Promoción no encontrada');
    promocion.activa = !promocion.activa;
    return this.promociones.save(promocion);
  }

  /**
   * Mejor promoción de tienda completa vigente ahora mismo (solo `aplicaTodo`,
   * ver nota en CrearPromocionDto sobre la limitación de promocion_productos).
   * Devuelve el monto de descuento a aplicar sobre `subtotal`.
   */
  async calcularDescuentoTiendaCompleta(subtotal: number): Promise<number> {
    const ahora = new Date();
    const vigentes = await this.promociones.find({
      where: {
        activa: true,
        aplicaTodo: true,
        fechaInicio: LessThanOrEqual(ahora),
        fechaFin: MoreThanOrEqual(ahora),
      },
    });
    if (vigentes.length === 0) return 0;

    const descuentos = vigentes.map((promo) =>
      promo.tipo === 'porcentaje'
        ? Math.round((subtotal * promo.valor) / 100)
        : promo.valor,
    );
    return Math.min(subtotal, Math.max(...descuentos));
  }
}
