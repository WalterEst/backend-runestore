import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Imagen promocional a pantalla completa que se muestra al entrar al sitio (ver anuncios.service.ts) */
@Entity('anuncios')
export class Anuncio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'imagen_url', type: 'varchar', length: 500 })
  imagenUrl: string;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
