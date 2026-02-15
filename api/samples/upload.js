// api/samples/upload.js - Upload DOCX/TXT file
import prisma from '../../lib/db.js';
import { parseFile } from '../../lib/file-parser.js';
import { countWords, validateWordCount } from '../../lib/text-analysis.js';
import { cors, withAuth, withErrorHandler, parseMultipart } from '../../lib/middleware.js';

const MIN_SAMPLE_WORDS = 100;
const MAX_SAMPLES = 10;
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  // Parse multipart form
  const { file } = await parseMultipart(req);

  if (!file) {
    return res.status(400).json({ error: 'Validation Error', message: 'No file uploaded' });
  }

  // Check file size
  if (file.buffer.length > MAX_FILE_SIZE) {
    return res.status(400).json({
      error: 'File Too Large',
      message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    });
  }

  // Parse file content
  let text;
  try {
    text = await parseFile(file.buffer, file.mimetype);
  } catch (error) {
    return res.status(400).json({
      error: 'Parse Error',
      message: error.message,
    });
  }

  // Validate word count
  const wordCount = countWords(text);
  if (wordCount < MIN_SAMPLE_WORDS) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Extracted text must be at least ${MIN_SAMPLE_WORDS} words (found ${wordCount})`,
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
    filename: file.filename,
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
    message: 'File uploaded successfully',
    sampleId: newSample.id,
    filename: file.filename,
    sampleCount: updatedSamples.length,
    totalWords: validation.totalWords,
    minWordsMet: validation.valid,
  });
}

export default cors(withAuth(withErrorHandler(handler)));
