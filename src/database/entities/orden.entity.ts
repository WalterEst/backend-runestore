import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Usuario } from './usuario.entity';
import { Cupon } from './cupon.entity';
import { Giftcard } from './giftcard.entity';

export type EstadoOrden =
  | 'pendiente_pago'
  | 'pagada'
  | 'en_preparacion'
  | 'enviada'
  | 'entregada'
  | 'cancelada'
  | 'reembolsada'
  | 'expirada';

@Entity('ordenes')
@Index('idx_orden_estado', ['estado'])
@Index('idx_orden_fecha', ['creadoEn'])
@Index('idx_orden_email', ['emailComprador'])
export class Orden {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  /** Correlativo humano (ORD-2026-00153): se usa como buyOrder en Webpay. Nunca reutilizar. */
  @Column({ name: 'numero_orden', type: 'varchar', length: 20, unique: true })
  numeroOrden: string;

  /** NULL = compra de invitado (guest checkout) */
  @Column({
    name: 'usuario_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ name: 'email_comprador', type: 'varchar', length: 191 })
  emailComprador: string;

  @Column({ name: 'nombre_comprador', type: 'varchar', length: 160 })
  nombreComprador: string;

  @Column({
    name: 'telefono_comprador',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  telefonoComprador: string | null;

  @Column({
    name: 'rut_comprador',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  rutComprador: string | null;

  /** Token para que el invitado consulte su orden sin login (/orden?token=...) */
  @Index('idx_orden_token', { unique: true })
  @Column({ name: 'token_consulta', type: 'char', length: 64, nullable: true })
  tokenConsulta: string | null;

  @Column({
    type: 'enum',
    enum: [
      'pendiente_pago',
      'pagada',
      'en_preparacion',
      'enviada',
      'entregada',
      'cancelada',
      'reembolsada',
      'expirada',
    ],
    default: 'pendiente_pago',
  })
  estado: EstadoOrden;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    default: 0,
    transformer: moneyTransformer,
  })
  descuento: number;

  @Column({
    name: 'costo_envio',
    type: 'decimal',
    precision: 10,
    scale: 0,
    default: 0,
    transformer: moneyTransformer,
  })
  costoEnvio: number;

  /** Monto final. DEBE cuadrar con pagos.monto autorizado — nunca confiar en el precio del cliente */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  total: number;

  @Column({ name: 'cupon_id', type: 'bigint', unsigned: true, nullable: true })
  cuponId: number | null;

  @ManyToOne(() => Cupon, { nullable: true })
  @JoinColumn({ name: 'cupon_id' })
  cupon: Cupon | null;

  @Column({
    name: 'giftcard_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  giftcardId: number | null;

  @ManyToOne(() => Giftcard, { nullable: true })
  @JoinColumn({ name: 'giftcard_id' })
  giftcard: Giftcard | null;

  /** Copia inmutable de la dirección al momento de comprar */
  @Column({ name: 'direccion_envio_snapshot', type: 'json' })
  direccionEnvioSnapshot: Record<string, unknown>;

  @Column({
    name: 'notas_cliente',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  notasCliente: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;
}
