import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** IDEMPOTENCIA de notificaciones de pago: UNIQUE(pasarela, evento_id) impide procesar 2 veces el mismo pago */
@Entity('webhooks_log')
@Unique('uq_webhook_evento', ['pasarela', 'eventoId'])
export class WebhookLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'enum', enum: ['webpay', 'mercadopago'] })
  pasarela: 'webpay' | 'mercadopago';

  @Column({ name: 'evento_id', type: 'varchar', length: 100 })
  eventoId: string;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  procesado: boolean;

  @CreateDateColumn({ name: 'recibido_en', type: 'datetime' })
  recibidoEn: Date;
}
