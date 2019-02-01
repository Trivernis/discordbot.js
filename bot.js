const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    utils = require('./lib/utils'),
    config = require('./config.json'),
    args = require('args-parser')(process.argv),
    sqlite3 = require('sqlite3'),
    authToken = args.token || config.api.botToken,
    prefix = args.prefix || config.prefix || '~',
    gamepresence = args.game || config.presence;

let webapi = null;

class Bot {
    constructor() {
        this.client = new Discord.Client();
        this.mention = false;
        this.rotator = null;
        this.maindb = null;
        this.presences = [];
        this.guildHandlers = [];

        logger.verbose('Registering cleanup function');
        utils.Cleanup(() => {
            for (let gh in Object.values(this.guildHandlers)) {
                if (gh)
                    gh.destroy();
            }
            this.client.destroy().then(() => {
                logger.debug('destroyed client');
            });
        });
        cmd.setLogger(logger);
        logger.verbose('Verifying config');

        let configVerifyer = new utils.ConfigVerifyer(config, [
            "api.botToken", "api.youTubeApiKey"
        ]);
        if (!configVerifyer.verifyConfig(logger)) {
            if (!args.i) {
                logger.info('Invalid config. Exiting');
                process.exit(1);
            }
        }
        guilding.setLogger(logger);
        cmd.init(prefix);
        logger.verbose('Registering commands');
        this.registerCommands();
        logger.debug('Checking for ./data/ existence');

        utils.dirExistence('./data', () => {
            logger.verbose('Connecting to main database');
            this.maindb = new sqlite3.Database('./data/main.db', (err) => {
                if (err) {
                    logger.error(err.message);
                } else {
                    this.maindb.run(`${utils.sql.tableExistCreate} presences (
                    ${utils.sql.pkIdSerial},
                    text VARCHAR(255) UNIQUE NOT NULL
                    )`, (err) => {
                        if (err) {
                            logger.error(err.message);
                        } else {
                            logger.debug('Loading presences');
                            this.loadPresences();
                        }
                    });
                }
            });
        });
        this.registerCallbacks();

        if (config.webservice && config.webservice.enabled) {
            logger.verbose('Importing webapi');
            webapi = require('./lib/webapi');
            webapi.setLogger(logger);
            logger.verbose('Creating WebServer');
            this.webServer = new webapi.WebServer(config.webservice.port || 8080);
            logger.debug('Setting Reference Objects to webserver');

            this.webServer.setReferenceObjects({
                client: this.client,
                presences: this.presences,
                maind: this.maindb,
                prefix: prefix,
                getGuildHandler: (guild) => this.getGuildHandler(guild, prefix)
            });
        }
    }

    /**
     * Starting the bot by connecting to the discord service and starting the webservice.
     * @returns {Promise<any>}
     */
    start() {
        return new Promise((resolve, reject) => {
            this.client.login(authToken).then(() => {
                logger.debug("Logged in");
                resolve();
            }).catch((err) => {
                reject(err);
            });
            if (this.webServer) {
                this.webServer.start();
                logger.info(`WebServer runing on port ${this.webServer.port}`);
            }
        })
    }

    /**
     * If a data/presences.txt exists, it is read and each line is put into the presences array.
     * Each line is also stored in the main.db database. After the file is completely read, it get's deleted.
     * Then the data is read from the database and if the presence doesn't exist in the presences array, it get's
     * pushed in there. If the presences.txt file does not exist, the data is just read from the database. In the end
     * a rotator is created that rotates the presence every configured duration.
     */
    loadPresences() {
        if (fs.existsSync('./data/presences.txt')) {
            let lineReader = require('readline').createInterface({
                input: require('fs').createReadStream('./data/presences.txt')
            });
            lineReader.on('line', (line) => {
                this.maindb.run('INSERT INTO presences (text) VALUES (?)', [line], (err) => {
                    if (err) {
                        logger.warn(err.message);
                    }
                });
                this.presences.push(line);
            });
            this.rotator = this.client.setInterval(() => this.rotatePresence(),
                config.presence_duration || 360000);
            fs.unlink('./data/presences.txt', (err) => {
                if (err)
                    logger.warn(err.message);
            });
            this.maindb.all('SELECT text FROM presences', (err, rows) => {
                if (err) {
                    logger.warn(err.message);
                } else {
                    for (let row of rows) {
                        if (!(row[0] in this.presences))
                            this.presences.push(row.text);
                    }
                }
            })
        } else {
            this.maindb.all('SELECT text FROM presences', (err, rows) => {
                if (err) {
                    logger.warn(err.message);
                } else {
                    for (let row of rows) {
                        this.presences.push(row.text);
                    }
                }
                this.rotator = this.client.setInterval(() => this.rotatePresence(),
                    config.presence_duration || 360000);
            })
        }
    }

    /**
     * registeres global commands
     */
    registerCommands() {
        // useless test command
        cmd.createGlobalCommand(prefix + 'repeatafterme', (msg, argv, args) => {
            return args.join(' ');
        }, [], "Repeats what you say");

        // adds a presence that will be saved in the presence file and added to the rotation
        cmd.createGlobalCommand(prefix + 'addpresence', (msg, argv, args) => {
            let p = args.join(' ');
            this.presences.push(p);

            this.maindb.run('INSERT INTO presences (text) VALUES (?)', [p], (err) => {
                if (err)
                    logger.warn(err.message);
            });
            return `Added Presence \`${p}\``;
        }, [], "Adds a presence to the rotation.", 'owner');

        // shuts down the bot after destroying the client
        cmd.createGlobalCommand(prefix + 'shutdown', (msg) => {

            msg.reply('Shutting down...').finally(() => {
                logger.debug('Destroying client...');

                this.client.destroy().finally(() => {
                    logger.debug(`Exiting Process...`);
                    process.exit(0);
                });
            });
        }, [], "Shuts the bot down.", 'owner');

        // forces a presence rotation
        cmd.createGlobalCommand(prefix + 'rotate', () => {
            try {
                this.client.clearInterval(this.rotator);
                this.rotatePresence();
                this.rotator = this.client.setInterval(() => this.rotatePresence(), config.presence_duration);
            } catch (error) {
                logger.warn(JSON.stringify(error));
            }
        }, [], 'Force presence rotation', 'owner');

        // ping command that returns the ping attribute of the client
        cmd.createGlobalCommand(prefix + 'ping', () => {
            return `Current average ping: \`${this.client.ping} ms\``;
        }, [], 'Returns the current average ping', 'owner');

        // returns the time the bot is running
        cmd.createGlobalCommand(prefix + 'uptime', () => {
            let uptime = utils.getSplitDuration(this.client.uptime);
            return new Discord.RichEmbed().setDescription(`
            **${uptime.days}** days
            **${uptime.hours}** hours
            **${uptime.minutes}** minutes
            **${uptime.seconds}** seconds
            **${uptime.milliseconds}** milliseconds
        `).setTitle('Uptime');
        }, [], 'Returns the uptime of the bot', 'owner');

        // returns the numbe of guilds, the bot has joined
        cmd.createGlobalCommand(prefix + 'guilds', () => {
            return `Number of guilds: \`${this.client.guilds.size}\``
        }, [], 'Returns the number of guilds the bot has joined', 'owner');
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
        }).then(() => logger.debug(`Presence rotation to ${pr}`));
    }


    /**
     * Registeres callbacks for client events
     */
    registerCallbacks() {
        this.client.on('error', (err) => {
            logger.error(err.message);
        });

        this.client.on('ready', () => {
            logger.info(`logged in as ${this.client.user.tag}!`);
            this.client.user.setPresence({
                game: {
                    name: gamepresence, type: "PLAYING"
                }, status: 'online'
            })
                .catch((err) => {
                    if (err)
                        logger.warn(err.message);
                });
        });

        this.client.on('message', msg => {
            try {
                if (msg.author === this.client.user) {
                    logger.verbose(`ME: ${msg.content}`);
                    return;
                }
                logger.verbose(`<${msg.author.tag}>: ${msg.content}`);
                if (!msg.guild) {
                    let reply = cmd.parseMessage(msg);
                    this.answerMessage(msg, reply);
                } else {
                    this.getGuildHandler(msg.guild, prefix).handleMessage(msg);
                }
            } catch (err) {
                logger.error(err.stack);
            }
        });
    }

    /**
     * Sends the answer recieved from the commands callback.
     * Handles the sending differently depending on the type of the callback return
     * @param msg
     * @param answer
     */
    answerMessage(msg, answer) {
        if (answer instanceof Promise || answer) {
            if (answer instanceof Discord.RichEmbed) {
                (this.mention) ? msg.reply('', answer) : msg.channel.send('', answer);
            } else if (answer instanceof Promise) {
                answer
                    .then((answer) => answerMessage(msg, answer))
                    .catch((error) => answerMessage(msg, error));
            } else {
                (this.mention) ? msg.reply(answer) : msg.channel.send(answer);
            }
        } else {
            logger.warn(`Empty answer won't be send.`);
        }
    }

    /**
     * Returns the guild handler by id, creates one if it doesn't exist and returns it then
     * @param guild
     * @param prefix
     * @returns {*}
     */
    getGuildHandler(guild, prefix) {
        if (!this.guildHandlers[guild.id])
            this.guildHandlers[guild.id] = new guilding.GuildHandler(guild, prefix);
        return this.guildHandlers[guild.id];
    }
}


// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    logger.info("Starting up... ");  // log the current date so that the logfile is better to read.
    let discordBot = new Bot();
    discordBot.start().catch((err) => {
        logger.error(err.message);
    });
}