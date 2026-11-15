export interface ResetPasswordTemplateProps {
  domain: string;
  token: string;
}

/**
 * HTML-шаблон письма восстановления пароля TrackUp.
 */
export function ResetPasswordTemplate({ domain, token }: ResetPasswordTemplateProps): string {
  const resetLink = `${domain.replace(/\/+$/, '')}/auth/new-password?token=${encodeURIComponent(token)}`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сброс пароля — TrackUp</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0b0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0b0f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #16151a; border-radius: 20px; border: 1px solid #27252f; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid #22202a;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); border-radius: 12px; font-weight: 800; font-size: 22px; color: #ffffff; text-align: center;">T</div>
              <h1 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">TrackUp</h1>
              <p style="margin: 0; font-size: 13px; color: #a1a1aa;">Восстановление доступа к аккаунту</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #ffffff;">🔐 Сброс пароля</h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #d4d4d8;">
                Мы получили запрос на сброс пароля для вашего аккаунта на <strong>TrackUp</strong>. Нажмите на кнопку ниже, чтобы установить новый пароль:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4); text-align: center;">
                      🔑 Создать новый пароль
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 12px; color: #71717a;">
                Или скопируйте ссылку в адресную строку браузера:
              </p>
              <p style="margin: 0 0 24px 0; word-break: break-all; font-size: 12px; line-height: 1.5;">
                <a href="${resetLink}" target="_blank" style="color: #c084fc; text-decoration: underline;">${resetLink}</a>
              </p>

              <!-- Security info -->
              <div style="background-color: #1f1d26; border-radius: 12px; padding: 16px; border: 1px solid #2e2b38;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #e4e4e7;">🔒 Безопасность</p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                  • Ссылка действительна в течение <strong>1 часа</strong>.<br>
                  • Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо, ваш пароль останется прежним.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #111015; border-top: 1px solid #22202a; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #71717a;">
                © ${new Date().getFullYear()} TrackUp. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
