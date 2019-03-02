const Discord = require("discord.js"),
    fs = require('fs-extra'),
    logger = require('./lib/logging').getLogger(),
    msgLib = require('./lib/MessageLib'),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    utils = require('./lib/utils'),
    config = require('./config.json'),
    args = require('args-parser')(process.argv),
    waterfall = require('promise-waterfall'),
    sqliteAsync = require('./lib/sqliteAsync'),
    authToken = args.token || config.api.botToken,
    prefix = args.prefix || config.prefix || '~',
    gamepresence = args.game || config.presence;

let weblib = null;

class Bot {
    constructor() {
        this.client = new Discord.Client({autoReconnect: true});
        this.mention = false;
        this.rotator = null;
        this.maindb = null;
        this.presences = [];
        this.messageHandler = new msgLib.MessageHandler(this.client, logger);
        this.guildHandlers = [];
        this.userRates = {};

        logger.verbose('Verifying config');

        let configVerifyer = new utils.ConfigVerifyer(config, [
            "api.botToken", "api.youTubeApiKey"
        ]);
        if (!configVerifyer.verifyConfig(logger))
            if (!args.i) {
                logger.info('Invalid config. Exiting');
                logger.flush().then(() => {
                    process.exit(1);
                });
            }
        cmd.setLogger(logger);
        guilding.setLogger(logger);
    }

    /**
     * Initializes all services.
     * @returns {Promise<void>}
     */
    async initServices() {
        logger.verbose('Registering cleanup function');

        utils.Cleanup(() => {
            for (let gh in Object.values(this.guildHandlers))
                if (gh instanceof guilding.GuildHandler)
                    gh.destroy();

            this.client.destroy().then(() => {
                logger.debug('destroyed client');
            }).catch((err) => {
                logger.error(err.message);
                logger.debug(err.stack);
            });
            this.maindb.close();
        });
        await this.initializeDatabase();

        if (config.webservice && config.webservice.enabled)
            await this.initializeWebserver();
        logger.verbose('Registering commands');
        await this.messageHandler
            .registerCommandModule(require('./lib/commands/AnilistApiCommands').module, {});
        await this.messageHandler
            .registerCommandModule(require('./lib/commands/UtilityCommands').module, {bot: this, logger: logger, config: config});
        await this.messageHandler
            .registerCommandModule(require('./lib/commands/InfoCommands').module, {client: this.client});
        //this.registerCommands();
        this.registerCallbacks();
        cmd.init(prefix);
    }

    /**
     * Starting the bot by connecting to the discord service and starting the webservice.
     * @returns {Promise<any>}
     */
    async start() {
        await this.client.login(authToken);
        logger.debug("Logged in");

        if (this.webServer) {
            this.webServer.start();
            logger.info(`WebServer runing on port ${this.webServer.port}`);
        }
    }

    /**
     * Initializes the database by checking first for the existence of the data folder.
     * @returns {Promise<void>}
     */
    async initializeDatabase() {
        logger.debug('Checking for ./data/ existence');
        await fs.ensureDir('./data');
        logger.verbose('Connecting to main database');
        this.maindb = new sqliteAsync.Database('./data/main.db');
        await this.maindb.init();

        await this.maindb.run(`${utils.sql.tableExistCreate} presences (
            ${utils.sql.pkIdSerial},
            text VARCHAR(255) UNIQUE NOT NULL
        )`);
        logger.debug('Loading Presences...');
        await this.loadPresences();
    }

    /**
     * initializes the api webserver
     */
    async initializeWebserver() {
        logger.verbose('Importing weblib');
        weblib = require('./lib/weblib');
        weblib.setLogger(logger);
        logger.verbose('Creating WebServer');
        this.webServer = new weblib.WebServer(config.webservice.port || 8080);
        logger.debug('Setting Reference Objects to webserver');

        await this.webServer.setReferenceObjects({
            client: this.client,
            presences: this.presences,
            maindb: this.maindb,
            prefix: prefix,
            getGuildHandler: (guild) => this.getGuildHandler(guild, prefix),
            guildHandlers: this.guildHandlers
        });
    }

    /**
     * If a data/presences.txt exists, it is read and each line is put into the presences array.
     * Each line is also stored in the main.db database. After the file is completely read, it get's deleted.
     * Then the data is read from the database and if the presence doesn't exist in the presences array, it get's
     * pushed in there. If the presences.txt file does not exist, the data is just read from the database. In the end
     * a rotator is created that rotates the presence every configured duration.
     */
    async loadPresences() {
        if (await fs.pathExists('./data/presences.txt')) {
            let lineReader = require('readline').createInterface({
                input: require('fs').createReadStream('./data/presences.txt')
            });
            lineReader.on('line', (line) => {
                this.maindb.run('INSERT INTO presences (text) VALUES (?)', [line], (err) => {
                    if (err)
                        logger.warn(err.message);

                });
                this.presences.push(line);
            });
            this.rotator = this.client.setInterval(() => this.rotatePresence(),
                config.presence_duration || 360000);
            await fs.unlink('./data/presences.txt');
            let rows = await this.maindb.all('SELECT text FROM presences');
            for (let row of rows)
                if (!(row[0] in this.presences))
                    this.presences.push(row.text);
        } else {
            let rows = await this.maindb.all('SELECT text FROM presences');
            for (let row of rows)
                this.presences.push(row.text);
            this.rotator = this.client.setInterval(() => this.rotatePresence(),
                config.presence_duration || 360000);
        }
    }

    /**
     * registeres global commands
     */
    registerCommands() {
        cmd.registerUtilityCommands(prefix, this);
        cmd.registerInfoCommands(prefix, this);
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
        }).then(() => logger.debug(`Presence rotation to ${pr}`))
            .catch((err) => logger.warn(err.message));
    }


    /**
     * Registeres callbacks for client events message and ready
     */
    registerCallbacks() {
        this.client.on('error', (err) => {
            logger.error(err.message);
            logger.debug(err.stack);
        });

        this.client.on('ready', () => {
            logger.info(`logged in as ${this.client.user.tag}!`);

            this.client.user.setPresence({
                game: {
                    name: gamepresence, type: "PLAYING"
                }, status: 'online'
            }).catch((err) => {
                if (err)
                    logger.warn(err.message);
            });
        });

        /*
        this.client.on('message', async (msg) => {
            try {
                if (msg.author === this.client.user) {
                    logger.verbose(`ME: ${msg.content}`);
                    return;
                }
                if (this.checkRate(msg.author.tag)) {
                    logger.verbose(`<${msg.author.tag}>: ${msg.content}`);
                    if (!msg.guild) {
                        let reply = cmd.parseMessage(msg);
                        await this.answerMessage(msg, reply);
                    } else {
                        let gh = await this.getGuildHandler(msg.guild, prefix);
                        await gh.handleMessage(msg);
                    }
                    if (((Date.now() - this.userRates[msg.author.tag].last)/1000) > (config.rateLimitTime || 10))
                        this.userRates[msg.author.tag].count = 0;
                    else
                        this.userRates[msg.author.tag].count++;
                    this.userRates[msg.author.tag].last = Date.now();
                    this.userRates[msg.author.tag].reached = false;
                } else if (!this.userRates[msg.author.tag].reached) {
                    logger.verbose(`${msg.author.tag} reached it's rate limit.`);
                    this.userRates[msg.author.tag].reached = true;
                }
            } catch (err) {
                logger.error(err.message);
                logger.debug(err.stack);
            }
        });*/

        this.client.on('voiceStateUpdate', async (oldMember, newMember) => {
            let gh = await this.getGuildHandler(newMember.guild, prefix);

            if (newMember.user === this.client.user) {
                if (newMember.voiceChannel)
                    gh.dj.updateChannel(newMember.voiceChannel);
            } else {
                if (oldMember.voiceChannel === gh.dj.voiceChannel || newMember.voiceChannel === gh.dj.voiceChannel)
                    gh.dj.checkListeners();
            }
        });
    }

    /**
     * Returns true if the user has not reached it's rate limit.
     * @param usertag
     * @returns {boolean}
     */
    checkRate(usertag) {
        if (!this.userRates[usertag])
            this.userRates[usertag] = {last: Date.now(), count: 0};
        return ((Date.now() - this.userRates[usertag].last)/1000) > (config.rateLimitTime || 10) ||
            this.userRates[usertag].count < (config.rateLimitCount || 5);
    }

    /**
     * Sends the answer recieved from the commands callback.
     * Handles the sending differently depending on the type of the callback return
     * @param msg
     * @param answer
     */
    async answerMessage(msg, answer) {
        if (answer instanceof Discord.RichEmbed) {
            (this.mention) ? msg.reply('', answer) : msg.channel.send('', answer);
        } else if (answer instanceof Promise) {
            let resolvedAnswer = await  answer;
            await this.answerMessage(msg, resolvedAnswer);
        } else if (answer instanceof Array) {
            await waterfall(answer.map((x) => async () => await this.answerMessage(msg, x))); // execute each after another
        } else if ({}.toString.call(answer) === '[object Function]') {
            await this.answerMessage(msg, answer());
        } else if (answer) {
            (this.mention) ? msg.reply(answer) : msg.channel.send(answer);
        }
    }

    /**
     * Returns the guild handler by id, creates one if it doesn't exist and returns it then
     * @param guild
     * @param prefix
     * @returns {*}
     */
    async getGuildHandler(guild, prefix) {
        if (!this.guildHandlers[guild.id]) {
            let newGuildHandler = new guilding.GuildHandler(guild, prefix);
            await newGuildHandler.initDatabase();
            this.guildHandlers[guild.id] = newGuildHandler;
        }
        return this.guildHandlers[guild.id];
    }
}


// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    logger.info("Starting up... ");  // log the current date so that the logfile is better to read.
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
