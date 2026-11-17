/**
 * Константы для музыкального сервиса (Deezer & iTunes API)
 */
export const MUSIC_CONSTANTS = {
	DEEZER_API_BASE: 'https://api.deezer.com',
	ITUNES_API_BASE: 'https://itunes.apple.com',

	// Таймауты запросов к внешним API (мс)
	TIMEOUT_MS: 4500,

	// Время жизни кэша в Redis (в секундах)
	CACHE_TTL: {
		SEARCH: 43200,      // 12 часов для результатов поиска
		CHARTS: 7200,       // 2 часа для чартов/трендов
		TRACK: 604800       // 7 дней для отдельного трека
	},

	// Префиксы ключей в Redis
	REDIS_KEYS: {
		SEARCH: 'music:search:',
		CHART: 'music:chart:top',
		TRACK: 'music:track:'
	},

	// Лимиты выдачи
	DEFAULT_LIMIT: 20,
	MAX_LIMIT: 50,
	MIN_QUERY_LENGTH: 2
} as const;
