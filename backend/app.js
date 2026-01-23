var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// my code
// const PORT = process.env.PORT || 4000;


const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const prayertimesRoutes = require('./routes/prayertimes');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/azan';
app.use(cors());
app.use('/api/prayertimes', prayertimesRoutes);

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        // app.listen(PORT, () => {
        //     console.log(`🚀 Server listening on http://localhost:${PORT}`);
        // });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error', err);
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
