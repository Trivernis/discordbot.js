const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    utils = require('./lib/utils'),
    config = require('./config.json'),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    sqlite3 = require('sqlite3'),
    authToken = args.token || config.api.botToken,
    prefix = args.prefix || config.prefix || '~',
    gamepresence = args.game || config.presence;

let presences = [],     // loaded from presences.txt file if the file exists
    rotator = null,     // an interval id to stop presence duration if needed
    maindb = null;

function main() {
    logger.verbose('Registering cleanup function');

    utils.Cleanup(() => {
        guilding.destroyAll();
        client.destroy();
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
    registerCommands();

    logger.debug('Checking for ./data/ existence')
    utils.dirExistence('./data', () => {
        logger.verbose('Connecting to main database');
        maindb = new sqlite3.Database('./data/main.db', (err) => {
            if (err) {
                logger.error(err.message);
            } else {
                maindb.run(`${utils.sql.tableExistCreate} presences (
                    ${utils.sql.pkIdSerial},
                    text VARCHAR(255) UNIQUE NOT NULL
                )`, (err) => {
                    if (err) {
                        logger.error(err.message);
                    } else {
                        logger.debug('Loading presences');
                        loadPresences();
                    }
                });
            }
        });
    });
    registerCallbacks();

    client.login(authToken).then(() => {
        logger.debug("Logged in");
    });
}

/**
 * If a data/presences.txt exists, it is read and each line is put into the presences array.
 * Each line is also stored in the main.db database. After the file is completely read, it get's deleted.
 * Then the data is read from the database and if the presence doesn't exist in the presences array, it get's
 * pushed in there. If the presences.txt file does not exist, the data is just read from the database. In the end
 * a rotator is created that rotates the presence every configured duration.
 */
function loadPresences() {
    if(fs.existsSync('./data/presences.txt')) {
        let lineReader = require('readline').createInterface({
            input: require('fs').createReadStream('./data/presences.txt')
        });
        lineReader.on('line', (line) => {
            maindb.run('INSERT INTO presences (text) VALUES (?)', [line], (err) => {
                if(err) {
                    logger.warn(err.message);
                }
            });
            presences.push(line);
        });
        rotator = client.setInterval(() => rotatePresence(), config.presence_duration || 360000);
        fs.unlink('./data/presences.txt', (err) => {
            if (err)
                logger.warn(err.message);
        });
        maindb.all('SELECT text FROM presences', (err, rows) => {
            if (err) {
                logger.warn(err.message);
            } else {
                for(let row of rows) {
                    if (!row[0] in presences)
                        presences.push(row.text);
                }
            }
        })
    } else {
        maindb.all('SELECT text FROM presences', (err, rows) => {
            if (err) {
                logger.warn(err.message);
            } else {
                for(let row of rows) {
                    presences.push(row.text);
                }
            }
            rotator = client.setInterval(() => rotatePresence(), config.presence_duration || 360000);
        })
    }
}

/**
 * registeres global commands
 */
function registerCommands() {
    // useless test command
    cmd.createGlobalCommand(prefix + 'repeatafterme', (msg, argv, args) => {
        return args.join(' ');
    }, [], "Repeats what you say");

    // adds a presence that will be saved in the presence file and added to the rotation
    cmd.createGlobalCommand(prefix + 'addpresence', (msg, argv, args) => {
        let p = args.join(' ');
        presences.push(p);

        maindb.run('INSERT INTO presences (text) VALUES (?)', [p], (err) => {
            if (err)
                logger.warn(err.message);
        });
        return `Added Presence \`${p}\``;
    }, [], "Adds a presence to the rotation.", 'owner');

    // shuts down the bot after destroying the client
    cmd.createGlobalCommand(prefix + 'shutdown', (msg) => {

        msg.reply('Shutting down...').finally(() => {
            logger.debug('Destroying client...');

            client.destroy().finally(() => {
                logger.debug(`Exiting Process...`);
                process.exit(0);
            });
        });
    }, [], "Shuts the bot down.", 'owner');

    // forces a presence rotation
    cmd.createGlobalCommand(prefix + 'rotate', () => {
        try {
            client.clearInterval(rotator);
            rotatePresence();
            rotator = client.setInterval(() => rotatePresence(), config.presence_duration);
        } catch (error) {
            logger.warn(JSON.stringify(error));
        }
    }, [], 'Force presence rotation', 'owner');

    // ping command that returns the ping attribute of the client
    cmd.createGlobalCommand(prefix + 'ping', () => {
        return `Current average ping: \`${client.ping} ms\``;
    }, [], 'Returns the current average ping', 'owner');

    // returns the time the bot is running
    cmd.createGlobalCommand(prefix + 'uptime', () => {
        return `Uptime: \`${client.uptime / 1000} s\``
    }, [], 'Returns the uptime of the bot', 'owner');

    // returns the numbe of guilds, the bot has joined
    cmd.createGlobalCommand(prefix + 'guilds', () => {
        return `Number of guilds: \`${client.guilds.size}\``
    }, [], 'Returns the number of guilds the bot has joined', 'owner');
}

function rotatePresence() {
    let pr = presences.shift();
    presences.push(pr);
    client.user.setPresence({game: {name: `${gamepresence} | ${pr}`, type: "PLAYING"}, status: 'online'});
    logger.debug(`Presence rotation to ${pr}`);
}

/**
 * Sends the answer recieved from the commands callback.
 * Handles the sending differently depending on the type of the callback return
 * @param msg
 * @param answer
 */
function answerMessage(msg, answer) {
    if (answer instanceof Promise || answer) {
        if (answer instanceof Discord.RichEmbed) {
            (this.mention)? msg.reply('', answer) : msg.channel.send('', answer);
        } else if (answer instanceof Promise) {
            answer
                .then((answer) => answerMessage(msg, answer))
                .catch((error) => answerMessage(msg, error));
        } else {
            (this.mention)? msg.reply(answer) : msg.channel.send(answer);
        }
    } else {
        logger.warn(`Empty answer won't be send.`);
    }
}

/**
 * Registeres callbacks for client events
 */
function registerCallbacks() {
    client.on('error', (err) => {
        logger.error(err.message);
    });

    client.on('ready', () => {
        logger.info(`logged in as ${client.user.tag}!`);
        client.user.setPresence({game: {name: gamepresence, type: "PLAYING"}, status: 'online'});
    });

    client.on('message', msg => {
        try {
            if (msg.author === client.user) {
                logger.verbose(`ME: ${msg.content}`);
                return;
            }
            logger.verbose(`<${msg.author.tag}>: ${msg.content}`);
            if (!msg.guild) {
                let reply = cmd.parseMessage(msg);
                answerMessage(msg, reply);
            } else {
                guilding.getHandler(msg.guild, prefix).handleMessage(msg);
            }
        } catch (err) {
            logger.error(err.stack);
        }
    });
}

// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    logger.info("Starting up... ");  // log the current date so that the logfile is better to read.
    main();
}