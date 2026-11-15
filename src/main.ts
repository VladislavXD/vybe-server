import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import session from 'express-session';
import { ms, StringValue } from './libs/common/utils/ms.util.js';
import { parseBoolean } from './libs/common/utils/parse-boolean.util.js';
import { RedisStore } from 'connect-redis';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance() as any;
  expressApp.set('trust proxy', 1);

  const config = app.get(ConfigService);
  const redis = createClient({
    url: config.getOrThrow<string>('REDIS_URI'),
  });
  await redis.connect();

  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true';

  // Разбор разрешенных доменов для CORS
  const rawAllowedOrigins =
    config.get<string>('ALLOWED_ORIGIN') ||
    config.get<string>('CLIENT_URL') ||
    'http://localhost:3000';

  const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // Куки сессии:
  // При раздельном деплое на разных поддоменах Vercel (например vybe-lime vs vybe-ten-pi):
  // SameSite ДОЛЖЕН быть 'none' и secure ДОЛЖЕН быть true, иначе браузер блокирует cookies в fetch.
  // Запрещено ставить domain='.vercel.app', так как vercel.app находится в Public Suffix List.
  const rawSessionDomain = config.get<string>('SESSION_DOMAIN');
  const sessionDomain =
    rawSessionDomain && !rawSessionDomain.includes('vercel.app')
      ? rawSessionDomain.trim()
      : undefined;

  const rawSameSite = config.get<string>('SESSION_SAME_SITE');
  const sameSite = (rawSameSite || (isProd ? 'none' : 'lax')) as
    | 'lax'
    | 'strict'
    | 'none';

  const isSecure =
    sameSite === 'none'
      ? true
      : parseBoolean(config.get<string>('SESSION_SECURE') ?? (isProd ? 'true' : 'false'));

  app.use(
    session({
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      name: config.get<string>('SESSION_NAME') || 'session',
      resave: false,
      saveUninitialized: false,
      cookie: {
        ...(sessionDomain ? { domain: sessionDomain } : {}),
        maxAge: ms(config.get<StringValue>('SESSION_MAX_AGE') || '30d'),
        httpOnly: parseBoolean(config.get<string>('SESSION_HTTP_ONLY') ?? 'true'),
        secure: isSecure,
        sameSite,
      },
      store: new RedisStore({
        client: redis,
        prefix: config.get<string>('SESSION_FOLDER') || 'sessions:',
        ttl: ms(config.get<StringValue>('SESSION_MAX_AGE') || '30d') / 1000,
      }),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Настройки CORS для приложения
  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, origin?: boolean | string) => void
    ) => {
      // Разрешаем запросы без Origin (например мобильные приложения, curl, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }

      const cleanOrigin = requestOrigin.replace(/\/+$/, '');

      // 1. Точное совпадение со списком или wildcard
      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
        return callback(null, cleanOrigin);
      }

      // 2. Автоматическое разрешение всех Vercel-доменов (*.vercel.app),
      // если backend на Vercel или в списке разрешенных есть vercel.app
      const isVercelDomain = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin);
      const allowVercel =
        isProd ||
        process.env.VERCEL === '1' ||
        allowedOrigins.some((o) => o.includes('vercel.app'));

      if (isVercelDomain && allowVercel) {
        return callback(null, cleanOrigin);
      }

      // 3. Разрешаем localhost для локальной отладки
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
      if (isLocalhost) {
        return callback(null, cleanOrigin);
      }

      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'Origin',
      'x-forwarded-for',
      'x-forwarded-proto',
    ],
    exposedHeaders: ['Set-Cookie', 'set-cookie'],
    optionsSuccessStatus: 204,
  });

  const port = process.env.SERVER_PORT || config.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
