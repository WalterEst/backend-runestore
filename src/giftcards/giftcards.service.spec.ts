import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GiftcardsService } from './giftcards.service';
import { Giftcard } from '../database/entities/giftcard.entity';
import { GiftcardMovimiento } from '../database/entities/giftcard-movimiento.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

describe('GiftcardsService', () => {
  let service: GiftcardsService;
  let giftcardsRepo: ReturnType<typeof crearMockRepo>;
  let movimientosRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    giftcardsRepo = crearMockRepo();
    movimientosRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GiftcardsService,
        { provide: getRepositoryToken(Giftcard), useValue: giftcardsRepo },
        {
          provide: getRepositoryToken(GiftcardMovimiento),
          useValue: movimientosRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(GiftcardsService);
  });

  describe('emitir', () => {
    it('genera un código único y registra el movimiento inicial', async () => {
      giftcardsRepo.findOne.mockResolvedValueOnce(null); // código disponible

      const giftcard = await service.emitir({ montoInicial: 20000 });

      expect(giftcardsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          montoInicial: 20000,
          saldo: 20000,
          estado: 'activa',
        }),
      );
      expect(movimientosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 20000, saldoResultante: 20000 }),
      );
      expect(giftcard.codigo).toMatch(/^GC-/);
    });
  });

  describe('validarYCanjear', () => {
    function crearManagerMock(giftcard: Partial<Giftcard> | null) {
      return {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(giftcard),
        })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (v) => v),
        create: jest.fn((_entity, v) => v),
      };
    }

    it('aplica solo hasta el saldo disponible (nunca más de lo que tiene)', async () => {
      const manager = crearManagerMock({
        id: 1,
        saldo: 5000,
        estado: 'activa',
        expiraEn: null,
      });

      const resultado = await service.validarYCanjear(
        manager as any,
        'GC-ABC',
        10000,
        50,
      );

      expect(resultado).toEqual({ giftcardId: 1, montoAplicado: 5000 });
      expect(manager.update).toHaveBeenCalledWith(
        Giftcard,
        { id: 1 },
        { saldo: 0, estado: 'agotada' },
      );
    });

    it('aplica el monto deseado si hay saldo suficiente, sin agotarla', async () => {
      const manager = crearManagerMock({
        id: 1,
        saldo: 20000,
        estado: 'activa',
        expiraEn: null,
      });

      const resultado = await service.validarYCanjear(
        manager as any,
        'GC-ABC',
        5000,
        50,
      );

      expect(resultado).toEqual({ giftcardId: 1, montoAplicado: 5000 });
      expect(manager.update).toHaveBeenCalledWith(
        Giftcard,
        { id: 1 },
        { saldo: 15000, estado: 'activa' },
      );
    });

    it('rechaza una giftcard inexistente', async () => {
      const manager = crearManagerMock(null);
      await expect(
        service.validarYCanjear(manager as any, 'GC-NOEXISTE', 1000, 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza una giftcard bloqueada o expirada', async () => {
      const manager = crearManagerMock({
        id: 1,
        saldo: 1000,
        estado: 'bloqueada',
        expiraEn: null,
      });
      await expect(
        service.validarYCanjear(manager as any, 'GC-ABC', 500, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una giftcard sin saldo', async () => {
      const manager = crearManagerMock({
        id: 1,
        saldo: 0,
        estado: 'agotada',
        expiraEn: null,
      });
      await expect(
        service.validarYCanjear(manager as any, 'GC-ABC', 500, 50),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
