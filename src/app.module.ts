import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { CarritoModule } from './carrito/carrito.module';
import { OrdenesModule } from './ordenes/ordenes.module';
import { PagosModule } from './pagos/pagos.module';
import { BoletasModule } from './boletas/boletas.module';
import { EnviosModule } from './envios/envios.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ResenasModule } from './resenas/resenas.module';
import { TicketsModule } from './tickets/tickets.module';
import { PromocionesModule } from './promociones/promociones.module';
import { CuponesModule } from './cupones/cupones.module';
import { GiftcardsModule } from './giftcards/giftcards.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { ContenidoModule } from './contenido/contenido.module';
import { ContactoModule } from './contacto/contacto.module';
import { DashboardModule } from './admin/dashboard.module';
import { AuditoriaModule } from './admin/auditoria.module';
import { AnunciosModule } from './anuncios/anuncios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // Nunca loguear bodies de pago, passwords, tokens ni headers Authorization (ver CLAUDE.md)
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.passwordActual',
            'req.body.passwordNueva',
            'req.body.token',
            'req.body.refreshToken',
            'req.body.tarjeta',
            'req.body.numeroTarjeta',
            'req.body.cvv',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTADO]',
        },
      },
    }),
    // Rate limiting global; límites más estrictos por endpoint se definen en cada módulo (auth, contacto)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CatalogoModule,
    CarritoModule,
    OrdenesModule,
    PagosModule,
    BoletasModule,
    EnviosModule,
    UsuariosModule,
    ResenasModule,
    TicketsModule,
    PromocionesModule,
    CuponesModule,
    GiftcardsModule,
    NewsletterModule,
    ContenidoModule,
    ContactoModule,
    DashboardModule,
    AuditoriaModule,
    AnunciosModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
