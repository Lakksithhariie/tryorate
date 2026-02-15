// lib/middleware.js - CORS, auth, and error handling
import { z } from 'zod';
import { extractBearerToken, verifyJWT } from './auth.js';

/**
 * CORS middleware wrapper
 * @param {Function} handler - Request handler
 * @returns {Function} Wrapped handler with CORS
 */
export function cors(handler) {
  return async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
}

/**
 * Authentication middleware wrapper
 * @param {Function} handler - Request handler
 * @returns {Function} Wrapped handler with auth
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = extractBearerToken(authHeader);

      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }

      const payload = await verifyJWT(token);
      req.userId = payload.userId;

      return handler(req, res);
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message || 'Invalid token',
      });
    }
  };
}

/**
 * Error handling wrapper for API routes
 * @param {Function} handler - Request handler
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);

      // Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      // Custom error with status code
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          error: error.name || 'Error',
          message: error.message,
        });
      }

      // Default 500 error (don't expose internal details)
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Something went wrong. Please try again.',
      });
    }
  };
}

/**
 * Rate limiting middleware (requires @upstash/ratelimit)
 * Note: This requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
 * @param {Function} handler - Request handler
 * @param {Object} options - Rate limit options
 * @returns {Function} Wrapped handler with rate limiting
 */
export function withRateLimit(handler, options = {}) {
  return async (req, res) => {
    // Skip rate limiting if Redis is not configured
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return handler(req, res);
    }

    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(options.requests || 5, options.window || '1 h'),
        analytics: true,
      });

      // Use email as identifier for auth endpoints, IP otherwise
      const identifier = req.body?.email || req.headers['x-forwarded-for'] || 'anonymous';
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', reset);

      if (!success) {
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        });
      }

      return handler(req, res);
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if it fails
      return handler(req, res);
    }
  };
}

/**
 * Compose multiple middleware functions
 * @param {...Function} middlewares - Middleware functions
 * @returns {Function} Composed middleware
 */
export function compose(...middlewares) {
  return (handler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

/**
 * Parse JSON body from request
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Parsed body
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Parse multipart form data (simplified for file uploads)
 * @param {Object} req - Request object
 * @returns {Promise<{fields: Object, file: {buffer: Buffer, filename: string, mimetype: string}}>}
 */
export async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('multipart/form-data')) {
          reject(new Error('Expected multipart/form-data'));
          return;
        }
        
        // Extract boundary
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
          reject(new Error('Missing boundary in multipart data'));
          return;
        }
        
        // Simple multipart parsing
        const parts = buffer.toString().split(`--${boundary}`);
        const fields = {};
        let file = null;
        
        for (const part of parts) {
          if (part.includes('Content-Disposition')) {
            const nameMatch = part.match(/name="([^"]+)"/);
            const filenameMatch = part.match(/filename="([^"]+)"/);
            
            if (filenameMatch) {
              // File part
              const headersEnd = part.indexOf('\r\n\r\n');
              if (headersEnd > -1) {
                const fileData = part.slice(headersEnd + 4, part.lastIndexOf('\r\n'));
                const mimetypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
                
                file = {
                  buffer: Buffer.from(fileData),
                  filename: filenameMatch[1],
                  mimetype: mimetypeMatch ? mimetypeMatch[1].trim() : 'application/octet-stream',
                };
              }
            } else if (nameMatch) {
              // Field part
              const headersEnd = part.indexOf('\r\n\r\n');
              if (headersEnd > -1) {
                const value = part.slice(headersEnd + 4, part.lastIndexOf('\r\n')).trim();
                fields[nameMatch[1]] = value;
              }
            }
          }
        }
        
        resolve({ fields, file });
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}
