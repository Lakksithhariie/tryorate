// api/profile/index.js - Get voice profile
import prisma from '../../lib/db.js';
import { cors, withAuth, withErrorHandler } from '../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET requests are accepted' });
  }

  const voiceProfile = await prisma.voiceProfile.findUnique({
    where: { userId: req.userId },
  });

  if (!voiceProfile) {
    return res.status(404).json({ error: 'Not Found', message: 'Voice profile not found' });
  }

  // Calculate sample stats
  const samples = voiceProfile.samples || [];
  const totalWords = samples.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return res.status(200).json({
    id: voiceProfile.id,
    summaryText: voiceProfile.summaryText,
    profileData: voiceProfile.profileData,
    samples: samples.map(s => ({
      id: s.id,
      wordCount: s.wordCount,
      submittedAt: s.submittedAt,
      filename: s.filename,
      preview: s.text?.substring(0, 200) + (s.text?.length > 200 ? '...' : ''),
    })),
    sampleCount: samples.length,
    totalWords,
    updatedAt: voiceProfile.updatedAt,
  });
}

export default cors(withAuth(withErrorHandler(handler)));
