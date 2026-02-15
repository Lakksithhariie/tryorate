// api/samples/submit.js - Submit writing sample text
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { countWords, validateWordCount } from '../../lib/text-analysis.js';
import { cors, withAuth, withErrorHandler, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  text: z.string().min(1, 'Text is required').max(100000, 'Text is too long'),
});

const MIN_SAMPLE_WORDS = 100;
const MAX_SAMPLES = 10;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  const body = await parseBody(req);
  const { text } = schema.parse(body);

  // Validate minimum word count for this sample
  const wordCount = countWords(text);
  if (wordCount < MIN_SAMPLE_WORDS) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Sample must be at least ${MIN_SAMPLE_WORDS} words (found ${wordCount})`,
      wordCount,
    });
  }

  // Get or create voice profile
  let voiceProfile = await prisma.voiceProfile.findUnique({
    where: { userId: req.userId },
  });

  if (!voiceProfile) {
    voiceProfile = await prisma.voiceProfile.create({
      data: {
        userId: req.userId,
        samples: [],
      },
    });
  }

  // Check sample limit
  const currentSamples = voiceProfile.samples || [];
  if (currentSamples.length >= MAX_SAMPLES) {
    return res.status(400).json({
      error: 'Limit Reached',
      message: `Maximum ${MAX_SAMPLES} samples allowed. Please delete a sample first.`,
    });
  }

  // Add new sample
  const newSample = {
    id: crypto.randomUUID(),
    text,
    wordCount,
    submittedAt: new Date().toISOString(),
  };

  const updatedSamples = [...currentSamples, newSample];

  // Update profile
  await prisma.voiceProfile.update({
    where: { userId: req.userId },
    data: { samples: updatedSamples },
  });

  // Calculate total words
  const validation = validateWordCount(updatedSamples.map(s => s.text));

  return res.status(200).json({
    message: 'Sample submitted successfully',
    sampleId: newSample.id,
    sampleCount: updatedSamples.length,
    totalWords: validation.totalWords,
    minWordsMet: validation.valid,
  });
}

export default cors(withAuth(withErrorHandler(handler)));
