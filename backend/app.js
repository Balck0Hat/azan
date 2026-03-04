var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var rateLimit = require('express-rate-limit');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// my code
// const PORT = process.env.PORT || 4000;

const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const prayertimesRoutes = require('./routes/prayertimes');
const healthRoutes = require('./routes/health');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/azan';

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://azanlive.com', 'https://www.azanlive.com']
    : '*',
  methods: ['GET', 'POST'],
  credentials: true
};
app.use(cors(corsOptions));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.aladhan.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: { message: 'طلبات كثيرة، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

app.use('/api/prayertimes', prayertimesRoutes);
app.use('/api/prayertimes', healthRoutes);

// Sitemap (no rate limiting, served at root)
const sitemapRoutes = require('./routes/sitemap');
app.use('/', sitemapRoutes);

// Admin routes (no rate limiting)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Dev-only UX audit routes (no rate limiting)
if (process.env.NODE_ENV !== 'production') {
  const uxAuditRoutes = require('./routes/uxAudit');
  app.use('/api', uxAuditRoutes);
}

// API Error Handler
app.use('/api', errorHandler);

mongoose.connect(MONGODB_URI)
    .then(() => {
        logger.info('Connected to MongoDB');
    })
    .catch((err) => {
        logger.error('MongoDB connection error', err);
    });


// end of my code

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
