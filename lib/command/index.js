const Discord = require('discord.js'),
    yaml = require('js-yaml'),
    fsx = require('fs-extra'),
    logging = require('../utils/logging'),
    config = require('../../config.json'),
    xevents = require('../utils/extended-events'),
    utils = require('../utils');

const scopes = new utils.Enum([
    'Global',
    'User',
    'Guild'
]);

/**
 * The answer message object that is used for easyer access to events.
 */
class Response extends xevents.ExtendedEventEmitter {

    /**
     * Constructor.
     * @param content
     */
    constructor(content) {
        super();
        this.content = content;
        this.message = null;
    }
}

class Answer {

    /**
     * Creates an new Answer object with _func as answer logic.
     * @param func {function} - the function to evaluate the answer
     * @param [onSent] {function} - executed when the response was sent
     */
    constructor(func, onSent) {
        this._func = func;
        this.listeners = onSent? {sent: onSent} : {};
        this.lastResponse = null;
    }

    /**
     * Evaluates the answer string for the answer object.
     * If the logic function returns a promise all nested promises get resolved.
     * @param message
     * @param kwargs
     * @param argsString
     * @returns {Promise<Response>}
     */
    async evaluate(message, kwargs, argsString) {
        let result = this._func(message, kwargs, argsString);
        if (result instanceof Promise)
            return this._getResponseInstance(await utils.resolveNestedPromise(result));
        else
            return this._getResponseInstance(result);
    }

    /**
     * Returns a response instance with listeners attached if defined.
     * @param responseContent
     * @returns {Response}
     * @private
     */
    _getResponseInstance(responseContent) {
        this.lastResponse = new Response(responseContent);

        if (this.listeners)
            this.lastResponse.addListeners(this.listeners);
        return this.lastResponse;
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
     * @returns {Response}
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
     * @returns {Response | Promise<Response>}
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
                return new Response("You don't have permission for this command");
            } else {
                this._logger.silly(`Command ${commandName} not found.`);
                return null;
            }
        } else {
            this._logger.silly(`No prefix found in command ${commandName}`);
            return null;
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
     * Loads a template for the module from the this._templateDir directory.
     * Loads the template from this.templateFile if the attribute exists.
     * @param dir {String} Overides the this._templateDir with this directory.
     * @returns {Promise<void>}
     * @private
     */
    async _loadTemplate(dir) {
        if (!this.templateFile)
            this.templateFile = (dir || this._templateDir) + '/template.yaml';
        let templateString = await fsx.readFile(this.templateFile, {encoding: 'utf-8'});
        this._logger.silly(`Loaded Template file ${this.templateFile}`);
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
     * Adds the fields defined in the fields JSON
     * @param fields {JSON}
     * @returns {ExtendedRichEmbed}
     */
    addFields(fields) {
        for (let [name, value] of Object.entries(fields))
            this.addField(name, value);
        return this;
    }

    /**
     * Sets the description by shortening the value string to a fitting length for discord.
     * @param value
     */
    setDescription(value) {
        if (value) {
            let croppedValue = value;
            if (value.substring)
                croppedValue = value.substring(0, 1024);
            if (croppedValue.length < value.length && croppedValue.replace)
                croppedValue = croppedValue.replace(/\n.*$/g, '');
            if (croppedValue && croppedValue.replace
                && croppedValue.replace(/\n/g, '').length > 0)
                super.setDescription(croppedValue);
        }
        return this;
    }

    /**
     * Sets the field by shortening the value stirn to a fitting length for discord.
     * @param name
     * @param value
     */
    addField(name, value) {
        if (name && value) {
            let croppedValue = value;
            if (value.substring)
                croppedValue = value.substring(0, 1024);
            if (croppedValue && croppedValue.length < value.length && croppedValue.replace)
                croppedValue = croppedValue.replace(/\n.*$/g, '');
            if (croppedValue && croppedValue.replace
                && croppedValue.replace(/\n/g, '').length > 0 && name.replace(/\n/g, '').length > 0)
                super.addField(name, croppedValue);
        }
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
