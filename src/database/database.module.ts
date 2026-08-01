import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: Object.values(entities),
        // El esquema vive en RunarStore.sql (con sus triggers): TypeORM NUNCA lo genera ni lo migra.
        synchronize: false,
        migrationsRun: false,
        charset: 'utf8mb4_unicode_ci',
        timezone: 'Z',
      }),
    }),
  ],
})
export class DatabaseModule {}
