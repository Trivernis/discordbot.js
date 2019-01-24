/* Module definition */

/* Variable Definition */
const Discord = require('discord.js'),
    args = require('args-parser')(process.argv),
    config = require('../config.json'),
    gcmdTempl = require('../commands/globalcommands'),
    scmdTempl = require('../commands/servercommands');

let logger = require('winston'),
    globCommands = {};

/**
 * @type {Servant}
 */
exports.Servant = class {
    constructor(prefix) {
        this.commands = {};
        this.prefix = prefix;
        // show all commands (except the owner commands if the user is not an owner)
        this.createCommand(gcmdTempl.utils.help, (msg, kwargs) => {
            if (kwargs.command) {
                let cmd = kwargs.command;
                let allCommands ={...globCommands, ...this.commands};
                if (cmd.charAt(0) !== prefix)
                    cmd = this.prefix + cmd;
                if (allCommands[cmd]) {
                    return new Discord.RichEmbed()
                        .setTitle(`Help for ${cmd}`)
                        .addField('Usage', `\`${cmd} [${allCommands[cmd].args.join('] [')}]\``.replace('[]', ''))
                        .addField('Description', allCommands[cmd].description)
                        .addField('Permission Role', allCommands[cmd].role || 'all');
                } else {
                    return 'Command not found :(';
                }
            } else {
                let helpEmbed = new Discord.RichEmbed()
                    .setTitle('Commands');
                let globHelp = '';
                Object.entries(globCommands).sort().forEach(([key, value]) => {
                    if (value.role !== 'owner' || checkPermission(msg, 'owner')) {
                        globHelp += `\`${key}\` \t`;
                    }
                });
                helpEmbed.addField('Global Commands', globHelp);
                let categories = [];
                let catCommands = {};
                Object.entries(this.commands).sort().forEach(([key, value]) => {
                    if (value.role !== 'owner' || checkPermission(msg, 'owner')) {
                        if (!categories.includes(value.category)) {
                            categories.push(value.category);
                            catCommands[value.category] = `\`${key}\` \t`
                        } else {
                            catCommands[value.category] += `\`${key}\` \t`
                        }
                    }
                });
                for (let cat of categories) {
                    helpEmbed.addField(cat, catCommands[cat]);
                }
                helpEmbed.setFooter( prefix + 'help [command] for more info to each command');
                return helpEmbed;
            }
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
            logger.debug(`Name of command template is null or undef. Failed creating command.`);
            return;
        }
        this.commands[this.prefix + template.name] = {
            'args': template.args || [],
            'description': template.description,
            'callback': call,
            'role': template.permission,
            'category': template.category || 'Other'
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
        try {
            let locResult = cmd.callback(msg, kwargs, argv);
            if (locResult instanceof Promise)
                return locResult;   // because Promise equals false in conditional
            return locResult || globResult;
        } catch (err) {
            logger.error(err.message);
            return `The command \`${command}\`  has thrown an error.`;
        }
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
    logger.debug(`Created global command: ${command}, args: ${args}`);
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
    this.createGlobalCommand(((prefix || config.prefix) + 'help'), (msg, kwargs) => {
        if (kwargs.command) {
            let cmd = kwargs.command;
            if (cmd.charAt(0) !== prefix)
                cmd = prefix + cmd;
            if (globCommands[cmd]) {
                return new Discord.RichEmbed()
                    .setTitle(`Help for ${cmd}`)
                    .addField('Usage', `\`${cmd} [${globCommands[cmd].args.join('] [')}]\``.replace('[]', ''))
                    .addField('Description', globCommands[cmd].description)
                    .addField('Permission Role', globCommands[cmd].role || 'all');
            }
        } else {
            let helpEmbed = new Discord.RichEmbed()
                .setTitle('Global Commands')
                .setTimestamp();
            let description = '';
            Object.entries(globCommands).sort().forEach(([key, value]) => {
                if (value.role === 'owner' && checkPermission(msg, 'owner')) {
                    description += `\`${key}\` \t`;
                } else if (value.role !== 'owner') {
                    description += `\`${key}\` \t`;
                }
            });
            helpEmbed.setFooter( prefix + 'help [command] for more info to each command');
            helpEmbed.setDescription(description);
            return helpEmbed;
        }
    }, ['command'], "Shows this help.");
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
 * @param rolePerm {String}
 * @returns {boolean}
 */
function checkPermission(msg, rolePerm) {
    if (!rolePerm || ['all', 'any', 'everyone'].includes(rolePerm))
        return true;
    if (msg.author.tag === args.owner || config.owners.includes(msg.author.tag)) {
        return true;
    } else {
        if (msg.member && rolePerm && msg.member.roles.some(role => role.name.toLowerCase() === rolePerm.toLowerCase()))
            return true
    }
    return false
}