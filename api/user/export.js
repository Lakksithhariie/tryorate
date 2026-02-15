// api/user/export.js - GDPR data export
import prisma from '../../lib/db.js';
import { cors, withAuth, withErrorHandler } from '../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET requests are accepted' });
  }

  // Fetch all user data
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      voiceProfile: true,
      rewriteEvents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  // Prepare export data (excluding sensitive auth tokens)
  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    voiceProfile: user.voiceProfile ? {
      id: user.voiceProfile.id,
      samples: user.voiceProfile.samples,
      profileData: user.voiceProfile.profileData,
      summaryText: user.voiceProfile.summaryText,
      updatedAt: user.voiceProfile.updatedAt,
    } : null,
    rewriteEvents: user.rewriteEvents.map(event => ({
      id: event.id,
      originalText: event.originalText,
      rewrittenText: event.rewrittenText,
      userAction: event.userAction,
      userEditedText: event.userEditedText,
      modelUsed: event.modelUsed,
      createdAt: event.createdAt,
    })),
    stats: {
      totalRewriteEvents: user.rewriteEvents.length,
      acceptedCount: user.rewriteEvents.filter(e => e.userAction === 'accept').length,
      editedCount: user.rewriteEvents.filter(e => e.userAction === 'edit').length,
      rejectedCount: user.rewriteEvents.filter(e => e.userAction === 'reject').length,
      sampleCount: user.voiceProfile?.samples?.length || 0,
    },
  };

  // Set headers for JSON download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="orate-export-${user.id}.json"`);

  return res.status(200).json(exportData);
}

export default cors(withAuth(withErrorHandler(handler)));
