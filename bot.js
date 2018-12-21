const Discord = require("discord.js"),
    fs = require('fs'),
    logger = require('./lib/logging').getLogger(),
    music = require('./lib/music'),
    cmd = require("./lib/cmd"),
    client = new Discord.Client(),
    args = require('args-parser')(process.argv),
    authToken = args.token;

let savedplaylists = {};

function main() {
    music.setLogger(logger);
    cmd.setLogger(logger);
    cmd.init();
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
    cmd.createCommand('~', 'play', (msg, argv) => {
        let vc = msg.member.voiceChannel;
        let url = argv['url'];
        if (!url) return 'No url given.';
        if (!url.match(/http/g)) {
            if (savedplaylists[url]) {
                url = savedplaylists[url];
            }
        }
        try {
            return music.play(vc, url);
        } catch(err) {
            logger.error(err);
            msg.reply(`${JSON.stringify(err)}`);
        }
    }, ['url'], "Adds the url to the YouTube video/playlist into the queue.");

    cmd.createCommand('~', 'playnext', (msg, argv) => {
        let vc = msg.member.voiceChannel;
        let url = argv['url'];
        if (!url) return 'No url given.';
        if (!url.match(/http/g)) {
            if (savedplaylists[url]) {
                url = savedplaylists[url];
            }
        }
        try {
            return music.playnext(vc, url);
        } catch(err) {
            logger.error(err);
            msg.reply(`${JSON.stringify(err)}`);
        }
    }, ['url'], "Plays the YouTube video after the currently playing song.");

    cmd.createCommand('~', 'ping', () => {
       return 'Pong!';
    }, [], "Try it yourself.");

    cmd.createCommand('~', 'join', (msg) => {
        if (msg.member.voiceChannel) {
            music.connect(msg.member.voiceChannel);
        }
        else {
            msg.reply("You are not connected to a voicechannel.");
        }
    }, [], "Joins the VC you are in.");

    cmd.createCommand('~', 'stop', (msg) => {
        let gid = msg.guild.id;
        music.stop(gid);
    }, [], "Stops playling music and leavs.");

    cmd.createCommand('~', 'pause', (msg) => {
        let gid = msg.guild.id;
        music.pause(gid);
    }, [], "Pauses playing.");

    cmd.createCommand('~', 'resume', (msg) => {
        let gid = msg.guild.id;
        music.resume(gid);
    }, [], "Resumes playing.");

    cmd.createCommand('~', 'skip', (msg) => {
        let gid = msg.guild.id;
        music.skip(gid);
    }, [], "Skips the current song.");

    cmd.createCommand('~', 'clear', (msg) => {
        let gid = msg.guild.id;
        music.clearQueue(gid);
        return "All songs have been deleted, commander :no_mouth:  "
    }, [],"Clears the playlist.");

    cmd.createCommand('~', 'playlist', (msg) => {
        let gid = msg.guild.id;
        let songs = music.getQueue(gid);
        logger.debug(`found ${songs.length} songs`);
        let songlist = `**${songs.length} Songs in playlist**\n`;
        for (let i = 0; i < songs.length; i++) {
            if (i > 10) break;
            songlist += songs[i] + '\n';
        }
        return songlist;
    }, [], "Shows the next ten songs.");

    cmd.createCommand('~', 'shuffle', (msg) => {
        let gid = msg.guild.id;
        music.shuffle(gid);
        return "The queue has successfully been shuffled :slight_smile:"
    }, [], "Shuffles the playlist.");

    cmd.createCommand('~', 'current', (msg) => {
        let gid = msg.guild.id;
        let song = music.nowPlaying(gid);
        return `Playing: ${song.title}\n ${song.url}`;
    }, [], "Shows the currently playing song.");

    cmd.createCommand('~', 'repeatafterme', (msg, argv) => {
        return argv['word'];
    }, ['word'], "Repeats a single word you say.");

    cmd.createCommand('~', 'save', (msg, argv) => {
        savePlaylist(argv['url'], argv['name']);
        return `Saved song/playlist as ${argv['name']}`
    }, ['url', 'name'], "Saves the YouTube song/playlist with a specific name. ~play [name] to play the playlist");
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