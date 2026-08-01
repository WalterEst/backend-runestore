import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CuponesService } from './cupones.service';
import { Cupon } from '../database/entities/cupon.entity';
import { CuponUso } from '../database/entities/cupon-uso.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

const CUPON_VIGENTE = {
  id: 1,
  codigo: 'NARUTO20',
  tipo: 'porcentaje' as const,
  valor: 20,
  montoMinimo: null,
  limiteUsosTotal: 100,
  limitePorUsuario: 1,
  fechaInicio: new Date(Date.now() - 86400000),
  fechaFin: new Date(Date.now() + 86400000),
  activo: true,
  usosActuales: 0,
};

describe('CuponesService', () => {
  let service: CuponesService;
  let cuponesRepo: ReturnType<typeof crearMockRepo>;
  let usosRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    cuponesRepo = crearMockRepo();
    usosRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CuponesService,
        { provide: getRepositoryToken(Cupon), useValue: cuponesRepo },
        { provide: getRepositoryToken(CuponUso), useValue: usosRepo },
      ],
    }).compile();

    service = moduleRef.get(CuponesService);
  });

  describe('previsualizar', () => {
    it('calcula el descuento porcentual sin canjear', async () => {
      cuponesRepo.findOne.mockResolvedValueOnce({ ...CUPON_VIGENTE });
      const resultado = await service.previsualizar('NARUTO20', 10000);
      expect(resultado).toEqual({ cuponId: 1, descuento: 2000 });
    });

    it('rechaza un cupón inexistente', async () => {
      cuponesRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.previsualizar('NOEXISTE', 10000)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza si no llega al monto mínimo', async () => {
      cuponesRepo.findOne.mockResolvedValueOnce({
        ...CUPON_VIGENTE,
        montoMinimo: 50000,
      });
      await expect(service.previsualizar('NARUTO20', 10000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un cupón fuera de vigencia', async () => {
      cuponesRepo.findOne.mockResolvedValueOnce({
        ...CUPON_VIGENTE,
        fechaFin: new Date(Date.now() - 1000),
      });
      await expect(service.previsualizar('NARUTO20', 10000)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validarYCanjear', () => {
    function crearManagerMock(
      overrides: { affected?: number; usosUsuario?: number } = {},
    ) {
      const cuponesRepoManager = {
        findOne: jest.fn().mockResolvedValue({ ...CUPON_VIGENTE }),
      };
      const usosRepoManager = {
        count: jest.fn().mockResolvedValue(overrides.usosUsuario ?? 0),
      };
      return {
        getRepository: jest.fn((entity) =>
          entity === Cupon ? cuponesRepoManager : usosRepoManager,
        ),
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest
            .fn()
            .mockResolvedValue({ affected: overrides.affected ?? 1 }),
        })),
        save: jest.fn(async (v) => v),
        create: jest.fn((_entity, v) => v),
      };
    }

    it('canjea con éxito: incrementa usos_actuales atómicamente y registra cupon_usos', async () => {
      const manager = crearManagerMock({ affected: 1 });

      const resultado = await service.validarYCanjear(
        manager as any,
        'NARUTO20',
        5,
        100,
        10000,
      );

      expect(resultado).toEqual({ cuponId: 1, descuento: 2000 });
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ cuponId: 1, usuarioId: 5, ordenId: 100 }),
      );
    });

    it('se rechaza atómicamente cuando el UPDATE condicionado no afecta filas (límite ya alcanzado por otra transacción concurrente)', async () => {
      const manager = crearManagerMock({ affected: 0 });

      await expect(
        service.validarYCanjear(manager as any, 'NARUTO20', 5, 100, 10000),
      ).rejects.toThrow(BadRequestException);

      // No debe registrar el uso si el incremento no tomó efecto
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rechaza si el usuario ya alcanzó su límite personal de usos', async () => {
      const manager = crearManagerMock({ usosUsuario: 1 }); // limitePorUsuario del cupón es 1

      await expect(
        service.validarYCanjear(manager as any, 'NARUTO20', 5, 100, 10000),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
