// api/auth/verify.js - Verify magic link
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { createJWT } from '../../lib/auth.js';
import { cors, withErrorHandler, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  token: z.string().uuid('Invalid token format'),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  const body = await parseBody(req);
  const { token } = schema.parse(body);

  // Find user by magic token
  const user = await prisma.user.findFirst({
    where: {
      magicToken: token,
      magicTokenExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired magic link',
    });
  }

  // Create JWT
  const jwt = await createJWT(user.id);

  // Clear magic token (single-use)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      magicToken: null,
      magicTokenExpires: null,
    },
  });

  return res.status(200).json({
    token: jwt,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}

export default cors(withErrorHandler(handler));
