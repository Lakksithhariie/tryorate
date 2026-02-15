// lib/auth.js - JWT and magic token handling
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const JWT_EXPIRY_DAYS = 7;
const MAGIC_TOKEN_EXPIRY_MINUTES = 10;

/**
 * Generate a magic token for email authentication
 * @returns {{token: string, expiresAt: Date}}
 */
export function generateMagicToken() {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  
  return { token, expiresAt };
}

/**
 * Create a signed JWT for authenticated sessions
 * @param {string} userId - The user ID
 * @returns {Promise<string>} Signed JWT
 */
export async function createJWT(userId) {
  const jwt = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_DAYS}d`)
    .sign(JWT_SECRET);
  
  return jwt;
}

/**
 * Verify a JWT and return the payload
 * @param {string} token - The JWT to verify
 * @returns {Promise<{userId: string}>} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export async function verifyJWT(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (!payload.userId) {
      throw new Error('Invalid token payload');
    }
    
    return { userId: payload.userId };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} The token or null if invalid format
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.slice(7);
}
