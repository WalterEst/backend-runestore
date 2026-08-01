import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { EmailService } from '../common/email/email.service';
import { CrearEnvioDto } from './dto/envio.dto';

const ESTADOS_ORDEN_QUE_ADMITEN_ENVIO = ['pagada', 'en_preparacion'];

@Injectable()
export class EnviosService {
  constructor(
    @InjectRepository(Envio) private readonly envios: Repository<Envio>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    private readonly emailService: EmailService,
  ) {}

  async crear(ordenId: number, dto: CrearEnvioDto): Promise<Envio> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (!ESTADOS_ORDEN_QUE_ADMITEN_ENVIO.includes(orden.estado)) {
      throw new BadRequestException(
        `La orden está en estado "${orden.estado}" y no admite generar un envío`,
      );
    }

    const existente = await this.envios.findOne({ where: { ordenId } });
    if (existente)
      throw new ConflictException('Esta orden ya tiene un envío generado');

    const envio = await this.envios.save(
      this.envios.create({
        ordenId,
        courier: dto.courier,
        numeroSeguimiento: dto.numeroSeguimiento ?? null,
        etiquetaUrl: dto.etiquetaUrl ?? null,
        estado: 'preparacion',
      }),
    );

    if (orden.estado !== 'en_preparacion') {
      await this.ordenes.update({ id: ordenId }, { estado: 'en_preparacion' });
    }

    return envio;
  }

  async despachar(envioId: number): Promise<Envio> {
    const envio = await this.obtener(envioId);
    envio.estado = 'despachado';
    envio.despachadoEn = new Date();
    await this.envios.save(envio);

    const orden = await this.ordenes.findOne({ where: { id: envio.ordenId } });
    if (orden) {
      await this.ordenes.update({ id: orden.id }, { estado: 'enviada' });
      this.emailService.enviarDespacho(
        orden.emailComprador,
        orden.numeroOrden,
        envio.courier,
        envio.numeroSeguimiento,
      );
    }

    return envio;
  }

  async marcarEntregado(envioId: number): Promise<Envio> {
    const envio = await this.obtener(envioId);
    envio.estado = 'entregado';
    envio.entregadoEn = new Date();
    await this.envios.save(envio);
    await this.ordenes.update({ id: envio.ordenId }, { estado: 'entregada' });
    return envio;
  }

  async listar(): Promise<Envio[]> {
    return this.envios.find({ order: { id: 'DESC' }, take: 200 });
  }

  async obtenerPorOrden(ordenId: number): Promise<Envio | null> {
    return this.envios.findOne({ where: { ordenId } });
  }

  private async obtener(id: number): Promise<Envio> {
    const envio = await this.envios.findOne({ where: { id } });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    return envio;
  }
}
