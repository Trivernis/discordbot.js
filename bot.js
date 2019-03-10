const Discord = require("discord.js"),
    fs = require('fs-extra'),
    logging = require('./lib/utils/logging'),
    msgLib = require('./lib/message'),
    guilding = require('./lib/guilds'),
    utils = require('./lib/utils'),
    config = require('./config.json'),
    args = require('args-parser')(process.argv),
    dblib = require('./lib/database'),
    authToken = args.token || config.api.botToken,
    prefix = args.prefix || config.prefix || '~',
    gamepresence = args.game || config.presence;

let weblib = null;

/**
 * The Bot class handles the initialization and Mangagement of the Discord bot and
 * is the main class.
 */
class Bot {

    constructor() {
        this.client = new Discord.Client({autoReconnect: true});
        this.logger = new logging.Logger(this);
        this.rotator = null;
        this.maindb = null;
        this.presences = [];
        this.messageHandler = new msgLib.MessageHandler(this.client);
        this.guildHandlers = {};

        this.logger.verbose('Verifying config');

        let configVerifyer = new utils.ConfigVerifyer(config, [
            "api.botToken", "api.youTubeApiKey",
            "commandSettings.maxSequenceParallel",
            "commandSettings.maxSequenceSerial"
        ]);
        if (!configVerifyer.verifyConfig(this.logger))
            if (!args.i) {
                this.logger.info('Invalid config. Exiting');
                this.logger.flush().then(() => {
                    process.exit(1);
                });
            }
    }

    /**
     * Initializes all services.
     * @returns {Promise<void>}
     */
    async initServices() {
        this.logger.verbose('Registering cleanup function');

        utils.Cleanup(() => {
            for (let gh in Object.values(this.guildHandlers))
                if (gh instanceof guilding.GuildHandler)
                    gh.destroy();

            this.client.destroy().then(() => {
                this.logger.debug('destroyed client');
            }).catch((err) => {
                this.logger.error(err.message);
                this.logger.debug(err.stack);
            });
            this.maindb.close();
        });
        await this.initializeDatabase();

        if (config.webinterface && config.webinterface.enabled)
            await this.initializeWebserver();
        this.logger.verbose('Registering commands');
        await this.messageHandler.registerCommandModule(require('./commands/AnilistApiCommands').module, {});
        await this.messageHandler.registerCommandModule(require('./commands/UtilityCommands').module, {
            bot: this,
            config: config
        });
        await this.messageHandler.registerCommandModule(require('./commands/InfoCommands').module, {
            client: this.client,
            messageHandler: this.messageHandler
        });
        await this.messageHandler.registerCommandModule(require('./commands/MusicCommands').module, {
            getGuildHandler: async (g) => await this.getGuildHandler(g)
        });
        await this.messageHandler.registerCommandModule(require('./commands/ServerUtilityCommands').module, {
            getGuildHandler: async (g) => await this.getGuildHandler(g),
            messageHandler: this.messageHandler,
            config: config
        });
        await this.messageHandler.registerCommandModule(require('./commands/MiscCommands').module, {});
        this.registerEvents();
    }

    /**
     * Starting the bot by connecting to the discord service and starting the webservice.
     * @returns {Promise<any>}
     */
    async start() {
        await this.client.login(authToken);
        this.logger.debug("Logged in");

        if (this.webServer) {
            this.webServer.start();
            this.logger.info(`WebServer runing on port ${this.webServer.port}`);
        }
    }

    /**
     * Initializes the database by checking first for the existence of the data folder.
     * @returns {Promise<void>}
     */
    async initializeDatabase() {
        this.logger.debug('Checking for ./data/ existence');
        await fs.ensureDir('./data');
        this.logger.verbose('Connecting to main database');
        this.maindb = new dblib.Database('main');
        await this.maindb.initDatabase();
        let sql = this.maindb.sql;
        await this.maindb.run(sql.createTableIfNotExists('presences', [
            sql.templates.idcolumn,
            new dblib.Column('text', sql.types.getVarchar(255),
                [sql.constraints.unique, sql.constraints.notNull])
        ]));
        this.logger.debug('Loading Presences...');
        await this.loadPresences();
    }

    /**
     * initializes the api webserver
     */
    async initializeWebserver() {
        this.logger.verbose('Importing weblib');
        weblib = require('./lib/web');
        this.logger.verbose('Creating WebServer');
        this.webServer = new weblib.WebServer(config.webinterface.port || 8080);
        this.logger.debug('Setting Reference Objects to webserver');

        await this.webServer.setReferenceObjects({
            client: this.client,
            presences: this.presences,
            maindb: this.maindb,
            prefix: prefix,
            getGuildHandler: async (g) => await this.getGuildHandler(g),
            guildHandlers: this.guildHandlers
        });
    }

    /**
     * If a data/presences.txt exists, it is read and each line is put into the presences array.
     * Each line is also stored in the dbot-main.db database. After the file is completely read, it get's deleted.
     * Then the data is read from the database and if the presence doesn't exist in the presences array, it get's
     * pushed in there. If the presences.txt file does not exist, the data is just read from the database. In the end
     * a rotator is created that rotates the presence every configured duration.
     */
    async loadPresences() {
        let sql = this.maindb.sql;
        if (await fs.pathExists('./data/presences.txt')) {
            let lineReader = require('readline').createInterface({
                input: require('fs').createReadStream('./data/presences.txt')
            });
            this.maindb.begin();
            lineReader.on('line', async (line) => {
                try {
                    await this.maindb.query(sql.insert('presences', {text: sql.parameter(1)}), [line]);
                    this.presences.push(line);
                } catch (err) {
                    this.logger.warn(err.message);
                    this.logger.debug(err.stack);
                }
            });
            await this.maindb.commit();
            this.rotator = this.client.setInterval(() => this.rotatePresence(),
                config.presence_duration || 360000);
            await fs.unlink('./data/presences.txt');
            let rows = await this.maindb.all(sql.select('presences', false, ['text']));
            for (let row of rows)
                if (!(row[0] in this.presences))
                    this.presences.push(row.text);
        } else {
            let rows = await this.maindb.all(sql.select('presences', false, ['text']));
            for (let row of rows)
                this.presences.push(row.text);
            this.rotator = this.client.setInterval(() => this.rotatePresence(),
                config.presence_duration || 360000);
        }
    }

    /**
     * changes the presence of the bot by using one stored in the presences array
     */
    rotatePresence() {
        let pr = this.presences.shift();
        this.presences.push(pr);

        this.client.user.setPresence({
            game: {name: `${gamepresence} | ${pr}`, type: "PLAYING"},
            status: 'online'
        }).then(() => this.logger.debug(`Presence rotation to ${pr}`))
            .catch((err) => this.logger.warn(err.message));
    }


    /**
     * Registeres callbacks for client events message and ready
     */
    registerEvents() {
        this.client.on('error', (err) => {
            this.logger.error(err.message);
            this.logger.debug(err.stack);
        });

        this.client.on('ready', () => {
            this.logger.info(`logged in as ${this.client.user.tag}!`);

            this.client.user.setPresence({
                game: {
                    name: gamepresence, type: "PLAYING"
                }, status: 'online'
            }).catch((err) => {
                if (err)
                    this.logger.warn(err.message);
            });
        });

        this.client.on('voiceStateUpdate', async (oldMember, newMember) => {
            let gh = await this.getGuildHandler(newMember.guild);

            if (newMember.user === this.client.user) {
                if (newMember.voiceChannel)
                    gh.musicPlayer.updateChannel(newMember.voiceChannel);
            } else {
                if (oldMember.voiceChannel === gh.musicPlayer.voiceChannel || newMember.voiceChannel === gh.musicPlayer.voiceChannel)
                    gh.musicPlayer.checkListeners();
            }
        });
    }

    /**
     * Returns the guild handler by id, creates one if it doesn't exist and returns it then
     * @param guild {Guild}
     * @returns {*}
     */
    async getGuildHandler(guild) {
        if (!this.guildHandlers[guild.id]) {
            let newGuildHandler = new guilding.GuildHandler(guild);
            await newGuildHandler.initDatabase();
            await newGuildHandler.applySettings();
            this.guildHandlers[guild.id] = newGuildHandler;
        }
        return this.guildHandlers[guild.id];
    }
}


// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    let logger = new logging.Logger('MAIN-init');
    process.on('unhandledRejection', err => {
        // Will print "unhandledRejection err is not defined"
        logger.warn(err.message);
        logger.debug(err.stack);
    });

    logger.info("Starting up... ");
    logger.debug('Calling constructor...');
    let discordBot = new Bot();
    logger.debug('Initializing services...');

    discordBot.initServices().then(() => {
        logger.debug('Starting Bot...');
        discordBot.start().catch((err) => { //eslint-disable-line promise/no-nesting
            logger.error(err.message);
            logger.debug(err.stack);
        });
    }).catch((err) => {
        logger.error(err.message);
        logger.debug(err.stack);
    });
}
