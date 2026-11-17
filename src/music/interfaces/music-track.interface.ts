/**
 * Единый унифицированный интерфейс музыкального трека для TrackUp.
 * Полностью совместим со структурой Order в Prisma (trackTitle, trackArtist, coverUrl, durationMs).
 */
export interface MusicTrack {
	id: string;                      // Уникальный ID с префиксом источника (например "dz-3135556")
	externalId: string;              // Чистый ID в источнике ("3135556")
	source: 'deezer' | 'itunes' | 'manual';
	title: string;                   // Название трека
	artist: string;                  // Имя артиста / группы
	album?: string;                  // Название альбома
	durationSeconds: number;         // Длительность в секундах
	durationMs: number;              // Длительность в мс (для Prisma Order)
	durationFormatted: string;       // Читаемый формат (например "3:44")
	coverUrl: string;                // Качественная квадратная обложка альбома (500x500)
	coverSmallUrl?: string;          // Миниатюра обложки (120x120)
	previewUrl?: string;             // 30-секундный аудио-фрагмент mp3
	explicitLyrics?: boolean;        // Наличие цензуры / 18+
	isrc?: string;                   // Международный стандартный номер аудиозаписи (если есть)
}

/**
 * Ответ поиска музыки
 */
export interface MusicSearchResponse {
	tracks: MusicTrack[];
	total: number;
	source: 'deezer' | 'itunes' | 'cache';
	query: string;
}
