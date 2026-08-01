import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Privacidad, envíos, cambios, términos. Al subir versión se dispara re-aceptación de consentimiento. */
@Entity('paginas')
export class Pagina {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  titulo: string;

  @Column({ type: 'mediumtext' })
  contenido: string;

  /** Saber QUÉ política aceptó el cliente (valor legal) */
  @Column({ type: 'smallint', unsigned: true, default: 1 })
  version: number;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  publicada: boolean;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;
}
