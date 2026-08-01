import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompraVerificadaGuard } from './compra-verificada.guard';

function crearContexto(user: { sub: number } | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('CompraVerificadaGuard', () => {
  it('permite el acceso si el usuario tiene al menos 1 compra', async () => {
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({ id: 1, totalCompras: 3 }),
    };
    const guard = new CompraVerificadaGuard(usuarios as any);

    await expect(guard.canActivate(crearContexto({ sub: 1 }))).resolves.toBe(
      true,
    );
  });

  it('rechaza si el usuario no tiene compras', async () => {
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({ id: 1, totalCompras: 0 }),
    };
    const guard = new CompraVerificadaGuard(usuarios as any);

    await expect(guard.canActivate(crearContexto({ sub: 1 }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza si no hay usuario en la request', async () => {
    const usuarios = { findOne: jest.fn() };
    const guard = new CompraVerificadaGuard(usuarios as any);

    await expect(guard.canActivate(crearContexto(undefined))).resolves.toBe(
      false,
    );
    expect(usuarios.findOne).not.toHaveBeenCalled();
  });
});
