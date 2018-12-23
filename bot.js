const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    utils = require('./lib/utils'),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    authToken = args.token,
    prefix = args.prefix || '~',
    gamepresence = args.game || prefix + 'help';

let presences = [],
    rotator = null;

function main() {
    utils.Cleanup(() => {
        client.destroy();
    });
    cmd.setLogger(logger);
    guilding.setLogger(logger);
    cmd.init(prefix);
    registerCommands();
    utils.dirExistence('./data', () => {
        fs.exists('./data/presences.txt', (exist) => {
            if (exist) {
                logger.debug('Loading presences from file...');
                let lineReader = require('readline').createInterface({
                    input: require('fs').createReadStream('./data/presences.txt')
                });
                lineReader.on('line', (line) => {
                    presences.push(line);
                });
                rotator = setInterval(() => rotatePresence(), 60000);
            }
        })
    });
    client.login(authToken).then(()=> {
        logger.debug("Logged in");
    });


}

function registerCommands() {
    cmd.createGlobalCommand(prefix + 'ping', () => {
       return 'Pong!';
    }, [], "Try it yourself.");

    cmd.createGlobalCommand(prefix + 'repeatafterme', (msg, argv, args) => {
        return args.join(' ');
    },[], "Repeats what you say");

    cmd.createGlobalCommand(prefix + 'addpresence', (msg, argv, args) => {
        let p = args.join(' ');
        presences.push(p);
        fs.writeFile('./data/presences.txt', presences.join('\n'), (err) => {});
        return `Added Presence \`${p}\``;
    },[], "Adds a presence to the rotation.", 'owner');

    cmd.createGlobalCommand(prefix + 'shutdown', (msg) => {
        msg.reply('Shutting down...').finally(() => {
            logger.debug('Destroying client...');
            client.destroy().finally(() => {
                logger.debug(`Exiting Process...`);
                process.exit(0);
            });
        });
    },[], "Shuts the bot down.", 'owner');

    cmd.createGlobalCommand(prefix + 'rotate', () => {
        try {
            clearInterval(rotator);
            rotatePresence();
            rotator = setInterval(() => rotatePresence(), 60000);
        } catch (error) {
            logger.warn(JSON.stringify(error));
        }
    }, [], 'Force presence rotation', 'owner');
}

function rotatePresence() {
    let pr = presences.shift();
    presences.push(pr);
    client.user.setPresence({game: {name: `${gamepresence} | ${pr}`, type: "PLAYING"}, status: 'online'});
    logger.debug(`Presence rotation to ${pr}`);
}

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
            if (reply) msg.channel.send(reply);
        } else {
            guilding.getHandler(msg.guild, prefix).handleMessage(msg);
        }
    } catch (err) {
        logger.error(err.stack);
    }
});

// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    logger.info("Starting up... ");  // log the current date so that the logfile is better to read.
    main();
}