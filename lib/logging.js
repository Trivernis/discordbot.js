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
            format: 'MM-DD HH:mm:ss.SSS' // don't include the year because the filename already tells
        }),
        fileLoggingFormat // the logging format for files that logs with a capitalized level
    ),
    logger = winston.createLogger({
        level: winston.config.npm.levels, // logs with npm levels
        format: loggingFullFormat, // the full format for files
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(), // colorizes the console logging output
                    winston.format.splat(),
                    winston.format.timestamp({
                        format: 'YY-MM-DD HH:mm:ss.SSS' // logs with the year to the console
                    }),
                    consoleLoggingFormat // logs with the custom console format
                ),
                level: args.loglevel || 'info' // logs to the console with the arg loglevel or info if it is not given
            }),
            new winston.transports.File({
                level: 'debug', // logs with debug level to the active file
                filename: './.log/latest.log', // the filename of the current file,
                options: {flags: 'w'} // overwrites the file on restart
            }),
            new DailyRotateFile({
                level: 'verbose', // log verbose in the rotating logvile
                filename: './.log/%DATE%.log', // the pattern of the filename
                datePattern: 'YYYY-MM-DD', // the pattern of %DATE%
                zippedArchive: true, // indicates that old logfiles should get zipped
                maxSize: '32m', // the maximum filesize
                maxFiles: '30d' // the maximum files to keep
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