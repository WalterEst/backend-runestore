import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { Orden } from '../database/entities/orden.entity';
import { Pago } from '../database/entities/pago.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { WebpayService } from '../common/webpay/webpay.service';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 99, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('PagosService', () => {
  let service: PagosService;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let pagosRepo: ReturnType<typeof crearMockRepo>;
  let webpayService: { crear: jest.Mock; confirmar: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const ORDEN_BASE: Partial<Orden> = {
    id: 1,
    numeroOrden: 'ORD-2026-ABCDE',
    usuarioId: 10,
    estado: 'pendiente_pago',
    total: 19990,
    tokenConsulta: 'token-invitado-xyz',
  };

  beforeEach(async () => {
    ordenesRepo = crearMockRepo();
    pagosRepo = crearMockRepo();
    webpayService = { crear: jest.fn(), confirmar: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        { provide: getRepositoryToken(Pago), useValue: pagosRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: WebpayService, useValue: webpayService },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:3000/api/v1' },
        },
      ],
    }).compile();

    service = moduleRef.get(PagosService);
  });

  describe('iniciar', () => {
    it('crea la transacción en Webpay y guarda el pago con estado iniciado', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({ ...ORDEN_BASE });
      webpayService.crear.mockResolvedValueOnce({
        token: 'tok-123',
        url: 'https://webpay/init',
      });

      const resultado = await service.iniciar(1, { usuarioId: 10 }, undefined);

      expect(webpayService.crear).toHaveBeenCalledWith(
        'ORD-2026-ABCDE',
        'orden-1',
        19990,
        expect.stringContaining('/pagos/webpay/retorno'),
      );
      expect(pagosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenPasarela: 'tok-123',
          estado: 'iniciado',
          monto: 19990,
        }),
      );
      expect(resultado).toEqual({
        urlPago: 'https://webpay/init',
        token: 'tok-123',
      });
    });

    it('rechaza si la orden no pertenece al usuario', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({
        ...ORDEN_BASE,
        usuarioId: 999,
      });
      await expect(
        service.iniciar(1, { usuarioId: 10 }, undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a un invitado con el token_consulta correcto', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({
        ...ORDEN_BASE,
        usuarioId: null,
      });
      webpayService.crear.mockResolvedValueOnce({
        token: 'tok-456',
        url: 'https://webpay/init',
      });

      const resultado = await service.iniciar(1, {}, 'token-invitado-xyz');
      expect(resultado.token).toBe('tok-456');
    });

    it('rechaza si la orden ya no está pendiente_pago', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({
        ...ORDEN_BASE,
        estado: 'pagada',
      });
      await expect(
        service.iniciar(1, { usuarioId: 10 }, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmar', () => {
    function mockManager(overrides: { ordenEstado?: string } = {}) {
      const updateCalls: unknown[][] = [];
      const manager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          numeroOrden: 'ORD-2026-ABCDE',
          usuarioId: 10,
          total: 19990,
          estado: overrides.ordenEstado ?? 'pendiente_pago',
        }),
        find: jest.fn().mockResolvedValue([{ varianteId: 5, cantidad: 1 }]),
        update: jest.fn((...args: unknown[]) => {
          updateCalls.push(args);
          return Promise.resolve({ affected: 1 });
        }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (_e, v) => v),
        create: jest.fn((_e, v) => v),
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        })),
      };
      return { manager, updateCalls };
    }

    it('aprueba el pago: orden pagada, stock descontado, reserva liberada, total_compras+1', async () => {
      pagosRepo.findOne.mockResolvedValueOnce({
        id: 1,
        ordenId: 1,
        estado: 'iniciado',
      });
      webpayService.confirmar.mockResolvedValueOnce({
        amount: 19990,
        status: 'AUTHORIZED',
        responseCode: 0,
        buyOrder: 'ORD-2026-ABCDE',
        authorizationCode: '123456',
        paymentTypeCode: 'VD',
        cardDetail: { cardNumber: '6623' },
        raw: { response_code: 0, status: 'AUTHORIZED' },
      });
      const { manager } = mockManager();
      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const resultado = await service.confirmar('tok-ok');

      expect(resultado).toEqual({
        aprobado: true,
        numeroOrden: 'ORD-2026-ABCDE',
      });
      expect(manager.update).toHaveBeenCalledWith(
        Pago,
        { id: 1 },
        expect.objectContaining({ estado: 'autorizado' }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        Orden,
        { id: 1 },
        { estado: 'pagada' },
      );
      expect(manager.delete).toHaveBeenCalledWith(ReservaStock, { ordenId: 1 });

      // Boleta queda "pendiente" (la emite el cron asíncrono de la Fase 6) con neto/iva correctos
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ordenId: 1,
          estado: 'pendiente',
          montoNeto: 16798,
          iva: 3192,
          montoTotal: 19990,
        }),
      );
    });

    it('rechaza el pago si response_code !== 0 y deja la orden pendiente_pago', async () => {
      pagosRepo.findOne.mockResolvedValueOnce({
        id: 2,
        ordenId: 1,
        estado: 'iniciado',
      });
      webpayService.confirmar.mockResolvedValueOnce({
        amount: 19990,
        status: 'FAILED',
        responseCode: -1,
        buyOrder: 'ORD-2026-ABCDE',
        raw: { response_code: -1, status: 'FAILED' },
      });
      const { manager } = mockManager();
      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const resultado = await service.confirmar('tok-rechazado');

      expect(resultado.aprobado).toBe(false);
      expect(manager.update).toHaveBeenCalledWith(
        Pago,
        { id: 2 },
        expect.objectContaining({ estado: 'rechazado' }),
      );
      // La orden NUNCA se toca cuando el pago no aprueba
      expect(manager.update).not.toHaveBeenCalledWith(
        Orden,
        expect.anything(),
        expect.objectContaining({ estado: 'pagada' }),
      );
    });

    it('rechaza si el monto de la pasarela no coincide con el total de la orden (manipulación)', async () => {
      pagosRepo.findOne.mockResolvedValueOnce({
        id: 3,
        ordenId: 1,
        estado: 'iniciado',
      });
      webpayService.confirmar.mockResolvedValueOnce({
        amount: 1, // manipulado: la orden vale 19990
        status: 'AUTHORIZED',
        responseCode: 0,
        buyOrder: 'ORD-2026-ABCDE',
        raw: {},
      });
      const { manager } = mockManager();
      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const resultado = await service.confirmar('tok-monto-malo');

      expect(resultado.aprobado).toBe(false);
      expect(resultado.motivoRechazo).toMatch(/[Mm]onto/);
    });

    it('es idempotente: si el pago ya fue procesado, no vuelve a confirmar contra Webpay', async () => {
      pagosRepo.findOne.mockResolvedValueOnce({
        id: 4,
        ordenId: 1,
        estado: 'autorizado',
      });
      ordenesRepo.findOne.mockResolvedValueOnce({
        id: 1,
        numeroOrden: 'ORD-2026-ABCDE',
      });

      const resultado = await service.confirmar('tok-ya-procesado');

      expect(webpayService.confirmar).not.toHaveBeenCalled();
      expect(resultado).toEqual({
        aprobado: true,
        numeroOrden: 'ORD-2026-ABCDE',
      });
    });

    it('lanza NotFoundException si el token no corresponde a ningún pago', async () => {
      pagosRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.confirmar('tok-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
