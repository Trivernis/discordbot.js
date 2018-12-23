const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    music = require('./lib/music'),
    cmd = require("./lib/cmd"),
    guilding = require('./lib/guilding'),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    authToken = args.token,
    prefix = args.prefix || '~',
    gamepresence = args.game || 'NieR:Automata';

let savedplaylists = {};

function main() {
    music.setLogger(logger);
    cmd.setLogger(logger);
    cmd.init(prefix);
    if (fs.existsSync('./data/savedplaylists.json')) {
        savedplaylists = JSON.parse(fs.readFileSync('./data/savedplaylists.json'))
    }
    registerCommands();
    client.login(authToken).then(()=> {
        logger.debug("Logged in");
    });
}

function savePlaylist(url, name) {
    savedplaylists[name] = url;
    fs.writeFile('./data/savedplaylists.json',JSON.stringify(savedplaylists), (err) => {
        if (err) logger.warn(JSON.stringify(err));
    })
}

function registerCommands() {
    cmd.createGlobalCommand(prefix + 'ping', () => {
       return 'Pong!';
    }, [], "Try it yourself.");

    cmd.createGlobalCommand(prefix + 'repeatafterme', (msg, argv, args) => {
        return args.join(' ');
    },[], "Repeats what you say");

    cmd.createGlobalCommand(prefix + 'save', (msg, argv) => {
        savePlaylist(argv['url'], argv['name']);
        return `Saved song/playlist as ${argv['name']}`
    }, ['url', 'name'], "Saves the YouTube song/playlist with a specific name");
}

// defining the client's handlers

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