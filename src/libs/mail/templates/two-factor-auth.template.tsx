import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text
} from "@react-email/components"
import React from "react"

interface TwoFactorAuthTemplateProps {
	token: string
}

/**
 * Красивый шаблон письма для двухфакторной аутентификации на форуме Mirchan.
 * Современный дизайн с крупным кодом, градиентным хедером и адаптивной версткой.
 *
 * @param {TwoFactorAuthTemplateProps} props - Токен для двухфакторной аутентификации.
 * @returns {JSX.Element} Сгенерированный шаблон письма.
 */

export function TwoFactorAuthTemplate({ token }: TwoFactorAuthTemplateProps) {
	return (
		<Html>
			<Head />
			<Preview>Ваш код безопасности для входа в Mirchan 🔐</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Логотип и заголовок */}
					<Section style={header}>
						<Heading style={logo}>🌐 Mirchan</Heading>
						<Text style={tagline}>Двухфакторная аутентификация</Text>
					</Section>

					{/* Основной контент */}
					<Section style={content}>
						<Heading style={h1}>🔐 Код безопасности</Heading>

						<Text style={text}>
							Кто-то пытается войти в ваш аккаунт на <strong>Mirchan</strong>.
						</Text>

						<Text style={text}>
							Используйте код ниже для завершения входа:
						</Text>

						{/* Код с крупным шрифтом */}
						<Section style={codeContainer}>
							<Text style={codeBox}>{token}</Text>
						</Section>

						<Text style={textCentered}>
							Введите этот код на странице входа
						</Text>

						<Hr style={hr} />

						{/* Информация о безопасности */}
						<Section style={securityBox}>
							<Text style={securityTitle}>🛡️ Важная информация</Text>
							<Text style={securityText}>
								• Код действителен <strong>5 минут</strong>
								<br />
								• Никогда не передавайте этот код третьим лицам
								<br />
								• Если вы не пытались войти, немедленно смените пароль
								<br />
								• Код можно использовать только один раз
							</Text>
						</Section>

						{/* Предупреждение */}
						<Section style={warningBox}>
							<Text style={warningTitle}>⚠️ Подозрительная активность?</Text>
							<Text style={warningText}>
								Если вы не запрашивали этот код, ваш аккаунт может быть под угрозой.
								Немедленно измените пароль и проверьте настройки безопасности.
							</Text>
						</Section>

						{/* Дополнительная информация */}
						<Section style={infoBox}>
							<Text style={infoText}>
								💡 <strong>Совет:</strong> Включите приложение-аутентификатор (Google Authenticator, Authy)
								для еще более безопасного входа без email-кодов.
							</Text>
						</Section>
					</Section>

					{/* Футер */}
					<Section style={footer}>
						<Text style={footerText}>
							© {new Date().getFullYear()} Mirchan Forum. Все права защищены.
						</Text>
						<Text style={footerSmall}>
							Это автоматическое письмо, отвечать на него не нужно.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

// Стили
const main = {
	backgroundColor: '#f6f9fc',
	fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
	backgroundColor: '#ffffff',
	margin: '0 auto',
	padding: '20px 0 48px',
	marginBottom: '64px',
	maxWidth: '600px',
	borderRadius: '12px',
	boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
}

const header = {
	padding: '32px 40px',
	textAlign: 'center' as const,
	background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
	borderRadius: '12px 12px 0 0',
}

const logo = {
	color: '#ffffff',
	fontSize: '32px',
	fontWeight: 'bold',
	margin: '0 0 8px',
	textAlign: 'center' as const,
}

const tagline = {
	color: '#e0e7ff',
	fontSize: '14px',
	margin: '0',
	textAlign: 'center' as const,
}

const content = {
	padding: '40px',
}

const h1 = {
	color: '#1f2937',
	fontSize: '28px',
	fontWeight: 'bold',
	margin: '0 0 24px',
	textAlign: 'center' as const,
}

const text = {
	color: '#374151',
	fontSize: '16px',
	lineHeight: '26px',
	margin: '16px 0',
}

const textCentered = {
	color: '#6b7280',
	fontSize: '14px',
	lineHeight: '22px',
	margin: '16px 0',
	textAlign: 'center' as const,
}

const codeContainer = {
	textAlign: 'center' as const,
	margin: '32px 0',
}

const codeBox = {
	backgroundColor: '#f3f4f6',
	border: '3px dashed #667eea',
	borderRadius: '12px',
	color: '#1f2937',
	fontSize: '48px',
	fontWeight: 'bold',
	letterSpacing: '8px',
	padding: '24px 32px',
	margin: '0',
	fontFamily: 'Monaco, Courier, monospace',
	display: 'inline-block',
	boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
}

const hr = {
	borderColor: '#e5e7eb',
	margin: '32px 0',
}

const securityBox = {
	backgroundColor: '#f3f4f6',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
}

const securityTitle = {
	color: '#1f2937',
	fontSize: '16px',
	fontWeight: 'bold',
	margin: '0 0 12px',
}

const securityText = {
	color: '#4b5563',
	fontSize: '14px',
	lineHeight: '22px',
	margin: '0',
}

const warningBox = {
	backgroundColor: '#fef2f2',
	borderRadius: '8px',
	padding: '20px',
	margin: '24px 0',
	border: '2px solid #fecaca',
}

const warningTitle = {
	color: '#991b1b',
	fontSize: '16px',
	fontWeight: 'bold',
	margin: '0 0 12px',
}

const warningText = {
	color: '#dc2626',
	fontSize: '14px',
	lineHeight: '22px',
	margin: '0',
}

const infoBox = {
	backgroundColor: '#eff6ff',
	borderRadius: '8px',
	padding: '16px',
	margin: '24px 0',
	border: '1px solid #dbeafe',
}

const infoText = {
	color: '#1e40af',
	fontSize: '14px',
	lineHeight: '22px',
	margin: '0',
}

const footer = {
	padding: '0 40px 32px',
	textAlign: 'center' as const,
}

const footerText = {
	color: '#6b7280',
	fontSize: '14px',
	margin: '8px 0',
}

const footerSmall = {
	color: '#9ca3af',
	fontSize: '12px',
	margin: '16px 0 0',
}