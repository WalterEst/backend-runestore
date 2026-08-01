import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EstadoCampana = 'borrador' | 'programada' | 'enviada';

@Entity('newsletter_campanas')
export class NewsletterCampana {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  asunto: string;

  @Column({ name: 'contenido_html', type: 'mediumtext' })
  contenidoHtml: string;

  @Column({
    type: 'enum',
    enum: ['borrador', 'programada', 'enviada'],
    default: 'borrador',
  })
  estado: EstadoCampana;

  @Column({ name: 'programada_para', type: 'datetime', nullable: true })
  programadaPara: Date | null;

  @Column({ name: 'enviada_en', type: 'datetime', nullable: true })
  enviadaEn: Date | null;

  @Column({ name: 'total_enviados', type: 'int', unsigned: true, default: 0 })
  totalEnviados: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
