import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { QrCodeType } from '@prisma/client';
import { normalizeQrCodeType } from '../types/qrcode.types.js';

export class CreateQrcodeDto {
	@IsString()
	@IsOptional()
	venueId?: string; // Опционально: если не указан, берется заведение текущего владельца

	@Transform(({ obj, value }) => {
		if (value && typeof value === 'string' && value.trim()) {
			return value.trim();
		}
		if (obj.tableNumber !== undefined && obj.tableNumber !== null) {
			return `Стол ${obj.tableNumber}`;
		}
		if (obj.label && typeof obj.label === 'string') {
			return obj.label.trim();
		}
		return value;
	})
	@IsString()
	@IsNotEmpty({ message: 'Номер или название стола обязательно для заполнения' })
	tableLabel: string; // "Стол 1", "VIP Lounge 2", "Бар 3"

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
	source?: string = 'table_tent'; // "table_tent", "sticker", "nfc_puck", "menu_card"

	@IsString()
	@IsOptional()
	customCode?: string; // Опциональный кастомный код, если не передан - генерируется nanoid
}
