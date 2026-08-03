import * as Sentry from '@sentry/node';

/**
 * Sin SENTRY_DSN, Sentry.init() nunca se llama — captureException() queda como no-op
 * silencioso (así es como funciona el SDK sin inicializar), así que el resto del código
 * no necesita ningún if adicional. En dev/local no hace falta configurar nada.
 */
export function inicializarSentry(dsn: string | undefined, entorno: string): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: entorno,
    // Solo error tracking: sin tracing/profiling, no hay costo ni ruido de performance acá.
    tracesSampleRate: 0,
    beforeSend(event) {
      return depurarEvento(event);
    },
  });
}

/**
 * Scrubbing manual antes de enviar cualquier evento: nunca debe salir del servidor un
 * Authorization header, una cookie (refresh token) ni un campo de contraseña del body.
 */
function depurarEvento(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const request = event.request;
  if (request) {
    if (request.headers) {
      delete request.headers['authorization'];
      delete request.headers['Authorization'];
      delete request.headers['cookie'];
      delete request.headers['Cookie'];
    }
    if (request.cookies) {
      request.cookies = {};
    }
    if (request.data && typeof request.data === 'object') {
      request.data = depurarCampos(request.data as Record<string, unknown>);
    }
  }
  return event;
}

const CAMPOS_SENSIBLES = [
  'password',
  'passwordactual',
  'passwordnueva',
  'passwordoferta',
  'token',
  'tokenTemporal',
  'refreshtoken',
  'accesstoken',
  'codigo',
  'secret',
];

function depurarCampos(objeto: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(objeto)) {
    limpio[clave] = CAMPOS_SENSIBLES.includes(clave.toLowerCase())
      ? '[REDACTADO]'
      : valor;
  }
  return limpio;
}
