import { ConfigService } from '@nestjs/config';

import { isDev } from '../libs/common/utils/is-dev.util.js';

export interface SmtpMailerConfig {
	transport: {
		host: string;
		port: number;
		secure: boolean;
		auth: {
			user: string;
			pass: string;
		};
	};
	defaults: {
		from: string;
	};
}

/**
 * Конфигурация для SMTP почтового сервера.
 */
export const getMailerConfig = async (
	configService: ConfigService
): Promise<SmtpMailerConfig> => ({
	transport: {
		host: configService.get<string>('MAIL_HOST') || 'smtp.gmail.com',
		port: Number(configService.get('MAIL_PORT')) || 587,
		secure: !isDev(configService),
		auth: {
			user: configService.get<string>('MAIL_LOGIN') || '',
			pass: configService.get<string>('MAIL_PASSWORD') || ''
		}
	},
	defaults: {
		from: `"TrackUp Team" <${configService.get<string>('MAIL_LOGIN') || 'no-reply@trackup.uz'}>`
	}
});
