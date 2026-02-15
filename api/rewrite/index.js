// api/rewrite/index.js - Rewrite text using voice profile
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { rewriteText } from '../../lib/llm.js';
import { extractFewShotExamples } from '../../lib/text-analysis.js';
import { cors, withAuth, withErrorHandler, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  text: z.string().min(1, 'Text is required').max(5000, 'Text is too long (max ~1000 tokens)'),
});

const MAX_TOKENS = 1000;

// Rough token estimation
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  const body = await parseBody(req);
  const { text } = schema.parse(body);

  // Check token limit
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens > MAX_TOKENS) {
    return res.status(400).json({
      error: 'Text Too Long',
      message: `Text exceeds maximum length (~${MAX_TOKENS} tokens). Please select a shorter passage.`,
      estimatedTokens,
      maxTokens: MAX_TOKENS,
    });
  }

  // Get user's voice profile
  const voiceProfile = await prisma.voiceProfile.findUnique({
    where: { userId: req.userId },
  });

  if (!voiceProfile || !voiceProfile.profileData) {
    return res.status(400).json({
      error: 'Profile Not Ready',
      message: 'Voice profile not found or not built. Please submit samples and build your profile first.',
    });
  }

  // Extract few-shot examples from samples
  const samples = voiceProfile.samples || [];
  const sampleTexts = samples.map(s => s.text);
  const fewShotExamples = extractFewShotExamples(sampleTexts);

  try {
    // Perform rewrite
    const { rewritten, model } = await rewriteText(text, voiceProfile.profileData, fewShotExamples);

    // Log the rewrite event
    const rewriteEvent = await prisma.rewriteEvent.create({
      data: {
        userId: req.userId,
        originalText: text,
        rewrittenText: rewritten,
        modelUsed: model,
      },
    });

    return res.status(200).json({
      original: text,
      rewritten,
      eventId: rewriteEvent.id,
      model,
    });

  } catch (error) {
    console.error('Rewrite error:', error);
    return res.status(500).json({
      error: 'Rewrite Failed',
      message: 'Failed to rewrite text. Please try again.',
    });
  }
}

export default cors(withAuth(withErrorHandler(handler)));
