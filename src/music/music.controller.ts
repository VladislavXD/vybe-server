import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchTracksDto } from './dto/search-tracks.dto.js';
import { MusicService } from './music.service.js';

@Controller('music')
export class MusicController {
	constructor(private readonly musicService: MusicService) {}

	/**
	 * Публичный поиск треков (для гостей и диджеев)
	 * GET /music/search?q=Miyagi&limit=15
	 */
	@Get('search')
	async searchTracks(@Query() dto: SearchTracksDto) {
		return this.musicService.search(dto.q, dto.limit);
	}

	/**
	 * Получение трендовых/популярных треков для начального экрана
	 * GET /music/charts?limit=20
	 */
	@Get('charts')
	async getCharts(@Query('limit') limit?: number) {
		const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 50) : 20;
		return this.musicService.getCharts(parsedLimit);
	}

	/**
	 * Получение полной информации о треке по ID
	 * GET /music/:id
	 */
	@Get(':id')
	async getTrackById(@Param('id') id: string) {
		return this.musicService.getTrackById(id);
	}
}
