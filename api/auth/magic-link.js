// api/auth/magic-link.js - Request magic link
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { generateMagicToken } from '../../lib/auth.js';
import { sendMagicLinkEmail } from '../../lib/email.js';
import { cors, withErrorHandler, withRateLimit, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  const body = await parseBody(req);
  const { email } = schema.parse(body);

  // Generate magic token
  const { token, expiresAt } = generateMagicToken();

  // Upsert user with magic token
  await prisma.user.upsert({
    where: { email },
    update: {
      magicToken: token,
      magicTokenExpires: expiresAt,
    },
    create: {
      email,
      magicToken: token,
      magicTokenExpires: expiresAt,
    },
  });

  // Send email
  await sendMagicLinkEmail(email, token);

  return res.status(200).json({
    message: 'Magic link sent to your email',
    email,
  });
}

export default cors(withRateLimit(withErrorHandler(handler), { requests: 5, window: '1 h' }));
