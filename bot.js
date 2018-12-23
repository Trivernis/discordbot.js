const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    authToken = args.token,
    prefix = args.prefix || '~',
    gamepresence = args.game || 'NieR:Automata';

function main() {
    cmd.setLogger(logger);
    guilding.setLogger(logger);
    cmd.init(prefix);
    registerCommands();
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
        logger.verbose(`<${msg.author.username}>: ${msg.content}`);
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