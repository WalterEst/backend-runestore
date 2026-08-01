import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Resena } from '../database/entities/resena.entity';
import { CrearResenaDto } from './dto/resena.dto';

/** Estados de orden que acreditan una compra real (no pendiente, no cancelada/expirada) */
const ESTADOS_COMPRA_VALIDA = [
  'pagada',
  'en_preparacion',
  'enviada',
  'entregada',
];

@Injectable()
export class ResenasService {
  constructor(
    @InjectRepository(Resena) private readonly resenas: Repository<Resena>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(OrdenItem)
    private readonly ordenItems: Repository<OrdenItem>,
  ) {}

  async crear(usuarioId: number, dto: CrearResenaDto): Promise<Resena> {
    const orden = await this.ordenes.findOne({ where: { id: dto.ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    // Anti-IDOR: solo se puede reseñar con la propia orden — ver CLAUDE.md
    if (orden.usuarioId !== usuarioId) {
      throw new ForbiddenException('Esta orden no te pertenece');
    }
    if (!ESTADOS_COMPRA_VALIDA.includes(orden.estado)) {
      throw new BadRequestException(
        'Solo puedes reseñar productos de una compra confirmada',
      );
    }

    const itemDelProducto = await this.ordenItems
      .createQueryBuilder('item')
      .innerJoin('item.variante', 'variante')
      .where('item.ordenId = :ordenId', { ordenId: dto.ordenId })
      .andWhere('variante.productoId = :productoId', {
        productoId: dto.productoId,
      })
      .getOne();

    if (!itemDelProducto) {
      throw new BadRequestException('Esta orden no contiene ese producto');
    }

    try {
      return await this.resenas.save(
        this.resenas.create({
          productoId: dto.productoId,
          usuarioId,
          ordenId: dto.ordenId,
          puntuacion: dto.puntuacion,
          titulo: dto.titulo
            ? sanitizeHtml(dto.titulo, { allowedTags: [] })
            : null,
          comentario: dto.comentario
            ? sanitizeHtml(dto.comentario, { allowedTags: [] })
            : null,
          tallaComprada: itemDelProducto.talla,
          aprobada: false,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Ya reseñaste este producto');
      }
      throw error;
    }
  }

  async listarPublicas(productoId: number): Promise<Resena[]> {
    return this.resenas.find({
      where: { productoId, aprobada: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async listarPendientesAdmin(): Promise<Resena[]> {
    return this.resenas.find({
      where: { aprobada: false },
      relations: { producto: true, usuario: true },
      order: { creadoEn: 'ASC' },
    });
  }

  async moderar(id: number, aprobada: boolean): Promise<Resena> {
    const resena = await this.resenas.findOne({ where: { id } });
    if (!resena) throw new NotFoundException('Reseña no encontrada');
    resena.aprobada = aprobada;
    return this.resenas.save(resena);
  }
}
