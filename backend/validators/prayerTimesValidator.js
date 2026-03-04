const { z } = require('zod');

// Reusable: safe string (no regex-injection chars)
const safeString = z.string().max(100).regex(
  /^[a-zA-Z\u0600-\u06FF\s\-'.]+$/,
  'Contains invalid characters'
);

const todaySchema = z.object({
  city: safeString,
  country: safeString.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be yyyy-mm-dd')
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const y = parseInt(v.slice(0, 4));
        return y >= 2020 && y <= 2100;
      },
      { message: 'Year out of allowed range (2020-2100)' }
    ),
});

const nowSchema = z.object({
  prayer: z
    .enum(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'])
    .optional(),
});

const nextForMeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Express middleware factory: validates req.query against a Zod schema.
 * On failure returns 400 with structured errors.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ message: 'Invalid query parameters', errors });
    }
    // Replace raw query with parsed/coerced values
    req.query = result.data;
    next();
  };
}

module.exports = {
  todaySchema,
  nowSchema,
  nextForMeSchema,
  validateQuery,
};
