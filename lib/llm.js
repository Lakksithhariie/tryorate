// lib/llm.js - Groq API client for LLM operations
import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Model routing based on token count
const MODEL_20B = 'gpt-oss-20b';
const MODEL_120B = 'gpt-oss-120b';
const TOKEN_THRESHOLD = 200;

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 chars)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Select appropriate model based on token count
 * @param {string} text - Input text
 * @returns {string} Model identifier
 */
export function selectModel(text) {
  const tokens = estimateTokens(text);
  return tokens <= TOKEN_THRESHOLD ? MODEL_20B : MODEL_120B;
}

/**
 * Analyze writing style using LLM
 * @param {string[]} samples - Array of writing samples
 * @returns {Promise<Object>} Structured style analysis
 */
export async function analyzeStyle(samples) {
  const combinedText = samples.join('\n\n---\n\n');
  
  const systemPrompt = `You are a writing style analyst. Analyze the following writing samples and provide a detailed voice profile.

Extract the following dimensions:
1. Sentence structure patterns (length, complexity, variety)
2. Vocabulary preferences (jargon level, word length, formality)
3. Tone qualities (warmth, directness, humor, formality)
4. Punctuation habits (em dashes, semicolons, exclamation marks)
5. Paragraph organization (lead style, flow)
6. Rhetorical patterns (how arguments are built)
7. Distinctive phrases or constructions

Return your analysis as a JSON object with these keys:
- sentenceStructure: { averageLength: number, complexity: "simple|moderate|complex", variety: "low|medium|high", patterns: string[] }
- vocabulary: { formality: "casual|neutral|formal", richness: "basic|moderate|rich", jargonLevel: "none|light|moderate|heavy", preferences: string[] }
- tone: { warmth: "cool|neutral|warm", directness: "indirect|balanced|direct", humor: "none|subtle|moderate|strong", formality: "casual|professional|formal" }
- punctuation: { emDashUsage: "none|rare|occasional|frequent", semicolonUsage: "none|rare|occasional", exclamationUsage: "none|rare", otherPatterns: string[] }
- paragraphStyle: { leadStyle: string, organization: string, flow: string }
- rhetoricalPatterns: string[]
- distinctiveMarkers: string[]

Be specific and concrete in your observations.`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL_120B,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze these writing samples:\n\n${combinedText}` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Style analysis error:', error);
    throw new Error('Failed to analyze writing style');
  }
}

/**
 * Generate a plain-language summary of a voice profile
 * @param {Object} profileData - Structured profile data
 * @returns {Promise<string>} Human-readable summary
 */
export async function generateProfileSummary(profileData) {
  const systemPrompt = `You are a helpful writing coach. Summarize the following voice profile in 2-3 sentences that a writer would recognize as their own style.

Use second person ("You tend to...", "Your writing shows...").

Be warm, specific, and concise. Focus on the most distinctive characteristics. Avoid generic statements like "you have a unique voice."`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL_20B,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Summarize this voice profile:\n${JSON.stringify(profileData, null, 2)}` },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content?.trim() || 'Profile summary unavailable';
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Profile summary unavailable';
  }
}

/**
 * Build rewrite prompt with voice profile constraints
 * @param {Object} voiceProfile - The user's voice profile
 * @param {Array} fewShotExamples - Examples from writing samples
 * @param {string} textToRewrite - Text to rewrite
 * @returns {Array} Messages array for LLM
 */
export function buildRewritePrompt(voiceProfile, fewShotExamples, textToRewrite) {
  const systemPrompt = `You are a rewriting assistant. Your task is to rewrite the user's text while strictly adhering to the following voice profile. Do not add information. Do not change the meaning. Only change how it is expressed.

Voice Profile:
${formatVoiceProfile(voiceProfile)}

${formatFewShotExamples(fewShotExamples)}

Rules:
- Preserve the original meaning completely
- Match the sentence structure patterns described
- Use vocabulary at the indicated formality level
- Adopt the tone qualities specified
- Follow the punctuation habits
- Match the paragraph organization style`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Rewrite the following text in the voice described above. Return only the rewritten text, nothing else.\n\n${textToRewrite}` },
  ];
}

/**
 * Rewrite text using voice-constrained prompt
 * @param {string} text - Text to rewrite
 * @param {Object} voiceProfile - User's voice profile
 * @param {Array} fewShotExamples - Few-shot examples from samples
 * @returns {Promise<{rewritten: string, model: string}>}
 */
export async function rewriteText(text, voiceProfile, fewShotExamples = []) {
  const model = selectModel(text);
  const messages = buildRewritePrompt(voiceProfile, fewShotExamples, text);

  try {
    const response = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.5,
      max_tokens: Math.max(500, estimateTokens(text) * 1.5),
    });

    const rewritten = response.choices[0]?.message?.content?.trim();
    
    if (!rewritten) {
      throw new Error('Empty rewrite response');
    }

    return { rewritten, model };
  } catch (error) {
    console.error('Rewrite error:', error);
    throw new Error('Failed to rewrite text');
  }
}

/**
 * Format voice profile as natural language instructions
 * @param {Object} profile - Voice profile data
 * @returns {string} Formatted profile
 */
function formatVoiceProfile(profile) {
  if (!profile) return 'No voice profile available.';

  const parts = [];

  if (profile.sentenceStructure) {
    const ss = profile.sentenceStructure;
    parts.push(`- Sentence structure: ${ss.patterns?.[0] || `Average ${ss.averageLength} words, ${ss.complexity} complexity`}`);
  }

  if (profile.vocabulary) {
    const v = profile.vocabulary;
    parts.push(`- Vocabulary: ${v.formality}, ${v.richness} word choice. ${v.preferences?.[0] || ''}`);
  }

  if (profile.tone) {
    const t = profile.tone;
    const toneDesc = [];
    if (t.warmth) toneDesc.push(`${t.warmth} warmth`);
    if (t.directness) toneDesc.push(`${t.directness} directness`);
    if (t.humor && t.humor !== 'none') toneDesc.push(`${t.humor} humor`);
    parts.push(`- Tone: ${toneDesc.join(', ')}`);
  }

  if (profile.punctuation) {
    const p = profile.punctuation;
    const punctDesc = [];
    if (p.emDashUsage && p.emDashUsage !== 'none') punctDesc.push(`${p.emDashUsage} em-dash usage`);
    if (p.semicolonUsage && p.semicolonUsage !== 'none') punctDesc.push(`${p.semicolonUsage} semicolons`);
    parts.push(`- Punctuation: ${punctDesc.join(', ') || 'standard'}`);
  }

  if (profile.paragraphStyle) {
    parts.push(`- Paragraph style: ${profile.paragraphStyle.leadStyle || 'Varied'}`);
  }

  return parts.join('\n');
}

/**
 * Format few-shot examples from writing samples
 * @param {Array} examples - Array of {original, rewrite} pairs
 * @returns {string} Formatted examples
 */
function formatFewShotExamples(examples) {
  if (!examples || examples.length === 0) return '';

  const parts = ['Examples of this writer\'s style:'];
  
  examples.slice(0, 3).forEach((ex, i) => {
    parts.push(`\nExample ${i + 1}:`);
    parts.push(`Original: "${ex.original}"`);
    parts.push(`This writer's version: "${ex.rewrite}"`);
  });

  return parts.join('\n');
}

export { groq, MODEL_20B, MODEL_120B };
