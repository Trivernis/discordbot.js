/* eslint-disable no-unused-vars */
const winston = require('winston'),
    DailyRotateFile = require('winston-daily-rotate-file'),
    args = require('args-parser')(process.argv);

/**
 * Set console format to simple string format
 * @type {Format}
 */
const consoleLoggingFormat = winston.format.printf(info => {
    return `${info.timestamp} {${info.module || info.m || 'DEFAULT'}} [${info.level}] ${JSON.stringify(info.message)}`; //the logging format for the console
});

/**
 * Set full format to combination of formats
 * @type {Format}
 */
const loggingFullFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.json()
);
/**
 * Define all transports used.
 * @type {any[]}
 */
let transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.splat(),
            winston.format.timestamp({
                format: 'YY-MM-DD HH:mm:ss.SSS'
            }),
            winston.format.label({label: ''}),
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
];

/**
 * Define the logger
 * @type {winston.Logger}
 */
let logger = winston.createLogger({
    level: winston.config.npm.levels,
    format: loggingFullFormat,
    transports: transports
});


// Define exception handling
logger.exceptions.handle(
    new winston.transports.File({
        filename: './.log/exceptions.log'
    })
);

class ModuleLogger {

    constructor(moduleInstance) {
        this.logger = logger;
        if (moduleInstance.constructor)
            switch (moduleInstance.constructor.name) {
                case 'String':
                    this.logName = moduleInstance;
                    break;
                case 'Number':
                    this.logName = moduleInstance.toString();
                    break;
                default:
                    this.logName = moduleInstance.constructor.name;
            }
        else
            this.logName = moduleInstance.toString();

    }

    silly(msg, meta) {
        logger.silly(msg, {module: this.logName, ...meta});
    }

    debug(msg, meta) {
        logger.debug(msg, {module: this.logName, ...meta});
    }

    verbose(msg, meta) {
        logger.verbose(msg, {module: this.logName, ...meta});
    }

    info(msg, meta) {
        logger.info(msg, {module: this.logName, ...meta});
    }
    warn(msg, meta) {
        logger.warn(msg, {module: this.logName, ...meta});
    }

    error(msg, meta) {
        logger.error(msg, {module: this.logName, ...meta});
    }
}

Object.assign(exports, {
    logger: logger,
    Logger: ModuleLogger
});
