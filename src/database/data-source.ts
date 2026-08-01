import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as entities from './entities';

/**
 * DataSource standalone (fuera del ciclo de vida de Nest) para scripts CLI:
 * seed del primer admin, futuras migraciones explícitas, etc.
 * El esquema real vive en RunarStore.sql — esto NUNCA sincroniza ni migra automáticamente.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'tienda_anime',
  entities: Object.values(entities),
  synchronize: false,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
});
