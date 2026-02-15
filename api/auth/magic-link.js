// api/auth/magic-link.js - Request magic link
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { generateMagicToken } from '../../lib/auth.js';
import { sendMagicLinkEmail } from '../../lib/email.js';
import { cors, withErrorHandler, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  try {
    const body = await parseBody(req);
    const { email } = schema.parse(body);

    console.log(`[Magic Link] Processing request for: ${email}`);

    // Generate magic token
    const { token, expiresAt } = generateMagicToken();
    console.log(`[Magic Link] Generated token for: ${email}`);

  // Upsert user with magic token
  try {
    await prisma.user.upsert({
      where: { email },
      update: {
        magicToken: token,
        magicTokenExpiresAt: expiresAt,
      },
      create: {
        email,
        magicToken: token,
        magicTokenExpiresAt: expiresAt,
      },
    });
      console.log(`[Magic Link] User upserted: ${email}`);
    } catch (dbError) {
      console.error(`[Magic Link] Database error:`, dbError);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to save user data. Please try again.',
      });
    }

    // Send email
    try {
      await sendMagicLinkEmail(email, token);
      console.log(`[Magic Link] Email sent to: ${email}`);
    } catch (emailError) {
      console.error(`[Magic Link] Email error:`, emailError);
      return res.status(500).json({
        error: 'Email Error',
        message: 'Failed to send email. Please check your email address and try again.',
      });
    }

    return res.status(200).json({
      message: 'Magic link sent to your email',
      email,
    });
  } catch (error) {
    console.error(`[Magic Link] Unexpected error:`, error);
    throw error;
  }
}

export default cors(withErrorHandler(handler));
