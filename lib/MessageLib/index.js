const cmdLib = require('../CommandLib'),
    config = require('../../config.json'),
    Discord = require('discord.js'),
    logging = require('../utils/logging'),
    promiseWaterfall = require('promise-waterfall');

/* eslint no-useless-escape: 0 */

class MessageHandler {

    /**
     * Message Handler to handle messages. Listens on the
     * _client message event.
     * @param client {Discord.Client}
     */
    constructor (client) {
        this.discordClient = client;
        this.logger = new logging.Logger(this);
        this.globalCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.Global);
        this.userCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.User);
        this.guildCmdHandler = new cmdLib.CommandHandler(config.prefix,
            cmdLib.CommandScopes.Guild);
        this.userRates = {};
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
     * Parses a string to a command sequence Array.
     * Workaround to not reveal the private parseSyntax function.
     * @param synStr {String}
     */
    parseSyntaxString(synStr) {
        return this._parseSyntax({content: synStr});
    }

    /**
     * Registering event handlers.
     * @private
     */
    _registerEvents() {
        this.logger.debug('Registering message event...');
        this.discordClient.on('message', async (msg) => {
            this.logger.verbose(`<${msg.guild? msg.channel.name+'@'+msg.guild.name : 'PRIVATE'}> ${msg.author.tag}: ${msg.content}`);
            if (msg.author !== this.discordClient.user
                && this._checkPrefixStart(msg.content)
                && !this._checkRateReached(msg.author)) {

                let sequence = this._parseSyntax(msg);
                this.logger.debug(`Syntax parsing returned: ${JSON.stringify(sequence)}`);
                await this.executeCommandSequence(sequence, msg);
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
        this.logger.silly('Parsing command sequence...');
        let commandSequence = [];
        let content = message.content;
        let strings = content.match(/".+?"/g) || [];

        for (let string of strings)
            content = content.replace(string, string  // escape all special chars
                .replace(/;/g, '\\;')
                .replace(/&/g, '\\&'));
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
    async executeCommandSequence(cmdSequence, message) {
        this.logger.silly(`Executing command sequence: ${JSON.stringify(cmdSequence)} ...`);
        let scopeCmdHandler = this.getScopeHandler(message);
        await Promise.all(cmdSequence.map((sq) => promiseWaterfall(sq.map((cmd) => async () => {
            try {
                this.logger.silly(`Executing command ${cmd}`);
                let globalResult = await this.globalCmdHandler.handleCommand(cmd, message);
                let scopeResult = await scopeCmdHandler.handleCommand(cmd, message);
                this.logger.silly(`globalResult: ${globalResult}, scopeResult: ${scopeResult}`);

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

    /**
     * Checks if the messageString beginns with a command prefix.
     * @param msgString {String}
     * @private
     */
    _checkPrefixStart(msgString) {
        let p1 = this.globalCmdHandler.prefix;
        let p2 = this.guildCmdHandler.prefix;
        let p3 = this.userCmdHandler.prefix;
        return (
            new RegExp(`^\\s*?${p1}`).test(msgString) ||
            new RegExp(`^\\s*?${p2}`).test(msgString) ||
            new RegExp(`^\\s*?${p3}`).test(msgString));
    }

    /**
     * Checks if the user has reached the command rate limit and updates it.
     * @param user {Discord.User}
     * @returns {boolean}
     * @private
     */
    _checkRateReached(user) {
        if (!this.userRates[user.tag])
            this.userRates[user.tag] = {last: 0, count: 0};
        let userEntry = this.userRates[user.tag];
        let reached = ((Date.now() - userEntry.last)/1000) < (config.rateLimitTime || 10)
            && userEntry.count > (config.rateLimitCount || 5);
        if (((Date.now() - userEntry.last)/1000) > (config.rateLimitTime || 10))
            this.userRates[user.tag].count = 0;
        this.userRates[user.tag].last = Date.now();
        this.userRates[user.tag].count++;
        return reached;
    }
}

Object.assign(exports, {
    MessageHandler: MessageHandler
});
