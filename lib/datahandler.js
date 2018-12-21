/* Module definition */

/* Variable Definition */
let logger = require('winston');

/* Function Definition */
// TODO: Class that handles file-data for a server, functions to get/set data for specific server id
/**
 * Getting the logger
 * @param {Object} newLogger
 */
exports.getLogger = function (newLogger) {
    logger = newLogger;
};