import { Module } from '@nestjs/common';
import { MusicController } from './music.controller.js';
import { MusicService } from './music.service.js';
import { DeezerProvider } from './providers/deezer.provider.js';
import { ItunesProvider } from './providers/itunes.provider.js';

@Module({
	controllers: [MusicController],
	providers: [DeezerProvider, ItunesProvider, MusicService],
	exports: [MusicService]
})
export class MusicModule {}
