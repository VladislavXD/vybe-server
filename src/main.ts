import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import {createClient} from "redis"
import session from 'express-session';
import { ms, StringValue } from './libs/common/utils/ms.util.js';
import { parseBoolean } from './libs/common/utils/parse-boolean.util.js';
import {RedisStore} from "connect-redis"
import { ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance() as any;
  expressApp.set('trust proxy', true);
  const config = app.get(ConfigService);
  const redis = createClient({
    url: config.getOrThrow<string>('REDIS_URI'),
  });
  await redis.connect();
  const sessionDomain = config.get<string>('SESSION_DOMAIN');
  app.use(
    session({
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      name: config.getOrThrow<string>('SESSION_NAME'),
      resave: true,
      saveUninitialized: false,
      cookie: {
        ...(sessionDomain && sessionDomain.trim()
          ? { domain: sessionDomain }
          : {}),
        maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')),
        httpOnly: parseBoolean(config.getOrThrow<string>('SESSION_HTTP_ONLY')),
        secure: parseBoolean(config.getOrThrow<string>('SESSION_SECURE')),
        sameSite: config.getOrThrow<'lax' | 'strict' | 'none' | boolean>(   'SESSION_SAME_SITE'),
      },
      store: new RedisStore({
        client: redis,
        prefix: config.getOrThrow<string>('SESSION_FOLDER'),
        ttl: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')) / 1000,
        // Можно настроить ttl вручную если нужно: ttl: 60 * 60 * 24
      }),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );


  
  app.enableCors({
    // Настройки CORS для приложения
    origin: config.getOrThrow<string>('ALLOWED_ORIGIN'),
    credentials: true,
    // экспонируем Set-Cookie чтобы браузер и прокси могли увидеть заголовок
    exposedHeaders: ['Set-Cookie', 'set-cookie'],
  });

  await app.listen(process.env.SERVER_PORT || config.get<number>('PORT') || 3000, '0.0.0.0');

}
await bootstrap();
