import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVenueDto {
	@IsString()
	@IsNotEmpty({ message: 'Название заведения обязательно для заполнения' })
	name: string;

	@IsString()
	@IsOptional()
	slug?: string; // Если не передан, генерируется автоматически из названия

	@IsString()
	@IsOptional()
	description?: string;

	@IsString()
	@IsOptional()
	address?: string;

	@IsString()
	@IsOptional()
	city?: string = 'Tashkent';

	@IsString()
	@IsOptional()
	logoUrl?: string;

	@IsString()
	@IsOptional()
	coverUrl?: string;

	// Экономика заведения (в сумах)
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	@IsOptional()
	commissionPercent?: number = 15; // По умолчанию 15% (в пилоте 0%)

	@Type(() => Number)
	@IsInt()
	@Min(1000)
	@IsOptional()
	baseTrackPrice?: number = 30000; // Базовая цена трека (30 000 сум)

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@IsOptional()
	prioritySurcharge?: number = 20000; // Доплата за приоритет (20 000 сум)

	// Операционные настройки
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(30)
	@IsOptional()
	orderTimeoutMin?: number = 3; // Таймаут на ответ DJ в минутах (по спецификации 180 сек = 3 мин)

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	@IsOptional()
	maxQueueLimit?: number = 20;

	// Юридические реквизиты (опционально для старта)
	@IsString()
	@IsOptional()
	legalName?: string;

	@IsString()
	@IsOptional()
	inn?: string;

	@IsString()
	@IsOptional()
	bankAccount?: string;

	@IsString()
	@IsOptional()
	mfo?: string;
}
