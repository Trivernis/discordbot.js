const Discord = require('discord.js'),
    yaml = require('js-yaml'),
    fsx = require('fs-extra'),
    logging = require('./logging'),
    config = require('../config.json'),
    utils = require('./utils');

const scopes = {
    'Global': 0,
    'User': 1,
    'Guild': 2
};

class Answer {

    /**
     * Creates an new Answer object with _func as answer logic.
     * @param func
     */
    constructor(func) {
        this._func = func;
    }

    /**
     * Evaluates the answer string for the answer object.
     * If the logic function returns a promise all nested promises get resolved.
     * @param message
     * @param kwargs
     * @param argsString
     * @returns {Promise<*>}
     */
    async evaluate(message, kwargs, argsString) {
        let result = this._func(message, kwargs, argsString);
        if (result instanceof Promise)
            return await utils.resolveNestedPromise(result);
        else
            return result;
    }
}

class Command {

    /**
     * Creates a new command object where the answer function needs
     * to be implemented for it to work.
     * @param template {JSON:{}}
     * @param answer {Answer}
     */
    constructor(template, answer) {
        this.name = template.name;
        this.prefix = '';
        this.description = template.description;
        this.args = template.args || [];
        this.permission = template.permission;
        this.category = template.category || 'Other';
        this.usage = template.usage ||
            `${this.name} [${this.args.join('][')}]`.replace('[]', '');
        this.answObj = answer;
        if (!template.name)
            throw new Error("Template doesn't define a name.");
    }

    /**
     * This method is meant to be replaced by logic.
     * @abstract
     * @param message {Discord.Message}
     * @param kwargs {JSON}
     * @param argsString {String} The raw argument string.
     * @returns {String}
     */
    async answer(message, kwargs, argsString) {
        return await this.answObj.evaluate(message, kwargs, argsString);
    }

    /**
     * Returns rich help embed for this command.
     * @returns {*|Discord.RichEmbed}
     */
    get help() {
        return new ExtendedRichEmbed(`Help for ${this.name}`)
            .addFields({
                'Usage': `\`${this.prefix}${this.usage}\``,
                'Description': this.description,
                'Permission Role': this.permission
            });
    }
}

class CommandHandler {

    /**
     * Initializes the CommandHandler
     * @param prefix {String} The prefix of all commands.
     * @param scope {Number} A scope from the CommandScopes (scopes)
     */
    constructor(prefix, scope) {
        this.prefix = prefix;
        this.scope = scope;
        this.commands = {};
        this._logger = new logging.Logger(`${this.constructor.name}@${Object.keys(scopes)[this.scope]}`);
    }

    /**
     * Handles the command and responds to the message.
     * @param commandMessage {String}
     * @param message {Discord.Message}
     * @returns {Boolean | String | Promise<String|Discord.RichEmbed>}
     */
    handleCommand(commandMessage, message) {
        this._logger.debug(`Handling command ${commandMessage}`);
        let commandName = commandMessage.match(/^\S+/);
        if (commandName.length > 0)
            commandName = commandName[0];
        this._logger.silly(`Command name is ${commandName}`);
        if (commandName.indexOf(this.prefix) >= 0) {
            commandName = commandName.replace(this.prefix, '');
            let argsString = commandMessage.replace(/^\S+/, '');
            argsString = argsString
                .replace(/^\s+/, '')    // leading whitespace
                .replace(/\s+$/, '');   // trailing whitespace
            let args = argsString.match(/\S+/g);
            let command = this.commands[commandName];
            if (command && this._checkPermission(message, command.permission)) {
                this._logger.silly(`Permission ${command.permission} granted for command ${commandName}`);
                let kwargs = {};
                if (args)
                    for (let i = 0; i < Math.min(command.args.length, args.length); i++)
                        kwargs[command.args[i]] = args[i];
                return command.answer(message, kwargs, argsString);
            } else if (command) {
                this._logger.silly(`Permission ${command.permission} denied for command ${commandName}`);
                return "You don't have permission for this command";
            } else {
                this._logger.silly(`Command ${commandName} not found.`);
                return false;
            }
        } else {
            this._logger.silly(`No prefix found in command ${commandName}`);
            return false;
        }
    }

    /**
     * Registers the command so that the handler can use it.
     * @param command {Command}
     */
    registerCommand(command) {
        command.prefix = this.prefix;
        this.commands[command.name] = command;
        this._logger.debug(`Registered ${command.name} on handler`);
        return this;
    }


    /**
     * Checks if the author of the message has the given permission
     * @param msg {Discord.Message}
     * @param rolePerm {String} Permission String
     * @returns {boolean}
     * @private
     */
    _checkPermission(msg, rolePerm) {
        if (!rolePerm || ['all', 'any', 'everyone'].includes(rolePerm))
            return true;
        if (config.owners.includes(msg.author.tag))
            return true;
        else if (msg.member && rolePerm && rolePerm !== 'owner' && msg.member.roles
            .some(role => (role.name.toLowerCase() === rolePerm.toLowerCase() ||
                role.name.toLowerCase() === 'botcommander')))
            return true;
        return false;
    }
}

/**
 * @abstract
 */
class CommandModule {

    /**
     * Initializes a CommandModule instance.
     * @param scope
     */
    constructor(scope) {
        this.scope = scope;
        this._logger = new logging.Logger(this);
    }

    /**
     * Loads a template for the object property templateFile or the given argument file.
     * @returns {Promise<void>}
     * @private
     */
    async _loadTemplate(file) {
        let templateString = await fsx.readFile(this.templateFile || file, {encoding: 'utf-8'});
        this._logger.silly(`Loaded Template file ${this.templateFile || file}`);
        this.template = yaml.safeLoad(templateString);
    }

    /**
     * Registering commands after loading a template
     * @param commandHandler {CommandHandler}
     * @returns {Promise<void>}
     */
    async register(commandHandler) { // eslint-disable-line no-unused-vars

    }
}

class ExtendedRichEmbed extends Discord.RichEmbed {

    /**
     * Constructor that automatically set's the Title and Timestamp.
     * @param title {String}
     */
    constructor(title) {
        super();
        this.setTitle(title);
        this.setTimestamp();
    }

    /**
     * Adds a Field when a name is given or adds a blank Field otherwise
     * @param name {String}
     * @param content {String}
     * @returns {ExtendedRichEmbed}
     */
    addNonemptyField(name, content) {
        if (name && name.length > 0 && content)
            this.addField(name, content);
        return this;
    }

    /**
     * Adds the fields defined in the fields JSON
     * @param fields {JSON}
     * @returns {ExtendedRichEmbed}
     */
    addFields(fields) {
        for (let [name, value] of Object.entries(fields))
            this.addNonemptyField(name, value);
        return this;
    }
}

// -- exports -- //

Object.assign(exports, {
    Answer: Answer,
    Command: Command,
    CommandHandler: CommandHandler,
    CommandModule: CommandModule,
    ExtendedRichEmbed: ExtendedRichEmbed,
    CommandScopes: scopes
});
