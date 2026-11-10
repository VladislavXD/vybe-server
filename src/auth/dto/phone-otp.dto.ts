import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestPhoneOtpDto { 
	@Transform(({ value }: { value: unknown }) => {
		if (typeof value !== 'string') return value;
		let cleaned = value.replace(/[\s\-()]/g, '');
		if (cleaned.startsWith('998') && !cleaned.startsWith('+')) {
			cleaned = `+${cleaned}`;
		}
		return cleaned;
	})
	@Matches(/^\+998\d{9}$/, { message: 'Формат номера телефона: +998XXXXXXXXX' })
	phone: string;
}

export class VerifyPhoneOtpDto extends RequestPhoneOtpDto { 
	@IsString({ message: 'Код подтверждения должен быть строкой' })
	@Length(6, 6, { message: 'Код должен состоять из 6 цифр' })
	code: string;

	@IsOptional()
	@IsString({ message: 'Имя должно быть строкой' })
	name?: string;
}