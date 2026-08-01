import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tallas')
export class Talla {
  @PrimaryGeneratedColumn({ type: 'tinyint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 10, unique: true })
  codigo: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  orden: number;
}
