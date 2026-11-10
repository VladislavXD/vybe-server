import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from './redis.provider.js'

/**
 * Сервис для работы с Redis.
 * 
 * Предоставляет методы для кэширования просмотров постов,
 * работы с множествами (sets) и периодической синхронизации с БД.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
	constructor(@Inject(REDIS) private readonly redis: Redis) {}

	/**
	 * Закрывает соединение с Redis при уничтожении модуля.
	 */
	async onModuleDestroy() {
		await this.redis.quit()
	}

	/**
	 * Добавляет userId в set просмотров поста.
	 * 
	 * @param postId - ID поста
	 * @param userId - ID пользователя
	 * @returns true если просмотр был добавлен, false если уже существовал
	 */
	async addView(postId: string, userId: string): Promise<boolean> {
		const key = `post:${postId}:views`
		const result = await this.redis.sadd(key, userId)
		

		await this.redis.expire(key, 86400)
		
		return result === 1 
	}

	/**
	 * Проверяет, просматривал ли пользователь пост.
	 * 
	 * @param postId - ID поста
	 * @param userId - ID пользователя
	 * @returns true если пользователь уже просматривал пост
	 */
	async hasViewed(postId: string, userId: string): Promise<boolean> {
		const key = `post:${postId}:views`
		const result = await this.redis.sismember(key, userId)
		return result === 1
	}





	/**
	 * Общие методы Redis для других целей.
	 */

	/**
	 * Устанавливает значение с TTL.
	 */
	async set(key: string, value: string, ttl?: number): Promise<void> {
		if (ttl) {
			await this.redis.setex(key, ttl, value)
		} else {
			await this.redis.set(key, value)
		}
	}

	/**
	 * Получает значение по ключу.
	 */
	async get(key: string): Promise<string | null> {
		return await this.redis.get(key)
	}

	/**
	 * Удаляет ключ.
	 */
	async del(key: string): Promise<void> {
		await this.redis.del(key)
	}

	/**
	 * Проверяет существование ключа.
	 */
	async exists(key: string): Promise<boolean> {
		const result = await this.redis.exists(key)
		return result === 1
	}

	/**
	 * Кэширует данные пользователя для Socket.IO.
	 * 
	 * @param userId - ID пользователя
	 * @param userData - данные пользователя (id, name, email, avatarUrl, lastSeen)
	 */
	async cacheUserData(userId: string, userData: {
		id: string;
		name: string;
		email: string | null;
		avatarUrl: string | null;
	}): Promise<void> {
		const key = `user:${userId}`
		const data = JSON.stringify(userData)
		
		// Кэшируем на 1 час (3600 секунд)
		await this.redis.setex(key, 3600, data)
	}
	
	/**
	 * Получает кэшированные данные пользователя.
	 * 
	 * @param userId - ID пользователя
	 * @returns данные пользователя или null если не найдено
	 */
	async getCachedUserData(userId: string): Promise<{
		id: string;
		name: string;
		email: string | null;
		avatarUrl: string | null;	
	} | null> {
		const key = `user:${userId}`
		const data = await this.redis.get(key)
		
		if (!data) {
			return null
		}
		
		try {
			const parsed = JSON.parse(data)
			// Преобразуем lastSeen обратно в Date
			if (parsed.lastSeen) {
				parsed.lastSeen = new Date(parsed.lastSeen)
			}
			return parsed
		} catch (error) {
			console.error('Error parsing cached user data:', error)
			return null
		}
	}

	/**
	 * Удаляет кэшированные данные пользователя.
	 * 
	 * @param userId - ID пользователя
	 */
	async invalidateUserCache(userId: string): Promise<void> {
		const key = `user:${userId}`
		await this.redis.del(key)
	}

	/**
	 * Кэширует онлайн статус пользователя.
	 * 
	 * @param userId - ID пользователя
	 * @param isOnline - статус онлайн
	 */
	async setUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
		const key = `user:${userId}:online`
		if (isOnline) {
			// Онлайн статус храним 5 минут (TTL для автоматического оффлайн)
			await this.redis.setex(key, 300, 'true')
		} else {
			await this.redis.del(key)
		}
	}

	/**
	 * Получает онлайн статус пользователя.
	 * 
	 * @param userId - ID пользователя
	 * @returns true если пользователь онлайн
	 */
	async getUserOnlineStatus(userId: string): Promise<boolean> {
		const key = `user:${userId}:online`
		const result = await this.redis.get(key)
		return result === 'true'
	}

	/**
	 * Публикует сообщение в Redis Pub/Sub канал.
	 * 
	 * @param channel - Имя канала
	 * @param message - Сообщение (строка или JSON)
	 */
	async publish(channel: string, message: string | Record<string, any>): Promise<number> {
		const payload = typeof message === 'string' ? message : JSON.stringify(message);
		return await this.redis.publish(channel, payload);
	}
}
