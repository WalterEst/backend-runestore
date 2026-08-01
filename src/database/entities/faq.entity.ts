import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('faqs')
export class Faq {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 60, default: 'general' })
  categoria: string;

  @Column({ type: 'varchar', length: 300 })
  pregunta: string;

  @Column({ type: 'text' })
  respuesta: string;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  orden: number;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  publicada: boolean;
}
