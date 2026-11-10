import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO для входа DJ через Telegram WebApp / Bot.
 */
export class TelegramLoginDjDto {
	/**
	 * Telegram ID пользователя.
	 * @example "712345678"
	 */
	@IsString({ message: 'Telegram ID должен быть строкой.' })
	@IsNotEmpty({ message: 'Telegram ID обязателен.' })
	telegramId: string;
}
