// api/user/account.js - Delete user account (GDPR)
import prisma from '../../lib/db.js';
import { cors, withAuth, withErrorHandler, parseBody } from '../../lib/middleware.js';

async function handler(req, res) {
  if (req.method === 'DELETE') {
    // Delete user and all related data (cascading delete)
    await prisma.user.delete({
      where: { id: req.userId },
    });

    return res.status(200).json({
      message: 'Account deleted successfully',
      deletedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'GET') {
    // Get account info and deletion preview
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        _count: {
          select: {
            voiceProfile: true,
            rewriteEvents: true,
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
      dataToBeDeleted: {
        voiceProfiles: user._count.voiceProfile,
        rewriteEvents: user._count.rewriteEvents,
      },
      warning: 'Deleting your account will permanently remove all your data including writing samples, voice profile, and rewrite history. This action cannot be undone.',
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET and DELETE requests are accepted' });
}

export default cors(withAuth(withErrorHandler(handler)));
