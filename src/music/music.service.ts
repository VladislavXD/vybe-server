import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { MUSIC_CONSTANTS } from './constants/music.constants.js';
import type { MusicSearchResponse, MusicTrack } from './interfaces/music-track.interface.js';
import { DeezerProvider } from './providers/deezer.provider.js';
import { ItunesProvider } from './providers/itunes.provider.js';

@Injectable()
export class MusicService {
	private readonly logger = new Logger(MusicService.name);

	constructor(
		private readonly deezerProvider: DeezerProvider,
		private readonly itunesProvider: ItunesProvider,
		private readonly redisService: RedisService
	) {}

	/**
	 * Поиск музыкальных треков с многоуровневым кэшированием в Redis и fallback на iTunes
	 */
	async search(query: string, limit: number = MUSIC_CONSTANTS.DEFAULT_LIMIT): Promise<MusicSearchResponse> {
		const cleanQuery = query.trim().toLowerCase();
		const cacheKey = `${MUSIC_CONSTANTS.REDIS_KEYS.SEARCH}${encodeURIComponent(cleanQuery)}:${limit}`;

		// 1. Проверяем кэш Redis
		try {
			const cached = await this.redisService.get(cacheKey);
			if (cached) {
				const tracks = JSON.parse(cached) as MusicTrack[];
				return {
					tracks,
					total: tracks.length,
					source: 'cache',
					query
				};
			}
		} catch (err: any) {
			this.logger.debug(`Ошибка чтения кэша Redis для поиска: ${err.message}`);
		}

		// 2. Основной поиск через Deezer API
		let tracks = await this.deezerProvider.searchTracks(query, limit);
		let source: 'deezer' | 'itunes' = 'deezer';

		// 3. Fallback: если Deezer вернул 0 результатов, пробуем iTunes
		if (tracks.length === 0) {
			tracks = await this.itunesProvider.searchTracks(query, limit);
			source = 'itunes';
		}

		// 4. Кэшируем результаты в Redis на 12 часов
		if (tracks.length > 0) {
			try {
				await this.redisService.set(
					cacheKey,
					JSON.stringify(tracks),
					MUSIC_CONSTANTS.CACHE_TTL.SEARCH
				);
			} catch (err: any) {
				this.logger.debug(`Ошибка сохранения в Redis: ${err.message}`);
			}
		}

		return {
			tracks,
			total: tracks.length,
			source,
			query
		};
	}

	/**
	 * Получение топ-чартов популярных треков (для начального экрана гостя)
	 */
	async getCharts(limit: number = MUSIC_CONSTANTS.DEFAULT_LIMIT): Promise<MusicTrack[]> {
		const cacheKey = `${MUSIC_CONSTANTS.REDIS_KEYS.CHART}:${limit}`;

		// 1. Проверяем кэш
		try {
			const cached = await this.redisService.get(cacheKey);
			if (cached) {
				return JSON.parse(cached) as MusicTrack[];
			}
		} catch (err: any) {
			this.logger.debug(`Ошибка чтения чартов из Redis: ${err.message}`);
		}

		// 2. Запрашиваем Deezer Charts
		const tracks = await this.deezerProvider.getChartTracks(limit);

		// 3. Сохраняем в кэш на 2 часа
		if (tracks.length > 0) {
			try {
				await this.redisService.set(
					cacheKey,
					JSON.stringify(tracks),
					MUSIC_CONSTANTS.CACHE_TTL.CHARTS
				);
			} catch (err: any) {
				this.logger.debug(`Ошибка сохранения чартов в Redis: ${err.message}`);
			}
		}

		return tracks;
	}

	/**
	 * Получение детальной информации о треке по ID
	 */
	async getTrackById(id: string): Promise<MusicTrack | null> {
		const cacheKey = `${MUSIC_CONSTANTS.REDIS_KEYS.TRACK}${id}`;

		// 1. Проверяем кэш
		try {
			const cached = await this.redisService.get(cacheKey);
			if (cached) {
				return JSON.parse(cached) as MusicTrack;
			}
		} catch (err: any) {
			this.logger.debug(`Ошибка чтения трека из Redis: ${err.message}`);
		}

		// 2. Запрашиваем провайдер
		const track = await this.deezerProvider.getTrackById(id);

		// 3. Сохраняем в кэш на 7 дней
		if (track) {
			try {
				await this.redisService.set(
					cacheKey,
					JSON.stringify(track),
					MUSIC_CONSTANTS.CACHE_TTL.TRACK
				);
			} catch (err: any) {
				this.logger.debug(`Ошибка сохранения трека в Redis: ${err.message}`);
			}
		}

		return track;
	}
}
