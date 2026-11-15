import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import { ConfirmationTemplate } from './templates/confirmation.template.js';
import { ResetPasswordTemplate } from './templates/reset-password.template.js';
import { TwoFactorAuthTemplate } from './templates/two-factor-auth.template.js';

/**
 * Сервис для отправки email-сообщений через Nodemailer.
 * Полностью автономен, нативен для Node ESM и не имеет проблем несовместимости с Serverless/Vercel.
 */
@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly transporter: Transporter;

	public constructor(private readonly configService: ConfigService) {
		const host = this.configService.get<string>('MAIL_HOST') || 'smtp.gmail.com';
		const port = Number(this.configService.get<number | string>('MAIL_PORT')) || 587;
		const user = this.configService.get<string>('MAIL_LOGIN');
		const pass = this.configService.get<string>('MAIL_PASSWORD');

		this.transporter = nodemailer.createTransport({
			host,
			port,
			secure: port === 465,
			auth: user && pass ? { user, pass } : undefined,
		});
	}

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
	 */
	public async sendConfirmationEmail(email: string, token: string) {
		const domain = this.getClientUrl();
		const html = ConfirmationTemplate({ domain, token });

		return this.sendMail(email, 'Подтверждение почты', html);
	}

	/**
	 * Отправляет email для сброса пароля.
	 */
	public async sendPasswordResetEmail(email: string, token: string) {
		const domain = this.getClientUrl();
		const html = ResetPasswordTemplate({ domain, token });

		return this.sendMail(email, 'Сброс пароля', html);
	}

	/**
	 * Отправляет email с токеном двухфакторной аутентификации.
	 */
	public async sendTwoFactorTokenEmail(email: string, token: string) {
		const html = TwoFactorAuthTemplate({ token });

		return this.sendMail(email, 'Подтверждение вашей личности', html);
	}

	/**
	 * Отправляет email-сообщение через Nodemailer.
	 */
	private async sendMail(email: string, subject: string, html: string) {
		const fromEmail = this.configService.get<string>('MAIL_LOGIN') || 'no-reply@trackup.uz';
		const from = `"TrackUp Team" <${fromEmail}>`;

		try {
			return await this.transporter.sendMail({
				from,
				to: email,
				subject,
				html,
			});
		} catch (error) {
			this.logger.error(
				`Не удалось отправить email на ${email}: ${
					error instanceof Error ? error.message : error
				}`
			);
			throw error;
		}
	}
}
