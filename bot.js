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
    music.setClient(client);
    client.login(authToken).then(()=> {
        logger.debug("Logged in");
    });
}

function registerCommands() {
    cmd.createCommand('~', 'play', (msg, argv) => {
        let vc = msg.member.voiceChannel;
        let url = argv['url'];
        if (!url) return 'No url given.';
        try {
            return music.play(vc, url);
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
        let vc = msg.member.voiceChannel;
        music.stop(vc);
    });

    cmd.createCommand('~', 'pause', (msg) => {
        let vc = msg.member.voiceChannel;
        music.pause(vc);
    });

    cmd.createCommand('~', 'resume', (msg) => {
        let vc = msg.member.voiceChannel;
        music.resume(vc);
    });

    cmd.createCommand('~', 'skip', (msg) => {
        let vc = msg.member.voiceChannel;
        music.skip(vc);
    });

    cmd.createCommand('~', 'plist', (msg) => {
        let vc = msg.member.voiceChannel;
        music.getQueue(vc, (songs) => {
            let songlist = "**Songs**\n";
            for (let i = 0; i < songs.length; i++) {
                if (i > 10) break;
                songlist += songs[i] + '\n';
            }
            msg.reply(songlist);
        });
    });

    cmd.createCommand('~', 'shuffle', (msg) => {
        let vc = msg.member.voiceChannel;
        music.shuffle(vc);
    });

    cmd.createCommand('~', 'current', (msg) => {
        let vc = msg.member.voiceChannel;
        music.nowPlaying(vc, (title, url) => {
            msg.reply(`Playing: ${title}\n ${url}`);
        });
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