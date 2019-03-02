const cmdLib = require('../../CommandLib'),
    location = './lib/commands/UtilityCommands';

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
     *     logger - the instance of the logger.
     *     config - the config object
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.User);
        this.templateFile = location + '/UtilityCommandsTemplate.yaml';
        this.bot = opts.bot;
        this.logger = opts.logger;
        this.config = opts.config;
    }

    async register(commandHandler) {
        await this._loadTemplate();

        let addPresence = new cmdLib.Command(
            this.template.add_presence,
            new cmdLib.Answer(async (m, k, s) => {
                this.bot.presences.push(s);
                await this.bot.maindb.run('INSERT INTO presences (text) VALUES (?)', [s]);
                return `Added Presence \`${s}\``;
            })
        );

        let rotatePresence = new cmdLib.Command(
            this.template.rotate_presence,
            new cmdLib.Answer(() => {
                try {
                    this.bot.client.clearInterval(this.rotator);
                    this.bot.rotatePresence();
                    this.bot.rotator = this.bot.client.setInterval(() => this.bot.rotatePresence(),
                        this.config.presence_duration);
                } catch (error) {
                    this.logger.warn(error.message);
                }
            })
        );

        let shutdown = new cmdLib.Command(
            this.template.shutdown,
            new cmdLib.Answer(async (m) => {
                try {
                    await m.reply('Shutting down...');
                    this.logger.debug('Destroying client...');
                } catch (err) {
                    this.logger.error(err.message);
                    this.logger.debug(err.stack);
                }
                try {
                    await this.bot.client.destroy();
                    this.logger.debug('Exiting server...');
                } catch (err) {
                    this.logger.error(err.message);
                    this.logger.debug(err.stack);
                }
                try {
                    await this.bot.webServer.stop();
                    this.logger.debug(`Exiting Process...`);
                    process.exit(0);
                } catch (err) {
                    this.logger.error(err.message);
                    this.logger.debug(err.stack);
                }
            })
        );

        let createUser = new cmdLib.Command(
            this.template.create_user,
            new cmdLib.Answer(async (m, k) => {
                if (k.username &&k.password && k.scope) {
                    this.logger.debug(`Creating user entry for ${k.username}`);
                    let token = await this.bot.webServer.createUser(
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
        commandHandler.registerCommand(addPresence);
        commandHandler.registerCommand(rotatePresence);
        commandHandler.registerCommand(shutdown);
        commandHandler.registerCommand(createUser);
        commandHandler.registerCommand(bugReport);
    }
}

Object.assign(exports, {
    'module': UtilityCommandModule
});
