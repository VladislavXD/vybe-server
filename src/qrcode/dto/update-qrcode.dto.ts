import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { QrCodeType } from '@prisma/client';
import { normalizeQrCodeType } from '../types/qrcode.types.js';

export class UpdateQrcodeDto {
	@IsString()
	@IsOptional()
	tableLabel?: string;

	@Transform(({ value }) => normalizeQrCodeType(value) ?? value)
	@IsEnum(QrCodeType, {
		message: 'Тип QR-кода должен быть одним из: MUSIC, FOOD, REVIEWS (или music, food, review)'
	})
	@IsOptional()
	type?: QrCodeType; // Возможность мгновенно переключить назначение (MUSIC <-> FOOD <-> REVIEWS) без перепечатки!

	@IsString()
	@IsOptional()
	zoneId?: string;

	@IsString()
	@IsOptional()
	source?: string;

	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
