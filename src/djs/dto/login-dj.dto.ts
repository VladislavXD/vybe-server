import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * DTO для быстрого входа DJ по номеру телефона и PIN-коду.
 */
export class LoginDjDto {
	/**
	 * Номер телефона DJ.
	 * @example "+998901234567"
	 */
	@IsString({ message: 'Номер телефона должен быть строкой.' })
	@IsNotEmpty({ message: 'Номер телефона обязателен.' })
	phone: string;

	/**
	 * 4-6 значный PIN-код.
	 * @example "1234"
	 */
	@IsString({ message: 'PIN-код должен быть строкой.' })
	@IsNotEmpty({ message: 'PIN-код обязателен.' })
	@Matches(/^[0-9]{4,6}$/, {
		message: 'PIN-код должен состоять из 4-6 цифр.'
	})
	pinCode: string;
}
