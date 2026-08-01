export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
  /** URL pública del propio backend: Transbank redirige el navegador del cliente aquí tras el pago */
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:3000/api/v1',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    name: process.env.DB_NAME ?? 'tienda_anime',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Admin',
    apellido: process.env.SEED_ADMIN_APELLIDO ?? 'RUNE',
  },

  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY,
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  transbank: {
    commerceCode: process.env.TRANSBANK_COMMERCE_CODE,
    apiKey: process.env.TRANSBANK_API_KEY,
    environment: process.env.TRANSBANK_ENVIRONMENT ?? 'integration',
  },

  dte: {
    provider: process.env.DTE_PROVIDER,
    apiKey: process.env.DTE_API_KEY,
    environment: process.env.DTE_ENVIRONMENT ?? 'certificacion',
    rutEmisor: process.env.DTE_RUT_EMISOR,
    razonSocialEmisor: process.env.DTE_RAZON_SOCIAL_EMISOR,
  },
});
