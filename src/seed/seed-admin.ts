import * as argon2 from 'argon2';
import { AppDataSource } from '../database/data-source';
import { Rol } from '../database/entities/rol.entity';
import { Usuario } from '../database/entities/usuario.entity';

/**
 * Crea el primer usuario admin. Se ejecuta SOLO por CLI (`npm run seed:admin`),
 * jamás por un endpoint público (regla de la Parte 5.1 del documento maestro).
 * Es idempotente: si el email ya existe, no hace nada.
 */
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nombre = process.env.SEED_ADMIN_NOMBRE ?? 'Admin';
  const apellido = process.env.SEED_ADMIN_APELLIDO ?? 'RUNE';

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios en .env',
    );
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }

  await AppDataSource.initialize();

  try {
    const rolRepo = AppDataSource.getRepository(Rol);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const rolAdmin = await rolRepo.findOne({ where: { nombre: 'admin' } });
    if (!rolAdmin) {
      throw new Error(
        'No existe el rol "admin" en la tabla roles. ¿Se cargó RunarStore.sql (incluye el INSERT de roles semilla)?',
      );
    }

    const existente = await usuarioRepo.findOne({ where: { email } });
    if (existente) {
      console.log(
        `El usuario admin "${email}" ya existe (id=${existente.id}). Nada que hacer.`,
      );
      return;
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const admin = usuarioRepo.create({
      rolId: rolAdmin.id,
      email,
      passwordHash,
      nombre,
      apellido,
      emailVerificado: true,
      activo: true,
    });

    const guardado = await usuarioRepo.save(admin);
    console.log(`Usuario admin creado: ${guardado.email} (id=${guardado.id})`);
  } finally {
    await AppDataSource.destroy();
  }
}

seedAdmin().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Error al crear el admin semilla:', message);
  process.exit(1);
});
