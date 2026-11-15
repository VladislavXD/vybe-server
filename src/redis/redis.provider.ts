import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS = 'REDIS';

/**
 * Провайдер для Redis (ioredis).
 * Поддерживает REDIS_URI (например Upstash / Aiven / Redis Cloud),
 * а также не блокирует запуск приложения на Vercel (lazyConnect).
 */
export const RedisProvider: Provider = {
	provide: REDIS,
	useFactory: () => {
		const redisUri = process.env.REDIS_URI;
		const isProd =
			process.env.NODE_ENV === 'production' ||
			process.env.VERCEL === '1' ||
			process.env.VERCEL === 'true';

		const commonOptions: any = {
			connectTimeout: 2000,
			maxRetriesPerRequest: 1,
			enableOfflineQueue: false,
			lazyConnect: true,
			retryStrategy: (times: number) => {
				if (times > 2) return null;
				return 300;
			},
		};

		const isLocal =
			!redisUri || redisUri.includes('localhost') || redisUri.includes('127.0.0.1');

		let redis: Redis;

		if (redisUri && (!isProd || !isLocal)) {
			redis = new Redis(redisUri, commonOptions);
		} else {
			redis = new Redis({
				host: process.env.REDIS_HOST || 'localhost',
				port: parseInt(process.env.REDIS_PORT || '6379', 10),
				password: process.env.REDIS_PASSWORD || undefined,
				db: parseInt(process.env.REDIS_DB || '0', 10),
				...commonOptions,
			});
		}

		redis.on('connect', () => {
			console.log('✅ ioredis connected successfully');
		});

		redis.on('error', (err) => {
			console.warn('⚠️ ioredis connection warning:', err.message);
		});

		return redis;
	},
};
