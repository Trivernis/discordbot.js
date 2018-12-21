/* Module definition */

/* Variable Definition */
let logger = require('winston');

/* Function Definition */

/**
 * Getting the logger
 * @param {Object} newLogger
 */
exports.getLogger = function (newLogger) {
    logger = newLogger;
};