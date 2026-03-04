function validateCityName(req, res, next) {
  const city = req.query.city || req.params.city;
  if (!city) return res.status(400).json({ message: 'اسم المدينة مطلوب' });
  if (city.length > 100) return res.status(400).json({ message: 'اسم المدينة طويل جداً' });
  if (/[<>{}\$]/.test(city)) return res.status(400).json({ message: 'اسم المدينة يحتوي أحرف غير مسموحة' });
  next();
}

function validateDate(req, res, next) {
  const date = req.query.date || req.params.date;
  if (!date) return next();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'تنسيق التاريخ غير صحيح (yyyy-mm-dd)' });
  const year = parseInt(date.slice(0, 4));
  if (year < 2020 || year > 2100) return res.status(400).json({ message: 'السنة خارج النطاق المسموح' });
  next();
}

function validatePrayer(req, res, next) {
  const prayer = req.query.prayer || req.params.prayer;
  if (!prayer) return next();
  const valid = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  if (!valid.includes(prayer)) return res.status(400).json({ message: 'اسم الصلاة غير صحيح' });
  next();
}

function validatePagination(req, res, next) {
  if (req.query.page && (isNaN(req.query.page) || req.query.page < 1)) {
    return res.status(400).json({ message: 'رقم الصفحة غير صحيح' });
  }
  if (req.query.limit && (isNaN(req.query.limit) || req.query.limit < 1 || req.query.limit > 100)) {
    return res.status(400).json({ message: 'عدد النتائج غير صحيح' });
  }
  next();
}

module.exports = { validateCityName, validateDate, validatePrayer, validatePagination };
