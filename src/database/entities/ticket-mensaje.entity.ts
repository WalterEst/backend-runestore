import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { Usuario } from './usuario.entity';

@Entity('ticket_mensajes')
export class TicketMensaje {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'ticket_id', type: 'bigint', unsigned: true })
  ticketId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  /** Sanitizar con sanitize-html antes de guardar */
  @Column({ type: 'text' })
  mensaje: string;

  /** URL prefirmada de lectura corta en R2 (prefijo /tickets/) — contiene datos personales */
  @Column({ name: 'adjunto_url', type: 'varchar', length: 500, nullable: true })
  adjuntoUrl: string | null;

  /** Notas privadas entre agentes, invisibles al cliente */
  @Column({
    name: 'es_interno',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  esInterno: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
