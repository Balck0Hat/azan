const VALID_TYPES = ['bug', 'suggestion', 'general'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFeedback(body) {
  const errors = [];

  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    errors.push('Message is required');
  } else if (body.message.length > 2000) {
    errors.push('Message must be under 2000 characters');
  }

  if (body.name && (typeof body.name !== 'string' || body.name.length > 100)) {
    errors.push('Name must be under 100 characters');
  }

  if (body.email && (typeof body.email !== 'string' || !EMAIL_RE.test(body.email))) {
    errors.push('Invalid email format');
  }

  if (body.type && !VALID_TYPES.includes(body.type)) {
    errors.push('Type must be one of: bug, suggestion, general');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateFeedback };
