import { Injectable, Logger } from '@nestjs/common';
import { MUSIC_CONSTANTS } from '../constants/music.constants.js';
import type { MusicTrack } from '../interfaces/music-track.interface.js';

interface ItunesSong {
	trackId: number;
	trackName: string;
	artistName: string;
	collectionName?: string;
	trackTimeMillis?: number;
	artworkUrl100?: string;
	artworkUrl60?: string;
	previewUrl?: string;
	isStreamable?: boolean;
}

interface ItunesSearchResponse {
	resultCount: number;
	results: ItunesSong[];
}

@Injectable()
export class ItunesProvider {
	private readonly logger = new Logger(ItunesProvider.name);

	/**
	 * Резервный поиск треков через iTunes Search API
	 */
	async searchTracks(query: string, limit = 15): Promise<MusicTrack[]> {
		const url = `${MUSIC_CONSTANTS.ITUNES_API_BASE}/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;

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
				return [];
			}

			const json = (await res.json()) as ItunesSearchResponse;
			if (!json?.results || !Array.isArray(json.results)) {
				return [];
			}

			return json.results.map((song) => {
				const durationMs = song.trackTimeMillis || 0;
				const durationSeconds = Math.floor(durationMs / 1000);
				const minutes = Math.floor(durationSeconds / 60);
				const seconds = durationSeconds % 60;
				const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

				// Получаем обложку высокого разрешения (заменяем 100x100bb на 600x600bb в URL)
				const rawArtwork = song.artworkUrl100 || '';
				const coverUrl = rawArtwork.replace('100x100bb', '600x600bb');
				const coverSmallUrl = song.artworkUrl60 || rawArtwork;

				return {
					id: `it-${song.trackId}`,
					externalId: String(song.trackId),
					source: 'itunes',
					title: song.trackName || 'Unknown Title',
					artist: song.artistName || 'Unknown Artist',
					album: song.collectionName,
					durationSeconds,
					durationMs,
					durationFormatted,
					coverUrl,
					coverSmallUrl,
					previewUrl: song.previewUrl,
					explicitLyrics: false
				};
			});
		} catch (error: any) {
			this.logger.warn(`Ошибка запроса к iTunes API (fallback "${query}"): ${error.message}`);
			return [];
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
