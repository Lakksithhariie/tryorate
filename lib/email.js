// lib/email.js - Resend email service
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'hello@orate.app';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://tryorate.cc';

/**
 * Send magic link email for authentication
 * @param {string} email - Recipient email
 * @param {string} token - Magic token
 * @returns {Promise<void>}
 */
export async function sendMagicLinkEmail(email, token) {
  const magicLink = `${FRONTEND_URL}/auth/verify?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: `Orate <${FROM_EMAIL}>`,
      to: email,
      subject: 'Sign in to Orate',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sign in to Orate</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF9;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 40px 20px;">
                  <table role="presentation" style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 32px;">
                        <h1 style="margin: 0 0 16px 0; color: #1A1A2E; font-size: 24px; font-weight: 700;">Sign in to Orate</h1>
                        <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 16px; line-height: 1.5;">
                          Click the button below to sign in to your Orate account. This link will expire in 10 minutes.
                        </p>
                        <table role="presentation" style="margin: 32px 0;">
                          <tr>
                            <td style="border-radius: 8px; background-color: #6C63FF;">
                              <a href="${magicLink}" style="display: inline-block; padding: 14px 28px; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Sign in to Orate</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0 0; color: #9CA3AF; font-size: 14px; line-height: 1.5;">
                          Or copy and paste this URL into your browser:<br>
                          <a href="${magicLink}" style="color: #6C63FF; word-break: break-all;">${magicLink}</a>
                        </p>
                        <hr style="margin: 32px 0; border: none; border-top: 1px solid #E5E7EB;">
                        <p style="margin: 0; color: #9CA3AF; font-size: 12px; line-height: 1.5;">
                          If you didn't request this email, you can safely ignore it.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `Sign in to Orate\n\nClick this link to sign in:\n${magicLink}\n\nThis link will expire in 10 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send magic link email');
  }
}
