const winston = require('winston'),
    DailyRotateFile = require('winston-daily-rotate-file'),
    args = require('args-parser')(process.argv),

    fileLoggingFormat = winston.format.printf(info => {
        return `${info.timestamp} ${info.level.toUpperCase()}: ${JSON.stringify(info.message)}`; // the logging format for files
    }),
    consoleLoggingFormat = winston.format.printf(info => {
        return `${info.timestamp} [${info.level}] ${JSON.stringify(info.message)}`; //the logging format for the console
    }),
    loggingFullFormat = winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp({
            format: 'YY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.json()
    ),
    logger = winston.createLogger({
        level: winston.config.npm.levels, // logs with npm levels
        format: loggingFullFormat,
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.splat(),
                    winston.format.timestamp({
                        format: 'YY-MM-DD HH:mm:ss.SSS'
                    }),
                    consoleLoggingFormat
                ),
                level: args.loglevel || 'info'
            }),
            new winston.transports.File({
                level: 'debug',
                filename: './.log/latest.log',
                options: {flags: 'w'} // overwrites the file on restart
            }),
            new DailyRotateFile({
                level: 'verbose',
                filename: './.log/%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '32m',
                maxFiles: '30d',
                json: true
            })
        ]
    });

/**
 * A function to return the logger that has been created after appending an exception handler
 * @returns {Object}
 */
exports.getLogger = function () {
    logger.exceptions.handle(
        new winston.transports.File({
            filename: './.log/exceptions.log'
        })
    );
    return logger;
};