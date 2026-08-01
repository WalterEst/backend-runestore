import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cupon } from '../database/entities/cupon.entity';
import { CuponUso } from '../database/entities/cupon-uso.entity';
import { ActualizarCuponDto, CrearCuponDto } from './dto/cupon.dto';

export interface ResultadoCupon {
  cuponId: number;
  descuento: number;
}

@Injectable()
export class CuponesService {
  constructor(
    @InjectRepository(Cupon) private readonly cupones: Repository<Cupon>,
    @InjectRepository(CuponUso) private readonly usos: Repository<CuponUso>,
  ) {}

  async listarAdmin(): Promise<Cupon[]> {
    return this.cupones.find({ order: { fechaInicio: 'DESC' } });
  }

  async crear(dto: CrearCuponDto): Promise<Cupon> {
    const existente = await this.cupones.findOne({
      where: { codigo: dto.codigo },
    });
    if (existente)
      throw new BadRequestException('Ya existe un cupón con ese código');

    return this.cupones.save(
      this.cupones.create({
        codigo: dto.codigo,
        tipo: dto.tipo,
        valor: dto.tipo === 'envio_gratis' ? 0 : (dto.valor ?? 0),
        montoMinimo: dto.montoMinimo ?? null,
        limiteUsosTotal: dto.limiteUsosTotal ?? null,
        limitePorUsuario: dto.limitePorUsuario ?? 1,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        activo: true,
      }),
    );
  }

  async actualizar(id: number, dto: ActualizarCuponDto): Promise<Cupon> {
    const cupon = await this.cupones.findOne({ where: { id } });
    if (!cupon) throw new NotFoundException('Cupón no encontrado');
    Object.assign(cupon, {
      limiteUsosTotal: dto.limiteUsosTotal ?? cupon.limiteUsosTotal,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : cupon.fechaFin,
      activo: dto.activo ?? cupon.activo,
    });
    return this.cupones.save(cupon);
  }

  /** Valida sin canjear — para que el frontend muestre el descuento antes del checkout, sin gastar un uso */
  async previsualizar(
    codigo: string,
    subtotal: number,
    usuarioId?: number,
  ): Promise<ResultadoCupon> {
    const cupon = await this.obtenerVigenteOFallar(
      this.cupones,
      codigo,
      subtotal,
    );
    if (usuarioId) {
      const usosUsuario = await this.usos.count({
        where: { cuponId: cupon.id, usuarioId },
      });
      if (usosUsuario >= cupon.limitePorUsuario) {
        throw new BadRequestException(
          'Ya usaste este cupón el máximo de veces permitido',
        );
      }
    }
    return {
      cuponId: cupon.id,
      descuento: this.calcularDescuento(cupon, subtotal),
    };
  }

  /**
   * Canje atómico dentro de la transacción del checkout (ver OrdenesService.crear):
   * el UPDATE condicionado es el punto de serialización — si dos compras
   * concurrentes agotan el último uso disponible, solo una lo consigue; la otra
   * ve affected=0 y se rechaza sin dejar el contador desincronizado.
   */
  async validarYCanjear(
    manager: EntityManager,
    codigo: string,
    usuarioId: number,
    ordenId: number,
    subtotal: number,
  ): Promise<ResultadoCupon> {
    const cuponesRepo = manager.getRepository(Cupon);
    const cupon = await this.obtenerVigenteOFallar(
      cuponesRepo,
      codigo,
      subtotal,
    );

    const usosUsuario = await manager.getRepository(CuponUso).count({
      where: { cuponId: cupon.id, usuarioId },
    });
    if (usosUsuario >= cupon.limitePorUsuario) {
      throw new BadRequestException(
        'Ya usaste este cupón el máximo de veces permitido',
      );
    }

    const resultado = await manager
      .createQueryBuilder()
      .update(Cupon)
      .set({ usosActuales: () => 'usos_actuales + 1' })
      .where('id = :id', { id: cupon.id })
      .andWhere(
        '(limite_usos_total IS NULL OR usos_actuales < limite_usos_total)',
      )
      .execute();

    if (!resultado.affected) {
      throw new BadRequestException('Este cupón alcanzó su límite de usos');
    }

    await manager.save(
      manager.create(CuponUso, { cuponId: cupon.id, usuarioId, ordenId }),
    );

    return {
      cuponId: cupon.id,
      descuento: this.calcularDescuento(cupon, subtotal),
    };
  }

  private async obtenerVigenteOFallar(
    repo: Repository<Cupon>,
    codigo: string,
    subtotal: number,
  ): Promise<Cupon> {
    const cupon = await repo.findOne({ where: { codigo } });
    if (!cupon) throw new NotFoundException('Cupón no válido');

    const ahora = new Date();
    if (!cupon.activo || ahora < cupon.fechaInicio || ahora > cupon.fechaFin) {
      throw new BadRequestException('Cupón no vigente');
    }
    if (cupon.montoMinimo && subtotal < cupon.montoMinimo) {
      throw new BadRequestException(
        `El monto mínimo para este cupón es $${cupon.montoMinimo}`,
      );
    }
    return cupon;
  }

  private calcularDescuento(cupon: Cupon, subtotal: number): number {
    if (cupon.tipo === 'envio_gratis') return 0; // el envío gratis se resta del costo de envío, no del subtotal
    if (cupon.tipo === 'porcentaje')
      return Math.round((subtotal * cupon.valor) / 100);
    return Math.min(subtotal, cupon.valor);
  }
}
