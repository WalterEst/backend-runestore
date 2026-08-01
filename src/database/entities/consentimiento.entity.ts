import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pagina } from './pagina.entity';
import { Usuario } from './usuario.entity';

export type FinalidadConsentimiento =
  'terminos_condiciones' | 'politica_privacidad' | 'marketing' | 'cookies';

/** Prueba de consentimiento informado por finalidad — Ley 21.719. Ver CLAUDE.md. */
@Entity('consentimientos')
@Index('idx_cons_email', ['email', 'finalidad'])
export class Consentimiento {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'usuario_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ type: 'varchar', length: 191 })
  email: string;

  @Column({
    type: 'enum',
    enum: [
      'terminos_condiciones',
      'politica_privacidad',
      'marketing',
      'cookies',
    ],
  })
  finalidad: FinalidadConsentimiento;

  @Column({ name: 'pagina_id', type: 'int', unsigned: true, nullable: true })
  paginaId: number | null;

  @ManyToOne(() => Pagina, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pagina_id' })
  pagina: Pagina | null;

  @Column({ type: 'smallint', unsigned: true })
  version: number;

  /** 1 = otorgado, 0 = revocado. La revocación también se registra (nunca se sobrescribe). */
  @Column({
    type: 'tinyint',

    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  otorgado: boolean;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
