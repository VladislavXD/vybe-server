/**
 * Vercel Serverless Entry Point for NestJS.
 *
 * Vercel запускает этот файл как Lambda-функцию.
 * Инициализация приложения кэшируется между warm-запросами.
 *
 * Локальная разработка: используй `src/main.ts` через `npm run start:dev`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import session from 'express-session';
import { RedisStore } from 'connect-redis';

import { AppModule } from '../src/app.module.js';
import { ms, type StringValue } from '../src/libs/common/utils/ms.util.js';
import { parseBoolean } from '../src/libs/common/utils/parse-boolean.util.js';

// Singleton — переиспользуем инициализированный Express-адаптер между warm-вызовами
let cachedApp: Express | null = null;

async function buildApp(): Promise<Express> {
  const app = await NestFactory.create(AppModule, {
    // Уменьшаем логи в production
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  const expressApp = app.getHttpAdapter().getInstance() as any;

  // Доверяем прокси Vercel (необходимо для корректного определения HTTPS и IP)
  expressApp.set('trust proxy', 1);

  const config = app.get(ConfigService);

  // ─── Redis ─────────────────────────────────────────────────────────────────
  // Подключение Redis с таймаутом 5 секунд — чтобы не зависать на холодном старте
  const redis = createClient({
    url: config.getOrThrow<string>('REDIS_URI'),
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) =>
        retries > 2 ? new Error('Redis unavailable') : 500,
    },
  });

  redis.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  try {
    await redis.connect();
  } catch (err) {
    console.error('[Redis] Failed to connect at startup:', (err as Error).message);
    // Продолжаем запуск — не падаем из-за Redis
  }

  // ─── CORS ────────────────────────────────────────────────────────────────
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true';

  const rawAllowedOrigins =
    config.get<string>('ALLOWED_ORIGIN') ||
    config.get<string>('CLIENT_URL') ||
    'http://localhost:3000';

  const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, origin?: boolean | string) => void,
    ) => {
      if (!requestOrigin) return callback(null, true);

      const cleanOrigin = requestOrigin.replace(/\/+$/, '');

      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
        return callback(null, cleanOrigin);
      }

      const isVercelDomain = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin);
      const allowVercel =
        isProd ||
        process.env.VERCEL === '1' ||
        allowedOrigins.some((o) => o.includes('vercel.app'));

      if (isVercelDomain && allowVercel) return callback(null, cleanOrigin);

      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
      if (isLocalhost) return callback(null, cleanOrigin);

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

  // ─── Session ─────────────────────────────────────────────────────────────
  const rawSessionDomain = config.get<string>('SESSION_DOMAIN');
  const sessionDomain =
    rawSessionDomain && !rawSessionDomain.includes('vercel.app')
      ? rawSessionDomain.trim()
      : undefined;

  const rawSameSite = config.get<string>('SESSION_SAME_SITE');
  const sameSite = (rawSameSite || (isProd ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';

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

  // ─── Validation ───────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Инициализируем приложение без listen() — Vercel сам управляет портом
  await app.init();

  return expressApp as Express;
}

/**
 * Vercel serverless handler (default export — обязательно для @vercel/node).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cachedApp) {
    cachedApp = await buildApp();
  }

  cachedApp(req as any, res as any);
}
