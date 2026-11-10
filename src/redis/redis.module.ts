import { Module, Global } from '@nestjs/common'
import { RedisService } from './redis.service.js'
import { RedisProvider } from './redis.provider.js'

/**
 * Глобальный модуль для работы с Redis.
 * 
 * Предоставляет RedisService для кэширования и работы с данными в памяти.
 */
@Global()
@Module({
	providers: [RedisProvider, RedisService],
	exports: [RedisService]
})
export class RedisModule {}
