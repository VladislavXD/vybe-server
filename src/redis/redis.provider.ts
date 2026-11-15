import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

export const REDIS = 'REDIS';

/**
 * Провайдер для Redis (ioredis).
 * 
 * Создаёт подключение к Redis с автоматической поддержкой:
 * 1. REDIS_URI / REDIS_URL (Render, Upstash, Redis Cloud, Docker).
 * 2. TLS (rediss://) с rejectUnauthorized: false для облачных инстансов.
 * 3. Отдельных переменных REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB.
 */
export const RedisProvider: Provider = {
	provide: REDIS,
	inject: [ConfigService],
	useFactory: (config: ConfigService) => {
		const redisUri =
			config.get<string>('REDIS_URI') ||
			config.get<string>('REDIS_URL') ||
			process.env.REDIS_URI ||
			process.env.REDIS_URL;

		const commonOptions: RedisOptions = {
			maxRetriesPerRequest: 3,
			retryStrategy: (times: number) => {
				// Экспоненциальная задержка до 5 секунд (не спамить каждую миллисекунду)
				return Math.min(times * 250, 5000);
			},
			reconnectOnError: (err: Error) => {
				if (err.message.includes('READONLY')) {
					return true;
				}
				return false;
			},
		};

		let redis: Redis;

		if (redisUri) {
			const isTls = redisUri.startsWith('rediss://');
			redis = new Redis(redisUri, {
				...commonOptions,
				...(isTls
					? {
							tls: {
								rejectUnauthorized: false,
							},
						}
					: {}),
			});
		} else {
			redis = new Redis({
				host: config.get<string>('REDIS_HOST') || process.env.REDIS_HOST || 'localhost',
				port:
					Number(config.get<number | string>('REDIS_PORT')) ||
					Number(process.env.REDIS_PORT) ||
					6379,
				password:
					config.get<string>('REDIS_PASSWORD') ||
					process.env.REDIS_PASSWORD ||
					undefined,
				db:
					Number(config.get<number | string>('REDIS_DB')) ||
					Number(process.env.REDIS_DB) ||
					0,
				...commonOptions,
			});
		}

		// Логируем готовность один раз (когда пройдена авторизация и Redis готов принимать команды)
		redis.on('ready', () => {
			console.log('✅ Redis client ready and connected');
		});

		redis.on('error', (err: Error) => {
			console.error('❌ Redis client error:', err.message);
		});

		return redis;
	},
};
