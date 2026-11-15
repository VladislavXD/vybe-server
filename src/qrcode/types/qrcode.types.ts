import { QrCodeType } from '@prisma/client';

/**
 * Внешнее строковое представление типа сервиса для фронтенда и роутинга.
 * Соответствует клиенту: 'music' | 'food' | 'review'
 */
export type QrServiceType = 'music' | 'food' | 'review';

/**
 * Нормализатор типа QR-кода.
 * Принимает любые вариации регистра и синонимы с клиента (например:
 * 'music', 'dj', 'food', 'menu', 'review', 'reviews', 'feedback')
 * и приводит их к строгой Prisma-модели QrCodeType (MUSIC, FOOD, REVIEWS).
 */
export function normalizeQrCodeType(value: unknown): QrCodeType | undefined {
	if (!value) return undefined;

	const str = String(value).trim().toUpperCase();

	// Еда и меню
	if (str === 'FOOD' || str === 'MENU') {
		return QrCodeType.FOOD;
	}

	// Отзывы и чаевые
	if (str === 'REVIEW' || str === 'REVIEWS' || str === 'FEEDBACK') {
		return QrCodeType.REVIEWS;
	}

	// Музыка и DJ
	if (str === 'MUSIC' || str === 'DJ' || str === 'TRACK') {
		return QrCodeType.MUSIC;
	}

	// Если уже является валидным ключом Enum
	if (Object.values(QrCodeType).includes(str as QrCodeType)) {
		return str as QrCodeType;
	}

	return undefined;
}

/**
 * Преобразование Prisma QrCodeType в строковый параметр маршрута клиента.
 */
export function toServiceType(type: QrCodeType): QrServiceType {
	switch (type) {
		case QrCodeType.FOOD:
			return 'food';
		case QrCodeType.REVIEWS:
			return 'review';
		case QrCodeType.MUSIC:
		default:
			return 'music';
	}
}

/**
 * Извлечение числового номера стола из метки, например:
 * "Стол 5" -> 5
 * "VIP 12" -> 12
 * "Бар 3" -> 3
 */
export function extractTableNumber(tableLabel?: string | null): number | null {
	if (!tableLabel) return null;
	const match = tableLabel.match(/\d+/);
	return match ? parseInt(match[0], 10) : null;
}
