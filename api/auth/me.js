// api/auth/me.js - Get current user
import prisma from '../../lib/db.js';
import { cors, withAuth, withErrorHandler } from '../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET requests are accepted' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      voiceProfile: {
        select: {
          id: true,
          summaryText: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  return res.status(200).json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    voiceProfile: user.voiceProfile,
  });
}

export default cors(withAuth(withErrorHandler(handler)));
