import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Orden } from './orden.entity';

export type Pasarela = 'webpay' | 'mercadopago' | 'transferencia' | 'giftcard';
export type EstadoPago =
  | 'iniciado'
  | 'autorizado'
  | 'rechazado'
  | 'anulado'
  | 'reembolsado'
  | 'expirado';

/** PCI: jamás guardar PAN/CVV/expiración. Solo últimos4 + tipo + código de autorización. */
@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true })
  ordenId: number;

  @ManyToOne(() => Orden)
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Column({
    type: 'enum',
    enum: ['webpay', 'mercadopago', 'transferencia', 'giftcard'],
  })
  pasarela: Pasarela;

  @Index('idx_pago_token')
  @Column({
    name: 'token_pasarela',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  tokenPasarela: string | null;

  @Index('idx_pago_estado')
  @Column({
    type: 'enum',
    enum: [
      'iniciado',
      'autorizado',
      'rechazado',
      'anulado',
      'reembolsado',
      'expirado',
    ],
    default: 'iniciado',
  })
  estado: EstadoPago;

  /** Monto enviado a la pasarela: validar SIEMPRE contra la respuesta (anti manipulación) */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  monto: number;

  @Column({
    name: 'codigo_autorizacion',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  codigoAutorizacion: string | null;

  @Column({ name: 'tipo_tarjeta', type: 'varchar', length: 20, nullable: true })
  tipoTarjeta: string | null;

  @Column({ type: 'char', length: 4, nullable: true })
  ultimos4: string | null;

  @Column({ name: 'respuesta_raw', type: 'json', nullable: true })
  respuestaRaw: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @Column({ name: 'confirmado_en', type: 'datetime', nullable: true })
  confirmadoEn: Date | null;
}
