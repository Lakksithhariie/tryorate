// api/rewrite/feedback.js - Submit feedback on rewrite
import { z } from 'zod';
import prisma from '../../lib/db.js';
import { cors, withAuth, withErrorHandler, parseBody } from '../../lib/middleware.js';

const schema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  action: z.enum(['accept', 'edit', 'reject']),
  editedText: z.string().optional(),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
  }

  const body = await parseBody(req);
  const { eventId, action, editedText } = schema.parse(body);

  // Verify the event belongs to this user
  const event = await prisma.rewriteEvent.findFirst({
    where: {
      id: eventId,
      userId: req.userId,
    },
  });

  if (!event) {
    return res.status(404).json({ error: 'Not Found', message: 'Rewrite event not found' });
  }

  // Validate edited text if action is 'edit'
  if (action === 'edit' && !editedText) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Edited text is required when action is "edit"',
    });
  }

  // Update the event with feedback
  await prisma.rewriteEvent.update({
    where: { id: eventId },
    data: {
      userAction: action,
      userEditedText: action === 'edit' ? editedText : null,
    },
  });

  // Check if profile update is needed
  const feedbackCount = await prisma.rewriteEvent.count({
    where: {
      userId: req.userId,
      userAction: { not: null },
    },
  });

  // Trigger profile refinement if threshold met
  const shouldRefine = feedbackCount >= 10;

  return res.status(200).json({
    message: 'Feedback recorded successfully',
    action,
    eventId,
    totalFeedbackCount: feedbackCount,
    profileRefinementTriggered: shouldRefine,
  });
}

export default cors(withAuth(withErrorHandler(handler)));
