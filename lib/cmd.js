/* Module definition */

/* Variable Definition */
let logger = require('winston'),
    globCommands = {},
    ownerCommands = {},
    args = require('args-parser')(process.argv);

/* Function Definition */

/**
 * @type {Servant}
 */
exports.Servant = class {
    constructor(prefix) {
        this.commands = {};
        this.createCommand(((prefix || '~') + 'help') || "~help", () => {
            let helpstr = "```markdown\n";
            helpstr += "Commands\n===\n";
            helpstr += 'Global Commands\n---\n';
            Object.entries(globCommands).sort().forEach(([key, value]) => {
                if (value.role !== 'owner' || msg.author.tag === args.owner) {
                    let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                    cmdhelp += value.description || '';
                    helpstr += `\n${cmdhelp}\n`;
                }
            });
            helpstr += '\nServer Commands\n---\n';
            Object.entries(this.commands).sort().forEach(([key, value]) => {
                if (value.role !== 'owner' || msg.author.tag === args.owner) {
                    let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                    cmdhelp += value.description || '';
                    helpstr += `\n${cmdhelp}\n`;
                }
            });
            helpstr += "```";
            return helpstr;
        }, [], "Shows this help.");
    }

    /**
     * Creates a command entry in the private commands dict
     * @param command
     * @param call
     * @param args
     * @param description
     */
    createCommand(command, call, args, description, role) {
        this.commands[command] = {
            'args': args,
            'description': description,
            'callback': call,
            'role': role
        };
    }

    /**
     * Removes a command
     * @param command
     */
    removeCommand(command) {
        delete this.commands[command];
    }

    /**
     * Parses the message and executes the command callback for the found command entry in the commands dict
     * @param msg
     * @returns {*}
     */
    parseCommand(msg) {
        let globResult = parseGlobalCommand(msg);
        logger.debug(`Global command result is ${globResult}`);
        let content = msg.content;
        let command = (content.match(/^.\w+/) || [])[0];
        if (!command || !this.commands[command]) return globResult;
        let cmd = this.commands[command];
        if (!checkPermission(msg, cmd.role)) return 'No Permission';
        logger.debug(`Permission <${cmd.role || 'all'}> granted for command ${command} for user <${msg.author.tag}>`);
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
exports.setLogger = function (newLogger) {
    logger = newLogger;
};

/**
 * Creates a global command that can be executed in every channel.
 * @param command
 * @param call
 * @param args
 * @param description
 * @param role
 */
exports.createGlobalCommand = function (command, call, args, description, role) {
    globCommands[command] = {
        'args': args || [],
        'description': description,
        'callback': call,
        'role': role
    };
    logger.debug(`Created command: ${command}, args: ${args}`);
};


/**
 * Parses a message for a global command
 * @param msg
 * @returns {boolean|*}
 */
exports.parseMessage = function (msg) {
    return parseGlobalCommand(msg);
};

/**
 * Initializes the module by creating a help command
 */
exports.init = function (prefix) {
    logger.verbose("Created help command");
    this.createGlobalCommand((prefix + 'help') || "~help", (msg) => {
        let helpstr = "```markdown\n";
        helpstr += "Commands\n---\n";
        Object.entries(globCommands).sort().forEach(([key, value]) => {
            if (value.role !== 'owner' || msg.author.tag === args.owner) {
                let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                cmdhelp += value.description || '';
                helpstr += `\n${cmdhelp}\n`;
            }
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
    if (!checkPermission(msg, cmd.role)) return false;
    logger.debug(`Permission <${cmd.role}> granted for command ${command} for user <${msg.author.tag}>`);
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

function checkPermission(msg, role) {
    if (!role || ['all', 'any', 'everyone'].includes(role))
        return true;
    if (msg.author.tag === args.owner) {
        return true;
    } else {
        if (msg.member && role && msg.member.roles.find("id", role.id))
            return true
    }
    return false
}