const cmd = require('./cmd'),
    music = require('./music'),
    handlers = {};
let logger = require('winston');

exports.setLogger = function(newLogger) {
    logger = newLogger;
};

exports.GuildHandler = class{
    constructor(guild, prefix) {
        this.guild = guild;
        this.dj = null;
        this.servant = null;
        this.mention = false;
        this.prefix = prefix || '~';
        this.data = {
            savedplaylists: {}
        };
        this.registerMusicCommands();
    }

    registerMusicCommands(cmdPrefix) {
        let prefix = cmdPrefix || this.prefix;
        this.dj = new music.DJ();

        // play command
        this.createCommand(prefix + 'play', (msg, argv) => {
            let vc = msg.member.voiceChannel;
            let url = argv['url'];
            if (!vc)
                return 'You are not connected to a VoiceChannel';
            if (!url)
                return 'No url given.';
            if (!url.match(/http/g)) {
                if (this.data.savedplaylists[url]) {
                    url = this.data.savedplaylists[url];
                } else {
                    return 'Not a valid url.';
                }
            }
            try {
                if (!this.dj.connected) {
                    this.dj.connect(vc).then(() => {
                        this.dj.playYouTube(url);
                    });
                }else {
                    return this.dj.playYouTube(url);
                }
            } catch(err) {
                logger.error(err);
                return `${JSON.stringify(err)}`;
            }
        }, ['url'], "Adds the url to the YouTube video/playlist into the queue.");

        // playnext command
        this.createCommand(prefix + 'playnext', (msg, argv) => {
            let vc = msg.member.voiceChannel;
            if (!this.dj.connected) this.dj.voiceChannel = vc;
            let url = argv['url'];
            if (!url) return 'No url given.';
            if (!url.match(/http/g)) {
                if (this.data.savedplaylists[url]) {
                    url = this.data.savedplaylists[url];
                } else {
                    return 'Not a valid url';
                }
            }
            try {
                return this.dj.playYouTube(url, true);
            } catch(err) {
                logger.error(err);
                return `${JSON.stringify(err)}`;
            }
        }, ['url'], "Adds the url to the YouTube video as next song to the queue.");

        // join command
        this.createCommand(prefix + 'join', (msg) => {
            if (msg.member.voiceChannel) {
                this.dj.connect(msg.member.voiceChannel);
            }
            else {
                msg.reply("You are not connected to a voicechannel.");
            }
        }, [], "Joins the VC you are in.");

        // stop command
        this.createCommand(prefix + 'stop', () => {
            this.dj.stop();
            return "Stopping now";
        }, [], "Stops playing music and leaves.");

        // pause command
        this.createCommand(prefix + 'pause', () => {
            this.dj.pause();
            return "Pausing playing";
        }, [], "Pauses playing.");

        // resume command
        this.createCommand(prefix + 'resume', () => {
            this.dj.resume();
            return "Resuming playing";
        }, [], "Resumes playing.");

        // skip command
        this.createCommand(prefix + 'skip', () => {
            this.dj.skip();
            return "Skipping Song";
        }, [], "Skips the current song.");

        // clear command
        this.createCommand(prefix + 'clear', () => {
            this.dj.clear();
            return "DJ-Queue cleared";
        }, [],"Clears the playlist.");

        // playlist command
        this.createCommand(prefix + 'playlist', () => {
            let songs = this.dj.playlist;
            logger.debug(`found ${songs.length} songs`);
            let songlist = `**${songs.length} Songs in playlist**\n`;
            for (let i = 0; i < songs.length; i++) {
                if (i > 10) break;
                songlist += songs[i] + '\n';
            }
            return songlist;
        }, [], "Shows the next ten songs.");

        // np command
        this.createCommand(prefix + 'np', () => {
            let song = this.dj.song;
            return `Playing: ${song.title}\n ${song.url}`;
        }, [], "Shows the currently playing song.");

        // shuffle command
        this.createCommand(prefix + 'shuffle', () => {
            this.dj.shuffle();
            return "Randomized the order of the queue."
        }, [], "Shuffles the playlist.");
    }

    createCommand(command, call, args, description) {
        if (!this.servant) this.servant = new cmd.Servant(this.prefix);
        this.servant.createCommand(command, call, args, description);
    }

    handleMessage(msg) {
        if (!this.servant) this.servant = new cmd.Servant(this.prefix);
        let answer = this.servant.parseCommand(msg);
        if (!answer) return;
        if (this.mention) {
            msg.reply(answer);
        } else {
            msg.channel.send(answer);
        }
    }
};

exports.getHandler = function(guild, prefix) {
    if (!handlers[guild.id]) handlers[guild.id] = new this.GuildHandler(guild, prefix);
    return handlers[guild.id];
};