/* Module definition */

/* Variable Definition */
let logger = require('winston'),
    commands = {};

/* Function Definition */

/**
 * Getting the logger
 * @param {Object} newLogger
 */
exports.setLogger = function(newLogger) {
    logger = newLogger;
};

exports.createCommand = function(prefix, command, call, argv) {
    try {
        logger.debug(`Creating command ${command} with prefix ${prefix} and arguments ${argv}`);
        if (!commands[prefix]) commands[prefix] = {}; // create Object commands prefix
        commands[prefix][command] = { // assign the command
            args: argv || [],    // with arguments
            callback: call      // and function
        };
        logger.debug(`Created command ${prefix}${command}`);
    } catch (err) {
        logger.error(JSON.stringify(err));
    }
};

/**
 * Parses the message by calling the assigned function for the command with arguments
 * @param msg
 * @returns {string}
 */
exports.parseMessage = function(msg) {
    logger.debug(`Recieved message ${msg.content} from ${msg.author.username}`);
    let content = msg.content;
    let matches = content.match(/^./g); // match with first symbol
    logger.debug(matches);
    if (matches) {
        logger.debug(matches);
        logger.debug(`Found prefix ${matches[0]} in message`);
        let prefix = matches[0];
        let prefixData = commands[prefix];
        matches = content.replace(prefix, '').match(/^\w+/g); // match with the second word
        if (matches && prefixData) {
            logger.debug(`found command ${matches[0]} in message`);
            let command = matches[0];
            let commandFunction = prefixData[command];
            let args = content
                .replace(prefix, '')
                .replace(command, '')
                .replace(/^\s+/g, '')
                .split(' ');
            if (commandFunction) {
                let argv = {};
                if (commandFunction.args) {
                    for (let i = 0; i < commandFunction.args.length; i++) {
                        let arg = commandFunction.args[i];
                        argv[arg] = args[i];
                    }
                }
                if (commandFunction.callback) {
                    logger.debug(`Found callback and args ${JSON.stringify(argv)} in message`);
                    return commandFunction.callback(msg, argv); // call the command function and return the result
                }
            }
        }
    }
};

/**
 * Initializes the module by creating a help command
 */
exports.init = function() {
    logger.verbose("Created help command");
    this.createCommand("~", "help", () => {
        let helpstr = "```markdown\n";
        helpstr += "Commands\n---\n";
        Object.keys(commands).forEach((key) => {
           Object.keys(commands[key]).forEach((cmd) => {
               helpstr += "\n" + key + cmd + " " + JSON.stringify(commands[key][cmd].args) + "\n";
           });
        });
        helpstr += "```";
        return helpstr;
    });
};