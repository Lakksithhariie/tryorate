// api/profile/build.js - Build voice profile from samples
import prisma from '../../lib/db.js';
import { analyzeStyle, generateProfileSummary } from '../../lib/llm.js';
import { analyzeStructure, validateWordCount } from '../../lib/text-analysis.js';
import { cors, withAuth, withErrorHandler } from '../../lib/middleware.js';

const MIN_TOTAL_WORDS = 1500;
const MIN_SAMPLES = 3;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  // Get user's voice profile with samples
  const voiceProfile = await prisma.voiceProfile.findUnique({
    where: { userId: req.userId },
  });

  if (!voiceProfile) {
    return res.status(404).json({ error: 'Not Found', message: 'Voice profile not found' });
  }

  const samples = voiceProfile.samples || [];

  // Validate minimum requirements
  if (samples.length < MIN_SAMPLES) {
    return res.status(400).json({
      error: 'Insufficient Samples',
      message: `At least ${MIN_SAMPLES} samples are required (found ${samples.length})`,
      samplesSubmitted: samples.length,
    });
  }

  const sampleTexts = samples.map(s => s.text);
  const validation = validateWordCount(sampleTexts, MIN_TOTAL_WORDS);

  if (!validation.valid) {
    return res.status(400).json({
      error: 'Insufficient Word Count',
      message: `Total word count must be at least ${MIN_TOTAL_WORDS} (found ${validation.totalWords})`,
      totalWords: validation.totalWords,
      requiredWords: MIN_TOTAL_WORDS,
    });
  }

  try {
    // Step 1: Structural analysis using compromise
    const structuralAnalyses = sampleTexts.map(text => analyzeStructure(text));
    
    // Aggregate structural metrics
    const avgSentenceLength = structuralAnalyses.reduce((sum, a) => sum + a.metrics.avgSentenceLength, 0) / structuralAnalyses.length;
    const avgWordLength = structuralAnalyses.reduce((sum, a) => sum + a.metrics.avgWordLength, 0) / structuralAnalyses.length;
    const totalPunctuation = structuralAnalyses.reduce((sum, a) => ({
      emDash: sum.emDash + a.punctuation.emDash,
      semicolons: sum.semicolons + a.punctuation.semicolons,
      exclamations: sum.exclamations + a.punctuation.exclamations,
    }), { emDash: 0, semicolons: 0, exclamations: 0 });

    // Step 2: Style analysis using LLM
    const styleProfile = await analyzeStyle(sampleTexts);

    // Step 3: Merge structural and style analysis
    const mergedProfile = {
      ...styleProfile,
      structuralMetrics: {
        averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        averageWordLength: Math.round(avgWordLength * 10) / 10,
        punctuationFrequency: {
          emDashesPer1000: Math.round((totalPunctuation.emDash / validation.totalWords) * 1000),
          semicolonsPer1000: Math.round((totalPunctuation.semicolons / validation.totalWords) * 1000),
          exclamationsPer1000: Math.round((totalPunctuation.exclamations / validation.totalWords) * 1000),
        },
      },
    };

    // Step 4: Generate human-readable summary
    const summaryText = await generateProfileSummary(mergedProfile);

    // Step 5: Update database
    await prisma.voiceProfile.update({
      where: { userId: req.userId },
      data: {
        profileData: mergedProfile,
        summaryText,
      },
    });

    return res.status(200).json({
      message: 'Voice profile built successfully',
      summaryText,
      profileData: mergedProfile,
      sampleCount: samples.length,
      totalWords: validation.totalWords,
    });

  } catch (error) {
    console.error('Profile build error:', error);
    return res.status(500).json({
      error: 'Build Failed',
      message: 'Failed to build voice profile. Please try again.',
    });
  }
}

export default cors(withAuth(withErrorHandler(handler)));
