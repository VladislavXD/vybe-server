import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { MUSIC_CONSTANTS } from '../constants/music.constants.js';

export class SearchTracksDto {
	@IsNotEmpty({ message: 'Поисковый запрос не может быть пустым' })
	@IsString({ message: 'Поисковый запрос должен быть строкой' })
	@MinLength(MUSIC_CONSTANTS.MIN_QUERY_LENGTH, {
		message: `Минимальная длина запроса — ${MUSIC_CONSTANTS.MIN_QUERY_LENGTH} символа`
	})
	q: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Лимит должен быть целым числом' })
	@Min(1, { message: 'Минимальный лимит — 1' })
	@Max(MUSIC_CONSTANTS.MAX_LIMIT, {
		message: `Максимальный лимит — ${MUSIC_CONSTANTS.MAX_LIMIT}`
	})
	limit: number = MUSIC_CONSTANTS.DEFAULT_LIMIT;
}
