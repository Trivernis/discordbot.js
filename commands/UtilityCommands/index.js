const cmdLib = require('../../lib/command');

/**
 * Utility commands are all commands that allow the user to control the behaviour of the
 * bot. Utility commands for example are allowed to:
 *  - manipulate the main database
 *  - manipulate the bot's presences
 *  - manipulate the process (e.g. shutdown)
 */

class UtilityCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties:
     *     bot - the instance of the bot.
     *     config - the config object
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.User);
        this._templateDir = __dirname;
        this._bot = opts.bot;
        this._config = opts.config;
    }

    async register(commandHandler) {
        await this._loadTemplate();

        let addPresence = new cmdLib.Command(
            this.template.add_presence,
            new cmdLib.Answer(async (m, k, s) => {
                this._bot.presences.push(s);
                await this._bot.maindb.run('INSERT INTO presences (text) VALUES (?)', [s]);
                return `Added Presence \`${s}\``;
            })
        );

        let rotatePresence = new cmdLib.Command(
            this.template.rotate_presence,
            new cmdLib.Answer(() => {
                try {
                    this._bot.client.clearInterval(this._bot.rotator);
                    this._bot.rotatePresence();
                    this._bot.rotator = this._bot.client.setInterval(() => this._bot.rotatePresence(),
                        this._config.presence_duration);
                } catch (error) {
                    this._logger.warn(error.message);
                }
            })
        );

        let shutdown = new cmdLib.Command(
            this.template.shutdown,
            new cmdLib.Answer(async (m) => {
                try {
                    await m.reply('Shutting down...');
                    this._logger.debug('Destroying client...');
                    await this._bot.client.destroy();
                } catch (err) {
                    this._logger.error(err.message);
                    this._logger.debug(err.stack);
                }
                try {
                    this._logger.debug('Exiting server...');
                    await this._bot.webServer.stop();
                } catch (err) {
                    this._logger.error(err.message);
                    this._logger.debug(err.stack);
                }
                try {
                    this._logger.debug(`Exiting Process...`);
                    process.exit(0);
                } catch (err) {
                    this._logger.error(err.message);
                    this._logger.debug(err.stack);
                }
            })
        );

        let createUser = new cmdLib.Command(
            this.template.create_user,
            new cmdLib.Answer(async (m, k) => {
                if (k.username &&k.password && k.scope) {
                    this._logger.debug(`Creating user entry for ${k.username}`);
                    let token = await this._bot.webServer.createUser(
                        k.username, k.password, k.scope, false);
                    return `${k.username}'s token is ${token}`;
                }
            })
        );

        let bugReport = new cmdLib.Command(
            this.template.bugreport,
            new cmdLib.Answer(() => {
                return new cmdLib.ExtendedRichEmbed(this.template.bugreport.response.title)
                    .setDescription(this.template.bugreport.response.bug_report);
            })
        );

        // register commands
        commandHandler.registerCommand(addPresence)
            .registerCommand(rotatePresence)
            .registerCommand(shutdown)
            .registerCommand(createUser)
            .registerCommand(bugReport);
    }
}

Object.assign(exports, {
    'module': UtilityCommandModule
});
