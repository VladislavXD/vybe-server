import { Injectable, Logger } from '@nestjs/common';
import { MUSIC_CONSTANTS } from '../constants/music.constants.js';
import type { DeezerChartResponse, DeezerSearchResponse, DeezerTrack } from '../interfaces/deezer.interface.js';
import type { MusicTrack } from '../interfaces/music-track.interface.js';

@Injectable()
export class DeezerProvider {
	private readonly logger = new Logger(DeezerProvider.name);

	/**
	 * Поиск треков через официальный Deezer API
	 */
	async searchTracks(query: string, limit: number = MUSIC_CONSTANTS.DEFAULT_LIMIT): Promise<MusicTrack[]> {
		const url = `${MUSIC_CONSTANTS.DEEZER_API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`;

		try {
			const response = await this.fetchWithTimeout<DeezerSearchResponse>(url);
			if (!response?.data || !Array.isArray(response.data)) {
				return [];
			}

			return response.data.map((track) => this.mapDeezerTrack(track));
		} catch (error: any) {
			this.logger.warn(`Ошибка запроса к Deezer API (поиск "${query}"): ${error.message}`);
			return [];
		}
	}

	/**
	 * Получение топ-чартов (трендовых треков) для гостевого экрана
	 */
	async getChartTracks(limit: number = MUSIC_CONSTANTS.DEFAULT_LIMIT): Promise<MusicTrack[]> {
		const url = `${MUSIC_CONSTANTS.DEEZER_API_BASE}/chart/0/tracks?limit=${limit}`;

		try {
			const response = await this.fetchWithTimeout<DeezerChartResponse>(url);
			const tracks = response?.tracks?.data;
			if (!tracks || !Array.isArray(tracks)) {
				return [];
			}

			return tracks.map((track) => this.mapDeezerTrack(track));
		} catch (error: any) {
			this.logger.warn(`Ошибка получения чартов Deezer: ${error.message}`);
			return [];
		}
	}

	/**
	 * Получение деталей трека по ID Deezer
	 */
	async getTrackById(id: string | number): Promise<MusicTrack | null> {
		const cleanId = String(id).replace(/^dz-/, '');
		const url = `${MUSIC_CONSTANTS.DEEZER_API_BASE}/track/${cleanId}`;

		try {
			const track = await this.fetchWithTimeout<DeezerTrack>(url);
			if (!track || !track.id) {
				return null;
			}

			return this.mapDeezerTrack(track);
		} catch (error: any) {
			this.logger.warn(`Ошибка получения трека Deezer ID ${id}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Маппинг трека из формата Deezer в единый MusicTrack
	 */
	public mapDeezerTrack(track: DeezerTrack): MusicTrack {
		const durationSeconds = track.duration || 0;
		const minutes = Math.floor(durationSeconds / 60);
		const seconds = durationSeconds % 60;
		const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

		const coverUrl =
			track.album?.cover_big ||
			track.album?.cover_medium ||
			track.album?.cover ||
			track.artist?.picture_big ||
			track.artist?.picture_medium ||
			'';

		const coverSmallUrl =
			track.album?.cover_small ||
			track.album?.cover_medium ||
			track.artist?.picture_small ||
			'';

		return {
			id: `dz-${track.id}`,
			externalId: String(track.id),
			source: 'deezer',
			title: track.title_short || track.title || 'Unknown Title',
			artist: track.artist?.name || 'Unknown Artist',
			album: track.album?.title,
			durationSeconds,
			durationMs: durationSeconds * 1000,
			durationFormatted,
			coverUrl,
			coverSmallUrl,
			previewUrl: track.preview || undefined,
			explicitLyrics: Boolean(track.explicit_lyrics),
			isrc: track.isrc
		};
	}

	/**
	 * Вспомогательный метод HTTP-запроса с таймаутом
	 */
	private async fetchWithTimeout<T>(url: string): Promise<T> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), MUSIC_CONSTANTS.TIMEOUT_MS);

		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: {
					Accept: 'application/json',
					'User-Agent': 'TrackUp-App/1.0'
				}
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}

			return (await res.json()) as T;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
