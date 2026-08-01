import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Orden } from './orden.entity';

export type TipoBoleta = 'boleta' | 'factura';
export type EstadoBoleta = 'pendiente' | 'emitida' | 'anulada';

/** Job asíncrono post-pago. Un error de boleta JAMÁS revierte o bloquea un pago. */
@Entity('boletas')
export class Boleta {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true, unique: true })
  ordenId: number;

  @OneToOne(() => Orden)
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Column({ type: 'enum', enum: ['boleta', 'factura'], default: 'boleta' })
  tipo: TipoBoleta;

  /** Folio SII del emisor electrónico; NULL hasta emitir */
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  folio: number | null;

  @Column({ name: 'rut_receptor', type: 'varchar', length: 12, nullable: true })
  rutReceptor: string | null;

  @Column({
    name: 'razon_social',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  razonSocial: string | null;

  /** neto = ROUND(total / 1.19); iva = total - neto */
  @Column({
    name: 'monto_neto',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  montoNeto: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  iva: number;

  @Column({
    name: 'monto_total',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  montoTotal: number;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'emitida', 'anulada'],
    default: 'pendiente',
  })
  estado: EstadoBoleta;

  @Column({ name: 'emitida_en', type: 'datetime', nullable: true })
  emitidaEn: Date | null;
}
