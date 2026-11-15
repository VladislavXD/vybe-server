import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConfirmationTemplate } from './templates/confirmation.template.js';
import { ResetPasswordTemplate } from './templates/reset-password.template.js';
import { TwoFactorAuthTemplate } from './templates/two-factor-auth.template.js';

/**
 * Сервис для отправки email-сообщений.
 *
 * Предоставляет методы для отправки различных типов email-сообщений,
 * включая подтверждение почты, сброс пароля и двухфакторную аутентификацию.
 */
@Injectable()
export class MailService {
	/**
	 * Конструктор сервиса почты.
	 * @param mailerService - Сервис для работы с отправкой email.
	 * @param configService - Сервис для работы с конфигурацией приложения.
	 */
	public constructor(
		private readonly mailerService: MailerService,
		private readonly configService: ConfigService
	) {}

	/**
	 * Извлекает базовый URL клиентского приложения.
	 */
	private getClientUrl(): string {
		const raw =
			this.configService.get<string>('CLIENT_URL') ||
			this.configService.get<string>('ALLOWED_ORIGIN') ||
			'http://localhost:3000';
		return raw.split(',')[0].trim().replace(/\/+$/, '');
	}

	/**
	 * Отправляет email для подтверждения адреса электронной почты.
	 * @param email - Адрес электронной почты получателя.
	 * @param token - Токен подтверждения.
	 * @returns Промис, который разрешается при успешной отправке.
	 */
	public async sendConfirmationEmail(email: string, token: string) {
		const domain = this.getClientUrl();
		const html = ConfirmationTemplate({ domain, token });

		return this.sendMail(email, 'Подтверждение почты', html);
	}

	/**
	 * Отправляет email для сброса пароля.
	 * @param email - Адрес электронной почты получателя.
	 * @param token - Токен для сброса пароля.
	 * @returns Промис, который разрешается при успешной отправке.
	 */
	public async sendPasswordResetEmail(email: string, token: string) {
		const domain = this.getClientUrl();
		const html = ResetPasswordTemplate({ domain, token });

		return this.sendMail(email, 'Сброс пароля', html);
	}

	/**
	 * Отправляет email с токеном двухфакторной аутентификации.
	 * @param email - Адрес электронной почты получателя.
	 * @param token - Токен двухфакторной аутентификации.
	 * @returns Промис, который разрешается при успешной отправке.
	 */
	public async sendTwoFactorTokenEmail(email: string, token: string) {
		const html = TwoFactorAuthTemplate({ token });

		return this.sendMail(email, 'Подтверждение вашей личности', html);
	}

	/**
	 * Отправляет email-сообщение.
	 * @param email - Адрес электронной почты получателя.
	 * @param subject - Тема email-сообщения.
	 * @param html - HTML-содержимое email-сообщения.
	 * @returns Промис, который разрешается при успешной отправке.
	 */
	private sendMail(email: string, subject: string, html: string) {
		return this.mailerService.sendMail({
			to: email,
			subject,
			html
		});
	}
}
