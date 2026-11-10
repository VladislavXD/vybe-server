import {
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches
} from 'class-validator';

/**
 * DTO для создания DJ владельцем заведения.
 * DJ не регистрируется сам — его аккаунт заводит заведение.
 */
export class CreateDjDto {
	/**
	 * Сценическое имя DJ (например, DJ Pulse).
	 * @example "DJ Pulse"
	 */
	@IsString({ message: 'Сценическое имя должно быть строкой.' })
	@IsNotEmpty({ message: 'Сценическое имя обязательно для заполнения.' })
	name: string;

	/**
	 * Номер телефона DJ (уникальный ключ для входа).
	 * @example "+998901234567"
	 */
	@IsString({ message: 'Номер телефона должен быть строкой.' })
	@IsNotEmpty({ message: 'Номер телефона обязателен для заполнения.' })
	phone: string;

	/**
	 * 4-6 значный PIN-код для быстрого входа у пульта заведения.
	 * @example "1234"
	 */
	@IsString({ message: 'PIN-код должен быть строкой.' })
	@IsNotEmpty({ message: 'PIN-код обязателен.' })
	@Matches(/^[0-9]{4,6}$/, {
		message: 'PIN-код должен состоять из 4-6 цифр.'
	})
	pinCode: string;

	/**
	 * Реальное имя DJ (для договора/связи).
	 * @example "Рустам Каримов"
	 */
	@IsOptional()
	@IsString({ message: 'Реальное имя должно быть строкой.' })
	realName?: string;

	/**
	 * Telegram ID или username (для Telegram бота / WebApp).
	 * @example "712345678"
	 */
	@IsOptional()
	@IsString({ message: 'Telegram ID должен быть строкой.' })
	telegramId?: string;

	/**
	 * Ссылка на аватар/фото DJ.
	 */
	@IsOptional()
	@IsString({ message: 'Ссылка на аватар должна быть строкой.' })
	avatarUrl?: string;

	/**
	 * Является ли основным резидентом этого заведения.
	 */
	@IsOptional()
	@IsBoolean({ message: 'Флаг резидента должен быть булевым значением.' })
	isDefault?: boolean;
}
