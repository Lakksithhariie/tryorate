// lib/file-parser.js - DOCX and TXT file parsing
import mammoth from 'mammoth';

/**
 * Parse DOCX file buffer to text
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} Extracted text
 */
export async function parseDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.messages.length > 0) {
      console.warn('DOCX parsing warnings:', result.messages);
    }
    
    // Clean up the text
    return cleanText(result.value);
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Parse TXT file buffer to text
 * @param {Buffer} buffer - File buffer
 * @returns {string} Extracted text
 */
export function parseTxt(buffer) {
  try {
    const text = buffer.toString('utf-8');
    return cleanText(text);
  } catch (error) {
    console.error('TXT parsing error:', error);
    throw new Error('Failed to parse text file');
  }
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    // Remove excessive whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove form feeds and other control chars except newlines
    .replace(/[\f\v\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Normalize multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace
    .trim();
}

/**
 * Detect file type from buffer
 * @param {Buffer} buffer - File buffer
 * @returns {string} MIME type or extension hint
 */
export function detectFileType(buffer) {
  // Check for DOCX (ZIP-based format)
  if (buffer.length > 4 && 
      buffer[0] === 0x50 && buffer[1] === 0x4B && 
      buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'docx';
  }
  
  // Default to txt
  return 'txt';
}

/**
 * Parse file based on content type
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @returns {Promise<string>} Extracted text
 */
export async function parseFile(buffer, mimeType) {
  // Handle based on MIME type
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword') {
    return parseDocx(buffer);
  }
  
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return parseTxt(buffer);
  }
  
  // Try to detect from content
  const detectedType = detectFileType(buffer);
  
  if (detectedType === 'docx') {
    return parseDocx(buffer);
  }
  
  // Default to text
  return parseTxt(buffer);
}
