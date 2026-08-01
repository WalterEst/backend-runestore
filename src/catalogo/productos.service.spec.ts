import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { Producto } from '../database/entities/producto.entity';
import { Categoria } from '../database/entities/categoria.entity';
import { Talla } from '../database/entities/talla.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { ProductoImagen } from '../database/entities/producto-imagen.entity';
import { HistorialPrecio } from '../database/entities/historial-precio.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(),
  };
}

describe('ProductosService', () => {
  let service: ProductosService;
  let productosRepo: ReturnType<typeof crearMockRepo>;
  let categoriasRepo: ReturnType<typeof crearMockRepo>;
  let tallasRepo: ReturnType<typeof crearMockRepo>;
  let variantesRepo: ReturnType<typeof crearMockRepo>;
  let imagenesRepo: ReturnType<typeof crearMockRepo>;
  let historialRepo: ReturnType<typeof crearMockRepo>;
  let movimientosRepo: ReturnType<typeof crearMockRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    productosRepo = crearMockRepo();
    categoriasRepo = crearMockRepo();
    tallasRepo = crearMockRepo();
    variantesRepo = crearMockRepo();
    imagenesRepo = crearMockRepo();
    historialRepo = crearMockRepo();
    movimientosRepo = crearMockRepo();
    dataSource = { transaction: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductosService,
        { provide: getRepositoryToken(Producto), useValue: productosRepo },
        { provide: getRepositoryToken(Categoria), useValue: categoriasRepo },
        { provide: getRepositoryToken(Talla), useValue: tallasRepo },
        {
          provide: getRepositoryToken(ProductoVariante),
          useValue: variantesRepo,
        },
        { provide: getRepositoryToken(ProductoImagen), useValue: imagenesRepo },
        {
          provide: getRepositoryToken(HistorialPrecio),
          useValue: historialRepo,
        },
        {
          provide: getRepositoryToken(MovimientoInventario),
          useValue: movimientosRepo,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(ProductosService);
  });

  describe('crear', () => {
    it('genera el slug automáticamente a partir del nombre', async () => {
      productosRepo.findOne.mockResolvedValueOnce(null);
      categoriasRepo.find.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      await service.crear({
        nombre: 'Polera Naruto',
        descripcion: 'Estampado DTF',
        precio: 19990,
        categoriaIds: [1, 2],
      });

      expect(productosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'polera-naruto' }),
      );
    });

    it('le agrega un sufijo numérico si el slug generado ya existe', async () => {
      productosRepo.findOne
        .mockResolvedValueOnce({ id: 9, slug: 'polera-naruto' }) // "polera-naruto" ocupado
        .mockResolvedValueOnce(null); // "polera-naruto-2" libre
      categoriasRepo.find.mockResolvedValueOnce([{ id: 1 }]);

      await service.crear({
        nombre: 'Polera Naruto',
        descripcion: 'x',
        precio: 1000,
        categoriaIds: [1],
      });

      expect(productosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'polera-naruto-2' }),
      );
    });

    it('rechaza si alguna categoría no existe', async () => {
      productosRepo.findOne.mockResolvedValueOnce(null);
      categoriasRepo.find.mockResolvedValueOnce([{ id: 1 }]); // pidió [1,2], solo existe 1
      await expect(
        service.crear({
          nombre: 'x',
          descripcion: 'x',
          precio: 1000,
          categoriaIds: [1, 2],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('actualizarPrecio', () => {
    it('actualiza el precio y completa la fila que insertó el trigger con usuario_id + motivo', async () => {
      const managerMock = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 5, precio: 10000, precioOferta: null }) // producto antes del update
          .mockResolvedValueOnce({ id: 5, precio: 12000, precioOferta: null }), // producto después
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        query: jest.fn().mockResolvedValue([{ id: 777 }]),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      const resultado = await service.actualizarPrecio(
        5,
        { precio: 12000, motivo: 'Ajuste de temporada' },
        usuarioIdDePrueba(),
      );

      expect(managerMock.update).toHaveBeenNthCalledWith(
        1,
        Producto,
        { id: 5 },
        { precio: 12000, precioOferta: null },
      );
      expect(managerMock.query).toHaveBeenCalledWith(
        'SELECT LAST_INSERT_ID() as id',
      );
      expect(managerMock.update).toHaveBeenNthCalledWith(
        2,
        HistorialPrecio,
        { id: 777 },
        { usuarioId: usuarioIdDePrueba(), motivo: 'Ajuste de temporada' },
      );
      expect(resultado.precio).toBe(12000);
    });

    it('no toca historial_precios si el precio no cambió realmente', async () => {
      const managerMock = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 5, precio: 10000, precioOferta: null })
          .mockResolvedValueOnce({ id: 5, precio: 10000, precioOferta: null }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        query: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      await service.actualizarPrecio(
        5,
        { precio: 10000, motivo: 'sin cambio real' },
        1,
      );

      expect(managerMock.query).not.toHaveBeenCalled();
      expect(managerMock.update).toHaveBeenCalledTimes(1); // solo el UPDATE de productos
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      const managerMock = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(),
        query: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      await expect(
        service.actualizarPrecio(999, { precio: 1000, motivo: 'x' }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('crearVariante', () => {
    it('rechaza SKU duplicado', async () => {
      productosRepo.findOne.mockResolvedValueOnce({ id: 1 });
      tallasRepo.findOne.mockResolvedValueOnce({ id: 3, codigo: 'M' });
      variantesRepo.findOne.mockResolvedValueOnce({
        id: 50,
        sku: 'POLE-M-NEG',
      });

      await expect(
        service.crearVariante(1, { tallaId: 3, sku: 'POLE-M-NEG', stock: 10 }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea la variante cuando todo es válido', async () => {
      productosRepo.findOne.mockResolvedValueOnce({ id: 1 });
      tallasRepo.findOne.mockResolvedValueOnce({ id: 3, codigo: 'M' });
      variantesRepo.findOne.mockResolvedValueOnce(null);

      const variante = await service.crearVariante(1, {
        tallaId: 3,
        sku: 'POLE-M-NEG',
        stock: 10,
      });

      expect(variantesRepo.save).toHaveBeenCalled();
      expect(variante).toBeDefined();
    });
  });

  describe('ajustarStock', () => {
    it('suma una entrada y registra el movimiento con el stock resultante', async () => {
      const managerMock = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 7, stock: 10 }),
        })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (v) => ({ id: 99, ...v })),
        create: jest.fn((_entity, v) => v),
        findOne: jest.fn().mockResolvedValue({ id: 7, stock: 15 }),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      const resultado = await service.ajustarStock(
        7,
        { cantidad: 5, tipo: 'entrada', referencia: 'Factura 123' },
        usuarioIdDePrueba(),
      );

      expect(managerMock.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 7 },
        { stock: 15 },
      );
      expect(managerMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          varianteId: 7,
          tipo: 'entrada',
          cantidad: 5,
          stockResultante: 15,
          referencia: 'Factura 123',
          usuarioId: usuarioIdDePrueba(),
        }),
      );
      expect(resultado.variante.stock).toBe(15);
    });

    it('rechaza un ajuste que dejaría el stock en negativo', async () => {
      const managerMock = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 7, stock: 3 }),
        })),
        update: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      await expect(
        service.ajustarStock(7, { cantidad: -5, tipo: 'merma' }, 1),
      ).rejects.toThrow(BadRequestException);
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la variante no existe', async () => {
      const managerMock = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        })),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      await expect(
        service.ajustarStock(999, { cantidad: 1, tipo: 'entrada' }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

function usuarioIdDePrueba(): number {
  return 42;
}
