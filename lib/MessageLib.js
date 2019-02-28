const cmdLib = require('CommandLib'),
    config = require('../config.json'),
    Discord = require('discord.js'),
    promiseWaterfall = require('promise-waterfall');

class MessageHandler {

    /**
     * Message Handler to handle messages. Listens on the
     * client message event.
     * @param client {Discord.Client}
     * @param logger {winston.logger}
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
     * Registering event handlers.
     * @private
     */
    _registerEvents() {
        this.discordClient.on('message', async (msg) => {
            let sequence = this._parseSyntax(msg);
            await this._executeCommandSequence(sequence);
        });
    }

    /**
     * Parses the syntax of a message into a command array.
     * @param message
     * @returns {Array<Array<String>>}
     * @private
     */
    _parseSyntax(message) {
        let commandSequence = [];
        let content = message.content;
        let strings = content.match(/".+?"/g);

        for (let string in strings)
            content.replace(string, string  // escape all special chars
                .replace(';', '\\;'))
                .replace('&', '\\&');
        let independentCommands = content   // independent command sequende with ;
            .split(/(?<!\\);/g)
            .map(x => x.replace(/^ +/, ''));
        for (let indepCommand in independentCommands)
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
        let  scopeCmdHandler = this._getScopeHandlers(message);
        await Promise.all(cmdSequence.map(async (sq) => {
            return await promiseWaterfall(sq.map(async (cmd) => {
                let globalResult = await this.globalCmdHandler.handleCommand(cmd, message);
                let scopeResult = await scopeCmdHandler.handleCommand(cmd, message);

                if (scopeResult)
                    this._answerMessage(message, scopeResult);
                else if (globalResult)
                    this._answerMessage(message, globalResult);
            }));
        }));
    }

    /**
     * Returns two commandHandlers for the messages scope.
     * @param message
     * @private
     */
    _getScopeHandler(message) {
        if (message.guild)
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
        if (answer)
            if (answer instanceof Discord.RichEmbed)
                message.channel.send('', answer);
            else
                message.channel.send(answer);
    }
}
