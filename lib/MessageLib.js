const cmdLib = require('./CommandLib'),
    config = require('../config.json'),
    Discord = require('discord.js'),
    promiseWaterfall = require('promise-waterfall');

class MessageHandler {

    /**
     * Message Handler to handle messages. Listens on the
     * _client message event.
     * @param client {Discord.Client}
     * @param logger {winston._logger}
     */
    constructor (client, logger) {
        this.logger = logger;
        this.discordClient = client;
        this.globalCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.Global);
        this.userCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.User);
        this.guildCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.Guild);
        this._registerEvents();
    }

    /**
     * Returns the handler fitting the scope
     * @param scope {Number}
     * @returns {cmdLib.CommandHandler}
     */
    getHandler(scope) {
        switch (scope) {
            case cmdLib.CommandScopes.Global:
                return this.globalCmdHandler;
            case cmdLib.CommandScopes.Guild:
                return this.guildCmdHandler;
            case cmdLib.CommandScopes.User:
                return this.userCmdHandler;
        }
    }

    /**
     * Registers a command module to a command handler.
     * @param CommandModule {cmdLib.CommandModule}
     * @param options {Object} Options passed to the module constructor.
     * @returns {Promise<void>}
     */
    async registerCommandModule(CommandModule, options) {
        this.logger.info(`Registering command module ${CommandModule.name}...`);
        let cmdModule = new CommandModule(options);
        await cmdModule.register(this.getHandler(cmdModule.scope));
    }

    /**
     * Registering event handlers.
     * @private
     */
    _registerEvents() {
        this.logger.debug('Registering message event...');
        this.discordClient.on('message', async (msg) => {
            this.logger.debug(`<${msg.guild? msg.channel.name+'@'+msg.guild.name : 'PRIVATE'}> ${msg.author.tag}: ${msg.content}`);
            if (msg.author !== this.discordClient.user) {
                let sequence = this._parseSyntax(msg);
                this.logger.debug(`Syntax parsing returned: ${JSON.stringify(sequence)}`);
                await this._executeCommandSequence(sequence, msg);
                this.logger.debug('Executed command sequence');
            }
        });
    }

    /**
     * Parses the syntax of a message into a command array.
     * @param message
     * @returns {Array<Array<String>>}
     * @private
     */
    _parseSyntax(message) {
        this.logger.debug('Parsing command sequence...');
        let commandSequence = [];
        let content = message.content;
        let strings = content.match(/".+?"/g) || [];

        for (let string of strings)
            content = content.replace(string, string  // escape all special chars
                .replace(';', '\\;')
                .replace('&', '\\&'));
        let independentCommands = content   // independent command sequende with ;
            .split(/(?<!\\);/g)
            .map(x => x.replace(/^ +/, ''));
        for (let indepCommand of independentCommands)
            commandSequence.push(indepCommand
                .split(/(?<!\\)&&/g)        // dependend sequence with && (like unix)
                .map(x => x.replace(/^ +/, ''))
            );
        return commandSequence;
    }

    /**
     * Executes a sequence of commands
     */
    async _executeCommandSequence(cmdSequence, message) {
        this.logger.debug(`Executing command sequence: ${JSON.stringify(cmdSequence)} ...`);
        let scopeCmdHandler = this.getScopeHandler(message);
        await Promise.all(cmdSequence.map((sq) => promiseWaterfall(sq.map((cmd) => async () => {
            try {
                this.logger.debug(`Executing command ${cmd}`);
                let globalResult = await this.globalCmdHandler.handleCommand(cmd, message);
                let scopeResult = await scopeCmdHandler.handleCommand(cmd, message);
                this.logger.debug(`globalResult: ${globalResult}, scopeResult: ${scopeResult}`);

                if (scopeResult)
                    this._answerMessage(message, scopeResult);
                else if (globalResult)
                    this._answerMessage(message, globalResult);
            } catch (err) {
                this.logger.verbose(err.message);
                this.logger.silly(err.stack);
            }
        }))));
    }

    /**
     * Returns two commandHandlers for the messages scope.
     * @param message
     * @private
     */
    getScopeHandler(message) {
        if (message && message.guild)
            return this.guildCmdHandler;
        else
            return this.userCmdHandler;
    }

    /**
     * Answers
     * @param message {Discord.Message}
     * @param answer {String | Discord.RichEmbed}
     * @private
     */
    _answerMessage(message, answer) {
        this.logger.debug(`Sending answer ${answer}`);
        if (answer)
            if (answer instanceof Discord.RichEmbed)
                message.channel.send('', answer);
            else
                message.channel.send(answer);
    }
}

Object.assign(exports, {
    MessageHandler: MessageHandler
});
