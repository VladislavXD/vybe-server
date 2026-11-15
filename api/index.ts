/**
 * Vercel Serverless Entry Point for NestJS.
 *
 * ВАЖНО: Импортируем из ../dist/ (скомпилировано tsc с emitDecoratorMetadata: true),
 * а НЕ из ../src/. @vercel/node использует esbuild, который не поддерживает
 * emitDecoratorMetadata — без него NestJS DI падает при резолве зависимостей.
 *
 * Vercel запускает buildCommand ("npm run build") ДО компиляции api/ файлов,
 * поэтому dist/ всегда существует к этому моменту.
 *
 * Локальная разработка: используй src/main.ts через `npm run start:dev`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import session from 'express-session';
import { RedisStore } from 'connect-redis';

// Pre-compiled by tsc (npm run build) with emitDecoratorMetadata: true
// esbuild только бандлит эти JS-файлы, не перекомпилируя TypeScript
import { AppModule } from '../dist/app.module.js';
import { ms } from '../dist/libs/common/utils/ms.util.js';
import { parseBoolean } from '../dist/libs/common/utils/parse-boolean.util.js';

type ExpressApp = (req: IncomingMessage, res: ServerResponse) => void;

// Singleton — переиспользуем инициализированный Express-адаптер между warm-вызовами
let cachedApp: ExpressApp | null = null;

async function buildApp(): Promise<ExpressApp> {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  const expressApp = app.getHttpAdapter().getInstance() as any;
  expressApp.set('trust proxy', 1);

  const config = app.get(ConfigService);

  // ─── Redis ─────────────────────────────────────────────────────────────────
  const redis = createClient({
    url: config.getOrThrow<string>('REDIS_URI'),
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries: number) =>
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
    // Не падаем при недоступном Redis — сессии не будут персистентны
  }

  // ─── CORS ─────────────────────────────────────────────────────────────────
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

      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*'))
        return callback(null, cleanOrigin);

      const isVercelDomain = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin);
      if (isVercelDomain && (isProd || allowedOrigins.some((o) => o.includes('vercel.app'))))
        return callback(null, cleanOrigin);

      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin))
        return callback(null, cleanOrigin);

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

  // ─── Session ───────────────────────────────────────────────────────────────
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
        maxAge: ms((config.get<string>('SESSION_MAX_AGE') || '30d') as any),
        httpOnly: parseBoolean(config.get<string>('SESSION_HTTP_ONLY') ?? 'true'),
        secure: isSecure,
        sameSite,
      },
      store: new RedisStore({
        client: redis,
        prefix: config.get<string>('SESSION_FOLDER') || 'sessions:',
        ttl: ms((config.get<string>('SESSION_MAX_AGE') || '30d') as any) / 1000,
      }),
    }),
  );

  // ─── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Инициализируем без listen() — Vercel управляет портом сам
  await app.init();

  return expressApp as ExpressApp;
}

/**
 * Vercel serverless handler (default export — обязательно для @vercel/node).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cachedApp) {
    cachedApp = await buildApp();
  }
  cachedApp(req, res);
}
