/* Module definition */

/* Variable Definition */
let logger = require('winston'),
    globCommands = {},
    ownerCommands = {},
    config = require('../config.json'),
    args = require('args-parser')(process.argv),
    gcmdTempl = require('../commands/globalcommands'),
    scmdTempl = require('../commands/servercommands');

/* Function Definition */

/**
 * @type {Servant}
 */
module.exports.Servant = class {
    constructor(prefix) {
        this.commands = {};
        this.prefix = prefix;
        // show all commands (except the owner commands if the user is not an owner)
        this.createCommand(gcmdTempl.utils.help, (msg) => {
            let helpstr = "```markdown\n";
            helpstr += "Commands\n===\n";
            helpstr += 'Global Commands\n---\n';
            Object.entries(globCommands).sort().forEach(([key, value]) => {
                if (value.role !== 'owner' || checkPermission(msg, 'owner')) {
                    let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                    cmdhelp += value.description || '';
                    cmdhelp += `\nPermission: ${value.role||'all'}`;
                    helpstr += `\n${cmdhelp}\n`;
                }
            });
            helpstr += '\nServer Commands\n---\n';
            Object.entries(this.commands).sort().forEach(([key, value]) => {
                if (value.role !== 'owner' || checkPermission(msg, 'owner')) {
                    let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                    cmdhelp += value.description || '';
                    cmdhelp += `\nPermission: ${value.role||'all'}`;
                    helpstr += `\n${cmdhelp}\n`;
                }
            });
            helpstr += "```";
            return helpstr;
        });

        // show all roles that are used by commands
        this.createCommand(scmdTempl.utils.roles, () => {
            let roles = [];
            Object.entries(globCommands).concat(Object.entries(this.commands)).sort().forEach(([key, value]) => {
                roles.push(value.role || 'all');
            });
            return `**Roles**\n${[...new Set(roles)].join('\n')}`;
        });
    }

    /**
     * Creates a command entry in the private commands dict
     * @param template
     * @param call
     */
    createCommand(template, call) {
        if (!template.name) {
            logger.debug(`Name of command template is null or undef. Failed creating command.`)
            return;
        }
        this.commands[this.prefix + template.name] = {
            'args': template.args || [],
            'description': template.description,
            'callback': call,
            'role': template.role
        };
        logger.debug(`Created server command: ${this.prefix + template.name}, args: ${template.args}`);
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
module.exports.setLogger = function (newLogger) {
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
module.exports.createGlobalCommand = function (command, call, args, description, role) {
    globCommands[command] = {
        'args': args || [],
        'description': description,
        'callback': call,
        'role': role
    };
    logger.debug(`Created global command: ${command}, args: ${args}`);
};


/**
 * Parses a message for a global command
 * @param msg
 * @returns {boolean|*}
 */
module.exports.parseMessage = function (msg) {
    return parseGlobalCommand(msg);
};

/**
 * Initializes the module by creating a help command
 */
module.exports.init = function (prefix) {
    logger.verbose("Created help command");
    this.createGlobalCommand(((prefix || config.prefix) + 'help'), (msg) => {
        let helpstr = "```markdown\n";
        helpstr += "Commands\n---\n";
        Object.entries(globCommands).sort().forEach(([key, value]) => {
            if (value.role !== 'owner' || checkPermission(msg, 'owner')) {
                let cmdhelp = `${key} [${value.args.join('] [')}]`.replace('[]', '').padEnd(25, ' ');
                cmdhelp += value.description || '';
                cmdhelp += `\nPermission: ${value.role||'all'}`;
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

/**
 * @param msg
 * @param role {String}
 * @returns {boolean}
 */
function checkPermission(msg, role) {
    if (!role || ['all', 'any', 'everyone'].includes(role))
        return true;
    if (msg.author.tag === args.owner || config.owners.includes(msg.author.tag)) {
        return true;
    } else {
        if (msg.member && role && msg.member.roles.some(role => role.name.toLowerCase() === role.toLowerCase()))
            return true
    }
    return false
}