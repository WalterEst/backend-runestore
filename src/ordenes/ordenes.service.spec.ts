import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Boleta } from '../database/entities/boleta.entity';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { CuponesService } from '../cupones/cupones.service';
import { GiftcardsService } from '../giftcards/giftcards.service';
import { PromocionesService } from '../promociones/promociones.service';

function crearMockRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v) => v),
  };
}

describe('OrdenesService (admin)', () => {
  let service: OrdenesService;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let auditoriaRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    ordenesRepo = crearMockRepo();
    auditoriaRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdenesService,
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        {
          provide: getRepositoryToken(ReservaStock),
          useValue: crearMockRepo(),
        },
        { provide: getRepositoryToken(OrdenItem), useValue: crearMockRepo() },
        { provide: getRepositoryToken(Envio), useValue: crearMockRepo() },
        { provide: getRepositoryToken(Boleta), useValue: crearMockRepo() },
        { provide: getRepositoryToken(Auditoria), useValue: auditoriaRepo },
        { provide: getDataSourceToken(), useValue: {} },
        { provide: CuponesService, useValue: {} },
        { provide: GiftcardsService, useValue: {} },
        { provide: PromocionesService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(OrdenesService);
  });

  it('listarAdmin filtra por estado cuando se indica', async () => {
    ordenesRepo.find.mockResolvedValueOnce([]);
    await service.listarAdmin('pagada');
    expect(ordenesRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'pagada' } }),
    );
  });

  it('obtenerAdmin lanza NotFoundException si la orden no existe', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.obtenerAdmin(999)).rejects.toThrow(NotFoundException);
  });

  it('cancelar rechaza órdenes que ya no están pendientes de pago', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({ id: 1, estado: 'pagada' });
    await expect(service.cancelar(1, 'motivo', 5)).rejects.toThrow(
      BadRequestException,
    );
    expect(ordenesRepo.update).not.toHaveBeenCalled();
  });

  it('cancelar actualiza el estado y registra auditoría', async () => {
    ordenesRepo.findOne
      .mockResolvedValueOnce({
        id: 1,
        estado: 'pendiente_pago',
        numeroOrden: 'ORD-1',
      })
      .mockResolvedValueOnce({ id: 1, estado: 'cancelada' });

    await service.cancelar(1, 'Cliente se arrepintió', 5, '1.2.3.4');

    expect(ordenesRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      { estado: 'cancelada' },
    );
    expect(auditoriaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'cancelar_orden', usuarioId: 5 }),
    );
  });
});
