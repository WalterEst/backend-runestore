import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ResenasService } from './resenas.service';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Resena } from '../database/entities/resena.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    createQueryBuilder: jest.fn(),
  };
}

describe('ResenasService', () => {
  let service: ResenasService;
  let resenasRepo: ReturnType<typeof crearMockRepo>;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let ordenItemsRepo: ReturnType<typeof crearMockRepo>;

  const DTO_BASE = { productoId: 10, ordenId: 100, puntuacion: 5 };

  beforeEach(async () => {
    resenasRepo = crearMockRepo();
    ordenesRepo = crearMockRepo();
    ordenItemsRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResenasService,
        { provide: getRepositoryToken(Resena), useValue: resenasRepo },
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        { provide: getRepositoryToken(OrdenItem), useValue: ordenItemsRepo },
      ],
    }).compile();

    service = moduleRef.get(ResenasService);
  });

  it('crea la reseña cuando la orden es del usuario, está confirmada y contiene el producto', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      usuarioId: 1,
      estado: 'entregada',
    });
    ordenItemsRepo.createQueryBuilder.mockReturnValueOnce({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ talla: 'M' }),
    });

    const resena = await service.crear(1, DTO_BASE);

    expect(resenasRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        productoId: 10,
        usuarioId: 1,
        tallaComprada: 'M',
        aprobada: false,
      }),
    );
    expect(resena).toBeDefined();
  });

  it('rechaza si la orden no pertenece al usuario (anti-IDOR)', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      usuarioId: 999,
      estado: 'entregada',
    });
    await expect(service.crear(1, DTO_BASE)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza si la orden no está en un estado de compra confirmada', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      usuarioId: 1,
      estado: 'pendiente_pago',
    });
    await expect(service.crear(1, DTO_BASE)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza si la orden no contiene el producto reseñado', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      usuarioId: 1,
      estado: 'entregada',
    });
    ordenItemsRepo.createQueryBuilder.mockReturnValueOnce({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    await expect(service.crear(1, DTO_BASE)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('traduce la violación de UNIQUE (una reseña por usuario por producto) a ConflictException', async () => {
    ordenesRepo.findOne.mockResolvedValueOnce({
      id: 100,
      usuarioId: 1,
      estado: 'entregada',
    });
    ordenItemsRepo.createQueryBuilder.mockReturnValueOnce({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ talla: 'M' }),
    });
    resenasRepo.save.mockRejectedValueOnce(
      new QueryFailedError('insert', [], new Error('dup')),
    );

    await expect(service.crear(1, DTO_BASE)).rejects.toThrow(ConflictException);
  });

  it('lanza NotFoundException al moderar una reseña inexistente', async () => {
    resenasRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.moderar(999, true)).rejects.toThrow(NotFoundException);
  });
});
