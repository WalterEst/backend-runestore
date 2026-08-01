import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Anuncio } from '../database/entities/anuncio.entity';
import { CrearAnuncioDto } from './dto/anuncio.dto';

@Injectable()
export class AnunciosService {
  constructor(
    @InjectRepository(Anuncio) private readonly anuncios: Repository<Anuncio>,
  ) {}

  /** El popup público solo muestra el anuncio activo más reciente (a lo más uno a la vez) */
  async obtenerActivo(): Promise<Anuncio | null> {
    return this.anuncios.findOne({
      where: { activo: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async listarAdmin(): Promise<Anuncio[]> {
    return this.anuncios.find({ order: { creadoEn: 'DESC' } });
  }

  /** Crear un anuncio nuevo lo deja como el único activo (reemplaza al anterior en el popup) */
  async crear(dto: CrearAnuncioDto): Promise<Anuncio> {
    await this.anuncios.update({ activo: true }, { activo: false });
    return this.anuncios.save(
      this.anuncios.create({ imagenUrl: dto.imagenUrl, activo: true }),
    );
  }

  /** Al reactivar un anuncio antiguo, se desactivan los demás (invariante: uno activo a la vez) */
  async toggleActivo(id: number): Promise<Anuncio> {
    const anuncio = await this.anuncios.findOne({ where: { id } });
    if (!anuncio) throw new NotFoundException('Anuncio no encontrado');

    if (!anuncio.activo) {
      await this.anuncios.update({ activo: true }, { activo: false });
    }
    anuncio.activo = !anuncio.activo;
    return this.anuncios.save(anuncio);
  }

  async eliminar(id: number): Promise<void> {
    const resultado = await this.anuncios.delete({ id });
    if (!resultado.affected) throw new NotFoundException('Anuncio no encontrado');
  }
}
