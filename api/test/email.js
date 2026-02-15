// api/test/email.js - Test email configuration
import { Resend } from 'resend';
import { cors, withErrorHandler } from '../../lib/middleware.js';

const resend = new Resend(process.env.RESEND_API_KEY);

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const config = {
    resendKeyExists: !!process.env.RESEND_API_KEY,
    resendKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 7) + '...' : 'NOT SET',
    emailFrom: process.env.EMAIL_FROM || 'NOT SET',
    frontendUrl: process.env.FRONTEND_URL || 'NOT SET',
  };

  // Test sending an email
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'hello@orate.app',
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test',
    });

    return res.status(200).json({
      config,
      testResult: result,
      message: 'Email configuration test completed',
    });
  } catch (error) {
    return res.status(500).json({
      config,
      error: error.message,
      errorDetails: error,
      message: 'Email test failed',
    });
  }
}

export default cors(withErrorHandler(handler));
