const Discord = require("discord.js"),
    logger = require('./lib/logging').getLogger(),
    music = require('./lib/music');
    cmd = require("./lib/cmd"),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    authToken = args.token,
    prefix = '~';

function main() {
    music.setLogger(logger);
    cmd.setLogger(logger);
    cmd.init();
    registerCommands();
    client.login(authToken).then(()=> {
        logger.debug("Logged in");
    });
}

function registerCommands() {
    cmd.createCommand('~', 'play', (msg, argv) => {
        let gid = msg.guild.id;
        let url = argv['url'];
        if (!url) return 'No url given.';
        try {
            return music.play(gid, url);
        } catch(err) {
            logger.error(err);
            msg.reply(`${JSON.stringify(err)}`);
        }
    }, ['url']);

    cmd.createCommand('~', 'ping', () => {
       return 'Pong!';
    });

    cmd.createCommand('~', 'join', (msg) => {
        if (msg.member.voiceChannel) {
            music.connect(msg.member.voiceChannel);
        }
        else {
            msg.reply("You are not connected to a voicechannel.");
        }
    });

    cmd.createCommand('~', 'stop', (msg) => {
        let gid = msg.guild.id;
        music.stop(gid);
    });

    cmd.createCommand('~', 'pause', (msg) => {
        let gid = msg.guild.id;
        music.pause(gid);
    });

    cmd.createCommand('~', 'resume', (msg) => {
        let gid = msg.guild.id;
        music.resume(gid);
    });

    cmd.createCommand('~', 'skip', (msg) => {
        let gid = msg.guild.id;
        music.skip(gid);
    });

    cmd.createCommand('~', 'plist', (msg) => {
        let gid = msg.guild.id;
        let songs = music.getQueue(gid);
        let songlist = "**Songs**\n";
        for (let i = 0; i < songs.length; i++) {
            if (i > 10) break;
            songlist += songs[i] + '\n';
        }
        return songlist;
    });

    cmd.createCommand('~', 'shuffle', (msg) => {
        let gid = msg.guild.id;
        music.shuffle(gid);
    });

    cmd.createCommand('~', 'current', (msg) => {
        let gid = msg.guild.id;
        let song = music.nowPlaying(gid);
        return `Playing: ${song.title}\n ${song.url}`;
    });

    cmd.createCommand('_', 'repeat', (msg, argv) => {
        return argv['repeattext'];
    }, ['repeattext']);
}

// defining the client's handlers

client.on('ready', () => {
    logger.info(`logged in as ${client.user.tag}!`);
    client.user.setPresence({game: {name: "Trivernis' bot testing", type: "PLAYING"}, status: 'online'});
});

client.on('message', msg => {
    try {
        if (msg.author === client.user) {
            logger.verbose(`ME: ${msg.content}`);
            return;
        }
        logger.verbose(`<${msg.author.username}>: ${msg.content}`);
        let reply = cmd.parseMessage(msg);
        if (reply) {
            msg.reply(reply);
            return;
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