import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO для старта смены DJ в заведении.
 */
export class StartShiftDto {
	/**
	 * ID заведения, в котором DJ начинает смену.
	 */
	@IsString({ message: 'ID заведения должен быть строкой.' })
	@IsNotEmpty({ message: 'ID заведения обязателен.' })
	venueId: string;
}
