export interface TwoFactorAuthTemplateProps {
  token: string;
}

/**
 * HTML-шаблон письма с кодом 2FA TrackUp.
 */
export function TwoFactorAuthTemplate({ token }: TwoFactorAuthTemplateProps): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Код безопасности — TrackUp</title>
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
              <p style="margin: 0; font-size: 13px; color: #a1a1aa;">Двухфакторная аутентификация</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 36px; text-align: center;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #ffffff;">🔐 Код подтверждения</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #d4d4d8;">
                Используйте этот одноразовый код для подтверждения входа в аккаунт:
              </p>

              <!-- Code box -->
              <div style="display: inline-block; padding: 18px 36px; background-color: #1f1d26; border-radius: 16px; border: 2px dashed #a855f7; margin: 0 auto 24px auto;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #c084fc;">
                  ${token}
                </span>
              </div>

              <p style="margin: 0 0 24px 0; font-size: 12px; color: #a1a1aa;">
                Код действителен в течение <strong>5 минут</strong>.
              </p>

              <!-- Security info -->
              <div style="background-color: #1a1820; border-radius: 12px; padding: 16px; border: 1px solid #2e2b38; text-align: left;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                  ⚠️ Никому не сообщайте этот код. Если это были не вы, немедленно смените пароль.
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
