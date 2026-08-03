import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { json } from 'express';
import { AppModule } from './app.module';
import { inicializarSentry } from './common/sentry/sentry.util';
import { SentryExceptionFilter } from './common/sentry/sentry-exception.filter';

async function bootstrap() {
  // Antes de crear la app: si algo revienta durante el bootstrap también queda capturado.
  inicializarSentry(
    process.env.SENTRY_DSN,
    process.env.NODE_ENV ?? 'development',
  );

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));

  // Reporta a Sentry los errores 5xx (con scrubbing de headers/cookies/passwords en
  // inicializarSentry) sin cambiar ninguna respuesta — sigue delegando en el manejo de
  // Nest de siempre. Sin SENTRY_DSN, Sentry.captureException() es un no-op inofensivo.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  app.enableCors({
    origin: config.get<string>('frontendOrigin'),
    credentials: true,
  });

  // Errores genéricos al cliente: el filtro de excepciones de Nest ya no envía stack traces ni
  // estructura interna en la respuesta (solo statusCode/message); el detalle completo queda en
  // los logs pino, correlacionado por request-id (pino-http lo genera por request automáticamente).
  //
  // enableImplicitConversion: los IDs son BIGINT UNSIGNED en MySQL y TypeORM/mysql2 los serializa
  // como string en el JSON de respuesta (un bigint no cabe siempre en un number de JS). Cuando el
  // frontend reenvía ese mismo id en el body de otro request (ej. varianteId al agregar al carrito),
  // llega como string y @IsInt() lo rechazaba con "must be an integer number". Sin esto, agregar al
  // carrito (y cualquier DTO que reciba un id por body) rompía en producción.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}
void bootstrap();
