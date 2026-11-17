/**
 * Структуры ответов официального Deezer API (https://developers.deezer.com/api)
 */

export interface DeezerArtist {
	id: number;
	name: string;
	link?: string;
	picture?: string;
	picture_small?: string;
	picture_medium?: string;
	picture_big?: string;
	picture_xl?: string;
}

export interface DeezerAlbum {
	id: number;
	title: string;
	cover?: string;
	cover_small?: string;
	cover_medium?: string;
	cover_big?: string;
	cover_xl?: string;
}

export interface DeezerTrack {
	id: number;
	readable?: boolean;
	title: string;
	title_short?: string;
	link?: string;
	duration: number; // в секундах
	rank?: number;
	explicit_lyrics?: boolean;
	preview?: string; // mp3 URL
	artist: DeezerArtist;
	album?: DeezerAlbum;
	isrc?: string;
}

export interface DeezerSearchResponse {
	data: DeezerTrack[];
	total: number;
	next?: string;
}

export interface DeezerChartResponse {
	tracks: {
		data: DeezerTrack[];
		total: number;
	};
}
