// api/health.js - Health check endpoint
import { cors, withErrorHandler } from '../lib/middleware.js';

async function handler(req, res) {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

export default cors(withErrorHandler(handler));
