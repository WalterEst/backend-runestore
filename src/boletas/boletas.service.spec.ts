import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BoletasService } from './boletas.service';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { DteNoConfiguradoError, DteService } from '../common/dte/dte.service';
import { EmailService } from '../common/email/email.service';

function crearMockRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('BoletasService', () => {
  let service: BoletasService;
  let boletasRepo: ReturnType<typeof crearMockRepo>;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let ordenItemsRepo: ReturnType<typeof crearMockRepo>;
  let dteService: { emitirBoleta: jest.Mock };
  let emailService: { enviarBoletaEmitida: jest.Mock };

  const BOLETA_PENDIENTE: Partial<Boleta> = {
    id: 1,
    ordenId: 100,
    montoNeto: 16798,
    iva: 3192,
    montoTotal: 19990,
    rutReceptor: null,
    razonSocial: null,
    estado: 'pendiente',
  };

  beforeEach(async () => {
    boletasRepo = crearMockRepo();
    ordenesRepo = crearMockRepo();
    ordenItemsRepo = crearMockRepo();
    dteService = { emitirBoleta: jest.fn() };
    emailService = { enviarBoletaEmitida: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BoletasService,
        { provide: getRepositoryToken(Boleta), useValue: boletasRepo },
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        { provide: getRepositoryToken(OrdenItem), useValue: ordenItemsRepo },
        { provide: DteService, useValue: dteService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = moduleRef.get(BoletasService);
  });

  it('emite la boleta pendiente y notifica por email cuando el emisor DTE responde OK', async () => {
    boletasRepo.find.mockResolvedValueOnce([{ ...BOLETA_PENDIENTE }]);
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      numeroOrden: 'ORD-2026-ABCDE',
      emailComprador: 'cliente@rune.cl',
    });
    ordenItemsRepo.find.mockResolvedValueOnce([
      { nombreProducto: 'Polera Naruto', cantidad: 1, precioUnitario: 19990 },
    ]);
    dteService.emitirBoleta.mockResolvedValueOnce({
      folio: 555,
      pdfUrl: 'https://dte.example/boleta-555.pdf',
      raw: {},
    });

    await service.emitirPendientes();

    expect(boletasRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({
        folio: 555,
        estado: 'emitida',
        pdfUrl: 'https://dte.example/boleta-555.pdf',
      }),
    );
    expect(emailService.enviarBoletaEmitida).toHaveBeenCalledWith(
      'cliente@rune.cl',
      'ORD-2026-ABCDE',
      'https://dte.example/boleta-555.pdf',
    );
  });

  it('si el emisor DTE no está configurado, deja la boleta pendiente sin lanzar (el cron sigue vivo)', async () => {
    boletasRepo.find.mockResolvedValueOnce([{ ...BOLETA_PENDIENTE }]);
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      numeroOrden: 'ORD-2026-ABCDE',
      emailComprador: 'cliente@rune.cl',
    });
    ordenItemsRepo.find.mockResolvedValueOnce([]);
    dteService.emitirBoleta.mockRejectedValueOnce(new DteNoConfiguradoError());

    await expect(service.emitirPendientes()).resolves.toBeUndefined();

    expect(boletasRepo.update).not.toHaveBeenCalled();
    expect(emailService.enviarBoletaEmitida).not.toHaveBeenCalled();
  });

  it('un fallo del emisor en una boleta no impide procesar el resto de la cola', async () => {
    boletasRepo.find.mockResolvedValueOnce([
      { ...BOLETA_PENDIENTE, id: 1, ordenId: 100 },
      { ...BOLETA_PENDIENTE, id: 2, ordenId: 200 },
    ]);
    ordenesRepo.findOne
      .mockResolvedValueOnce({
        id: 100,
        numeroOrden: 'ORD-A',
        emailComprador: 'a@rune.cl',
      })
      .mockResolvedValueOnce({
        id: 200,
        numeroOrden: 'ORD-B',
        emailComprador: 'b@rune.cl',
      });
    ordenItemsRepo.find.mockResolvedValue([]);
    dteService.emitirBoleta
      .mockRejectedValueOnce(new Error('Timeout del emisor'))
      .mockResolvedValueOnce({
        folio: 2,
        pdfUrl: 'https://dte.example/2.pdf',
        raw: {},
      });

    await service.emitirPendientes();

    expect(boletasRepo.update).toHaveBeenCalledTimes(1);
    expect(boletasRepo.update).toHaveBeenCalledWith(
      { id: 2 },
      expect.objectContaining({ estado: 'emitida' }),
    );
  });
});
