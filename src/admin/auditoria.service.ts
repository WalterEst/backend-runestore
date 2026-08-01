import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoria: Repository<Auditoria>,
  ) {}

  async listar(entidad?: string): Promise<Auditoria[]> {
    return this.auditoria.find({
      where: entidad ? { entidad } : {},
      order: { creadoEn: 'DESC' },
      take: 200,
    });
  }
}
