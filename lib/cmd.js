/* Module definition */

/* Variable Definition */
let logger = require('winston'),
    globCommands = {};

/* Function Definition */

/**
 * TODO: Configure commander with functions:
 *  - parsing commands from messages
 *  - add/remove commands
 *  - prefix settings
 * @type {Commander}
 */
exports.Servant = class {
    constructor(prefix) {
        this.commands = {};
        this.createCommand(((prefix || '~')+'help') || "~help", () => {
            let helpstr = "```markdown\n";
            helpstr += "Commands\n---\n";
            Object.entries(globCommands).concat(Object.entries(this.commands)).forEach(([key, value]) => {
                let cmdhelp = `${key} [${value.args.join('] [')}]`.padEnd(32, ' ');
                cmdhelp += value.description || '';
                helpstr += `\n${cmdhelp}\n`;
            });
            helpstr += "```";
            return helpstr;
        }, [], "Shows this help.");
    }

    createCommand(command, call, args, description) {
        this.commands[command]  = {
            'args': args,
            'description': description,
            'callback': call
        };
    }

    parseCommand(msg) {
        let globResult = parseGlobalCommand(msg);
        logger.debug(`Global command result is ${globResult}`);
        let content = msg.content;
        let command = (content.match(/^.\w+/) || [])[0];
        if (!command || !this.commands[command]) return globResult;
        let cmd = this.commands[command];
        let argvars = content.match(/(?<= )\S+/g) || [];
        let kwargs = {};
        let nLength = Math.min(cmd.args.length, argvars.length);
        for (let i = 0; i < nLength; i++) {
            kwargs[cmd.args[i]] = argvars[i];
        }
        let argv = argvars.slice(nLength);
        logger.debug(`Executing callback for command: ${command}, kwargs: ${kwargs}, argv: ${argv}`);
        return cmd.callback(msg, kwargs, argv) || globResult;
    }

};

/**
 * Getting the logger
 * @param {Object} newLogger
 */
exports.setLogger = function(newLogger) {
    logger = newLogger;
};

exports.createGlobalCommand = function(command, call, args, description) {
    globCommands[command]  = {
        'args': args || [],
        'description': description,
        'callback': call
    };
    logger.debug(`Created command: ${command}, args: ${args}`);
};


exports.parseMessage = function(msg) {
    return parseGlobalCommand(msg);
}

/**
 * Initializes the module by creating a help command
 */
exports.init = function(prefix) {
    logger.verbose("Created help command");
    this.createGlobalCommand((prefix+'help') || "~help", () => {
        let helpstr = "```markdown\n";
        helpstr += "Commands\n---\n";
        Object.entries(globCommands).forEach(([key, value]) => {
            let cmdhelp = `${key} [${value.args.join('] [')}]`.padEnd(32, ' ');
            cmdhelp += value.description || '';
            helpstr += `\n${cmdhelp}\n`;
        });
        helpstr += "```";
        return helpstr;
    }, [], "Shows this help.");
};

/**
 * Parses the message by calling the assigned function for the command with arguments
 * @param msg
 */
function parseGlobalCommand(msg) {
    let content = msg.content;
    let command = (content.match(/^.\w+/) || [])[0];
    if (!command || !globCommands[command]) return false;
    let cmd = globCommands[command];
    let argvars = content.match(/(?<= )\S+/g) || [];
    let kwargs = {};
    let nLength = Math.min(cmd.args.length, argvars.length);
    for (let i = 0; i < nLength; i++) {
        kwargs[cmd.args[i]] = argvars[i];
    }
    let argv = argvars.slice(nLength);
    logger.debug(`Executing callback for command: ${command}, kwargs: ${JSON.stringify(kwargs)}, argv: ${argv}`);
    return cmd.callback(msg, kwargs, argv);
}