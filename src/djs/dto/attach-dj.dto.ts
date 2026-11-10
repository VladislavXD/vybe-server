import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * DTO для прикрепления существующего в системе DJ к заведению.
 */
export class AttachDjDto {
	/**
	 * ID существующего DJ (если известен).
	 */
	@IsOptional()
	@IsString({ message: 'ID DJ должен быть строкой.' })
	djId?: string;

	/**
	 * Номер телефона DJ (альтернативный поиск).
	 */
	@IsOptional()
	@IsString({ message: 'Номер телефона должен быть строкой.' })
	phone?: string;

	/**
	 * Является ли основным резидентом заведения.
	 */
	@IsOptional()
	@IsBoolean({ message: 'Флаг резидента должен быть булевым значением.' })
	isDefault?: boolean;
}
