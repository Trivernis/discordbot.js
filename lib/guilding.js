const cmd = require('./cmd'),
    music = require('./music'),
    data = require('./data'),
    config = require('../config.json'),
    servercmd = require('../commands/servercommands'),
    handlers = {};
let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
    music.setLogger(logger);
};


exports.GuildHandler = class {
    constructor(guild, prefix) {
        this.guild = guild;
        this.dataHandler = new data.DataHandler(guild.name);
        this.dj = null;
        this.mention = false;
        this.prefix = prefix || config.prefix;
        this.servant = new cmd.Servant(this.prefix);
        this.registerMusicCommands();
    }

    /**
     * function shortcut returns the data from the dataHandler
     * @param name
     * @returns {{}}
     */
    getData(name) {
        return this.dataHandler.getData(name);
    }

    /**
     * appends data to the data handler
     * @param name
     * @param key
     * @param value
     */
    appendData(name, key, value) {
        let data = this.getData(name);
        data[key] = value;
        this.dataHandler.setData(name, data);
    }

    /**
     * deletes an entry from the data handler
     * @param name
     * @param key
     */
    deleteDataEntry(name, key) {
        let data = this.getData(name);
        delete data[key];
        this.dataHandler.setData(name, data);
    }

    /**
     * registers all music commands and initializes a dj
     * @param cmdPrefix
     */

    /**
     * handles the message by letting the servant parse the command. Depending on the message setting it
     * replies or just sends the answer.
     * @param msg
     */
    handleMessage(msg) {
        let answer = this.servant.parseCommand(msg);
        if (!answer) return;
        if (this.mention) {
            msg.reply(answer);
        } else {
            msg.channel.send(answer);
        }
    }

    registerMusicCommands(cmdPrefix) {
        let prefix = cmdPrefix || this.prefix;
        this.dj = new music.DJ();

        // play command
        this.servant.createCommand(servercmd.music.play, (msg, argv) => {
            let vc = msg.member.voiceChannel;
            let url = argv['url'];
            if (!vc)
                return 'You are not connected to a VoiceChannel';
            if (!url)
                return servercmd.music.play.response.no_url;
            if (!url.match(/http/g)) {
                if (this.getData('savedplaylists') && this.getData('savedplaylists')[url]) {
                    url = this.getData('savedplaylists')[url];
                } else {
                    return servercmd.music.play.response.url_invalid;
                }
            }
            try {
                if (!this.dj.connected) {
                    this.dj.connect(vc).then(() => {
                        this.dj.playYouTube(url);
                    });
                } else {
                    this.dj.playYouTube(url);
                }
            } catch (err) {
                logger.error(err);
                return servercmd.music.play.response.failure;
            }
            return servercmd.music.play.response.success;
        });

        // playnext command
        this.servant.createCommand(servercmd.music.playnext,(msg, argv) => {
            let vc = msg.member.voiceChannel;
            if (!this.dj.connected) this.dj.voiceChannel = vc;
            let url = argv['url'];
            if (!url) return servercmd.music.playnext.response.no_url;
            if (!url.match(/http/g)) {
                if (this.getData('savedplaylists') && this.getData('savedplaylists')[url]) {
                    url = this.getData('savedplaylists')[url];
                } else {
                    return servercmd.music.playnext.response.url_invalid;
                }
            }
            try {
                this.dj.playYouTube(url, true);
            } catch (err) {
                logger.error(err);
                return servercmd.music.playnext.response.failure;
            }
            return servercmd.music.playnext.response.success;
        });

        // join command
        this.servant.createCommand(servercmd.music.join, (msg) => {
            if (msg.member.voiceChannel) {
                this.dj.connect(msg.member.voiceChannel);
            } else {
                return servercmd.music.join.response.not_connected;
            }
        });

        // stop command
        this.servant.createCommand(servercmd.music.stop, () => {
            this.dj.stop();
            return servercmd.music.stop.response.success;
        });

        // pause command
        this.servant.createCommand(servercmd.music.pause, () => {
            this.dj.pause();
            return servercmd.music.pause.response.success;
        });

        // resume command
        this.servant.createCommand(servercmd.music.resume, () => {
            this.dj.resume();
            return servercmd.music.resume.response.success;
        });

        // skip command
        this.servant.createCommand(servercmd.music.skip, () => {
            this.dj.skip();
            return servercmd.music.skip.response.success;
        });

        // clear command
        this.servant.createCommand(servercmd.music.clear, () => {
            this.dj.clear();
            return servercmd.music.clear.response.success;
        });

        // playlist command
        this.servant.createCommand(servercmd.music.playlist, () => {
            let songs = this.dj.playlist;
            logger.debug(`found ${songs.length} songs`);
            let songlist = `**${songs.length} Songs in playlist**\n`;
            for (let i = 0; i < songs.length; i++) {
                if (i > 10) break;
                songlist += songs[i] + '\n';
            }
            return songlist;
        });

        // np command
        this.servant.createCommand(servercmd.music.current, () => {
            let song = this.dj.song;
            return `Playing: ${song.title}\n ${song.url}`;
        });

        // shuffle command
        this.servant.createCommand(servercmd.music.shuffle, () => {
            this.dj.shuffle();
            return servercmd.music.shuffle.response.success;
        });

        // repeat command
        this.servant.createCommand(servercmd.music.repeat, () => {
            if (this.dj) {
                this.dj.repeat = !this.dj.repeat;
                if (this.dj.repeat)
                    return servercmd.music.repeat.response.repeat_true;
                else
                    return servercmd.music.repeat.response.repeat_false;
            }
        });

        // saves playlists
        this.servant.createCommand(servercmd.music.save, (msg, argv) => {
            this.appendData('savedplaylists', argv.name, argv.url);
            return `Saved song/playlist as ${argv['name']}`
        });

        // saved command - prints out saved playlists
        this.servant.createCommand(servercmd.music.saved, () => {
            let response = '```markdown\nSaved Playlists:\n==\n';
            Object.entries(this.getData('savedplaylists')).forEach(([key, value]) => {
                response += `${key.padEnd(10, ' ')} ${value} \n\n`;
            });
            response += '```';
            return response;
        });
    }
};

/**
 * @param guild
 * @param prefix
 * @returns {GuildHandler}
 */
exports.getHandler = function (guild, prefix) {
    if (!handlers[guild.id]) handlers[guild.id] = new this.GuildHandler(guild, prefix);
    return handlers[guild.id];
};