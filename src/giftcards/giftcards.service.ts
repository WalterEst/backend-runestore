import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { Giftcard } from '../database/entities/giftcard.entity';
import { GiftcardMovimiento } from '../database/entities/giftcard-movimiento.entity';
import { EmitirGiftcardDto } from './dto/giftcard.dto';

export interface ResultadoGiftcard {
  giftcardId: number;
  montoAplicado: number;
}

@Injectable()
export class GiftcardsService {
  constructor(
    @InjectRepository(Giftcard)
    private readonly giftcards: Repository<Giftcard>,
    @InjectRepository(GiftcardMovimiento)
    private readonly movimientos: Repository<GiftcardMovimiento>,
  ) {}

  async emitir(
    dto: EmitirGiftcardDto,
    compradorId?: number,
  ): Promise<Giftcard> {
    const codigo = await this.generarCodigoUnico();
    const giftcard = await this.giftcards.save(
      this.giftcards.create({
        codigo,
        montoInicial: dto.montoInicial,
        saldo: dto.montoInicial,
        compradorId: compradorId ?? null,
        emailDestinatario: dto.emailDestinatario ?? null,
        mensaje: dto.mensaje ?? null,
        expiraEn: dto.expiraEn ?? null,
        estado: 'activa',
      }),
    );

    await this.movimientos.save(
      this.movimientos.create({
        giftcardId: giftcard.id,
        ordenId: null,
        monto: dto.montoInicial,
        saldoResultante: dto.montoInicial,
      }),
    );

    return giftcard;
  }

  async consultarSaldo(
    codigo: string,
  ): Promise<{ saldo: number; estado: string }> {
    const giftcard = await this.giftcards.findOne({ where: { codigo } });
    if (!giftcard) throw new NotFoundException('Giftcard no encontrada');
    return { saldo: giftcard.saldo, estado: giftcard.estado };
  }

  async listarAdmin(): Promise<Giftcard[]> {
    return this.giftcards.find({ order: { creadoEn: 'DESC' } });
  }

  /**
   * Canje dentro de la transacción del checkout: SELECT ... FOR UPDATE serializa
   * el descuento de saldo (mismo patrón que el stock, ver stock.util.ts) — dos
   * canjes concurrentes de la misma giftcard nunca la dejan en saldo negativo
   * (además hay un CHECK a nivel de BD como red de seguridad).
   */
  async validarYCanjear(
    manager: EntityManager,
    codigo: string,
    montoDeseado: number,
    ordenId: number,
  ): Promise<ResultadoGiftcard> {
    const giftcard = await manager
      .createQueryBuilder(Giftcard, 'g')
      .setLock('pessimistic_write')
      .where('g.codigo = :codigo', { codigo })
      .getOne();

    if (!giftcard) throw new NotFoundException('Giftcard no válida');
    if (giftcard.estado !== 'activa') {
      throw new BadRequestException('Esta giftcard no está activa');
    }
    if (giftcard.expiraEn && new Date(giftcard.expiraEn) < new Date()) {
      throw new BadRequestException('Esta giftcard está expirada');
    }
    if (giftcard.saldo <= 0) {
      throw new BadRequestException('Esta giftcard no tiene saldo disponible');
    }

    const montoAplicado = Math.min(giftcard.saldo, montoDeseado);
    const saldoResultante = giftcard.saldo - montoAplicado;

    await manager.update(
      Giftcard,
      { id: giftcard.id },
      {
        saldo: saldoResultante,
        estado: saldoResultante === 0 ? 'agotada' : giftcard.estado,
      },
    );

    await manager.save(
      manager.create(GiftcardMovimiento, {
        giftcardId: giftcard.id,
        ordenId,
        monto: -montoAplicado,
        saldoResultante,
      }),
    );

    return { giftcardId: giftcard.id, montoAplicado };
  }

  private async generarCodigoUnico(): Promise<string> {
    for (let intento = 0; intento < 5; intento++) {
      const codigo = `GC-${randomBytes(6).toString('hex').toUpperCase()}`;
      const existente = await this.giftcards.findOne({ where: { codigo } });
      if (!existente) return codigo;
    }
    throw new Error('No se pudo generar un código de giftcard único');
  }
}
