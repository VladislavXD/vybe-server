import {
	IsBoolean,
	IsOptional,
	IsString,
	Matches
} from 'class-validator';

/**
 * DTO для обновления данных DJ.
 */
export class UpdateDjDto {
	@IsOptional()
	@IsString({ message: 'Сценическое имя должно быть строкой.' })
	name?: string;

	@IsOptional()
	@IsString({ message: 'Номер телефона должен быть строкой.' })
	phone?: string;

	@IsOptional()
	@IsString({ message: 'PIN-код должен быть строкой.' })
	@Matches(/^[0-9]{4,6}$/, {
		message: 'PIN-код должен состоять из 4-6 цифр.'
	})
	pinCode?: string;

	@IsOptional()
	@IsString({ message: 'Реальное имя должно быть строкой.' })
	realName?: string;

	@IsOptional()
	@IsString({ message: 'Telegram ID должен быть строкой.' })
	telegramId?: string;

	@IsOptional()
	@IsString({ message: 'Ссылка на аватар должна быть строкой.' })
	avatarUrl?: string;

	@IsOptional()
	@IsBoolean({ message: 'Статус активности должен быть булевым значением.' })
	isActive?: boolean;
}
