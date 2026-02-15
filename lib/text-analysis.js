// lib/text-analysis.js - NLP using compromise
import nlp from 'compromise';

/**
 * Analyze text structure using compromise
 * @param {string} text - Text to analyze
 * @returns {Object} Structural analysis
 */
export function analyzeStructure(text) {
  const doc = nlp(text);
  
  const sentences = doc.sentences().json();
  const words = doc.terms().json();
  const uniqueWords = new Set(words.map(w => w.normal));
  
  // Sentence analysis
  const sentenceLengths = sentences.map(s => s.terms.length);
  const avgSentenceLength = sentenceLengths.length > 0 
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length 
    : 0;
  
  // Question detection
  const questions = doc.questions().json();
  
  // Punctuation analysis
  const textWithoutSpaces = text.replace(/\s/g, '');
  const punctuationCounts = {
    emDash: (text.match(/—/g) || []).length,
    enDash: (text.match(/–/g) || []).length,
    semicolons: (text.match(/;/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
    colons: (text.match(/:/g) || []).length,
    parentheses: (text.match(/[()]/g) || []).length,
  };
  
  // Paragraph analysis
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Vocabulary richness (Type-Token Ratio)
  const totalWords = words.length;
  const uniqueWordCount = uniqueWords.size;
  const vocabularyRichness = totalWords > 0 ? uniqueWordCount / totalWords : 0;
  
  // Word length distribution
  const wordLengths = words.map(w => w.text.length);
  const avgWordLength = wordLengths.length > 0
    ? wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length
    : 0;
  
  // Sentence start patterns
  const sentenceStarts = sentences
    .map(s => s.terms[0]?.tags?.[0])
    .filter(Boolean)
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  
  return {
    metrics: {
      sentenceCount: sentences.length,
      wordCount: totalWords,
      paragraphCount: paragraphs.length,
      questionCount: questions.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      vocabularyRichness: Math.round(vocabularyRichness * 100) / 100,
      uniqueWordCount,
    },
    punctuation: punctuationCounts,
    structure: {
      sentenceLengths,
      sentenceStarts,
    },
    samples: {
      sentences: sentences.slice(0, 3).map(s => s.text),
      paragraphs: paragraphs.slice(0, 2),
    },
  };
}

/**
 * Extract few-shot examples from writing samples
 * @param {string[]} samples - Array of writing samples
 * @returns {Array} Array of {original, rewrite} pairs
 */
export function extractFewShotExamples(samples) {
  const examples = [];
  
  for (const sample of samples.slice(0, 3)) {
    const doc = nlp(sample);
    const sentences = doc.sentences().json();
    
    // Find a medium-length sentence for the example
    const candidate = sentences.find(s => {
      const wordCount = s.terms.length;
      return wordCount >= 8 && wordCount <= 20;
    });
    
    if (candidate) {
      examples.push({
        original: candidate.text,
        rewrite: candidate.text, // The sample IS the user's rewrite
      });
    }
  }
  
  return examples;
}

/**
 * Count words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text) {
  return nlp(text).terms().length;
}

/**
 * Validate minimum word count
 * @param {string[]} samples - Array of writing samples
 * @param {number} minWords - Minimum required words
 * @returns {{valid: boolean, totalWords: number}}
 */
export function validateWordCount(samples, minWords = 1500) {
  const totalWords = samples.reduce((sum, sample) => sum + countWords(sample), 0);
  return {
    valid: totalWords >= minWords,
    totalWords,
  };
}

/**
 * Get structural insights for LLM prompt
 * @param {string} text - Text to analyze
 * @returns {string} Natural language description of structure
 */
export function getStructuralInsights(text) {
  const analysis = analyzeStructure(text);
  
  const parts = [];
  
  if (analysis.metrics.avgSentenceLength < 10) {
    parts.push('Short, punchy sentences');
  } else if (analysis.metrics.avgSentenceLength > 20) {
    parts.push('Long, flowing sentences');
  } else {
    parts.push('Medium-length sentences');
  }
  
  if (analysis.punctuation.emDash > 0) {
    parts.push('uses em-dashes for emphasis');
  }
  
  if (analysis.punctuation.semicolons > 0) {
    parts.push('semicolons for complex connections');
  }
  
  if (analysis.metrics.vocabularyRichness > 0.7) {
    parts.push('rich vocabulary variety');
  }
  
  return parts.join(', ');
}
