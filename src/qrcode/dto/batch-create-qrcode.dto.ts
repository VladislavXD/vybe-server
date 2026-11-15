import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { QrCodeType } from '@prisma/client';
import { normalizeQrCodeType } from '../types/qrcode.types.js';

export class BatchCreateQrcodeDto {
	@IsString()
	@IsOptional()
	venueId?: string; // Опционально: если не указан, берется заведение текущего владельца

	@Type(() => Number)
	@IsInt({ message: 'Начальный номер стола должен быть целым числом' })
	@Min(1, { message: 'Начальный номер стола не может быть меньше 1' })
	startTable: number; // Например, 1

	@Type(() => Number)
	@IsInt({ message: 'Конечный номер стола должен быть целым числом' })
	@Min(1, { message: 'Конечный номер стола не может быть меньше 1' })
	endTable: number; // Например, 20

	@IsString()
	@IsOptional()
	tablePrefix?: string = 'Стол '; // "Стол 1", "Стол 2" или "Table "

	@Transform(({ value }) => normalizeQrCodeType(value) ?? value)
	@IsEnum(QrCodeType, {
		message: 'Тип QR-кода должен быть одним из: MUSIC, FOOD, REVIEWS (или music, food, review)'
	})
	@IsOptional()
	type?: QrCodeType = QrCodeType.MUSIC; // Назначение: MUSIC, FOOD, REVIEWS

	@IsString()
	@IsOptional()
	zoneId?: string;

	@IsString()
	@IsOptional()
	source?: string = 'table_tent';
}
