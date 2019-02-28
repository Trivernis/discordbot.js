const Discord = require('discord.js');

const scopes = {
    'Global': 0,
    'User': 1,
    'Guild': 2
};

class Answer {

    /**
     * Creates an new Answer object with func as answer logic.
     * @param func
     */
    constructor(func) {
        this.func = func;
    }

    /**
     * Evaluates the answer string for the answer object.
     * @param message
     * @param kwargs
     * @param argsString
     * @returns {Promise<*>}
     */
    async evaluate(message, kwargs, argsString) {
        let result = this.func(message, kwargs, argsString);
        switch (result.constructor.name) {
            case 'Promise':
                return await this.evaluate(await result);
            default:
                return result;
        }
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
        this.description = template.description;
        this.args = template.args || [];
        this.permission = template.permission;
        this.category = template.category || 'Other';
        this.usage = template.usage ||
            `\`${this.name} [${this.args.join('][')}\``.replace('[]', '');
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
     * @returns {Discord.RichEmbed}
     */
    get help() {
        return new ExtendedRichEmbed(`Help for ${this.name}`)
            .addFields({
                'Usage': this.usage,
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
    }

    /**
     * Handles the command and responds to the message.
     * @param commandMessage {String}
     * @param message {Discord.Message}
     * @returns {Boolean | Promise<String|Discord.RichEmbed>}
     */
    handleCommand(commandMessage, message) {
        let commandName = commandMessage.match(/^\S+/);
        if (commandName.indexOf(this.prefix) > 0) {
            commandName = commandName.replace(this.prefix);
            let argsString = commandMessage.replace(/^\S+/, '');
            let args = argsString(/\S+/g);
            let command = this.commands[commandName];
            let kwargs = {};

            for (let i = 0; i < Math.min(command.kwargs, args.length); i++)
                kwargs[command.kwargs[i]] = args[i];

            return command.answer(message, kwargs, argsString);
        } else {
            return false;
        }
    }

    /**
     * Registers the command so that the handler can use it.
     * @param name {String}
     * @param command {Command}
     */
    registerCommand(name, command) {
        this.commands[name] = command;
    }

    /**
     * Registers a map of commands containing of the name and the command.
     * @param commandMap {Map}
     */
    registerCommands(commandMap) {
        for (let [name, cmd] in commandMap)
            this.commands[name] = cmd;
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
     */
    addNonemptyField(name, content) {
        if (name && name.length > 0 && content)
            this.addField(name, content);
    }

    /**
     * Adds the fields defined in the fields JSON
     * @param fields {JSON}
     */
    addFields(fields) {
        for (let [name, value] in Object.entries(fields))
            this.addNonemptyField(name, value);
    }
}

// -- exports -- //

Object.assign(exports, {
    Answer: Answer,
    Command: Command,
    CommandHandler: CommandHandler,
    ExtendedRichEmbed: ExtendedRichEmbed,
    CommandScopes: scopes
});
