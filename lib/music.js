const Discord = require("discord.js"),
    ytdl = require("ytdl-core"),
    ypi = require('youtube-playlist-info'),
    yttl = require('get-youtube-title'),
    ytapiKey = "AIzaSyBLF20r-c4mXoAT2qBFB5YlCgT0D-izOaU";
/* Variable Definition */
let logger = require('winston');
let djs = {};
let connections = {};

/* Function Definition */
// TODO: initCommands function that takes the cmd.js module as variable and uses it to create commands

class DJ {
    constructor(voiceChannel) {
        this.conn = null;
        this.disp = null;
        this.queue = [];
        this.playing = false;
        this.current = null;
        this.volume = 0.5;
        this.voiceChannel = voiceChannel;
    }

    connect() {
        logger.verbose(`Connecting to voiceChannel ${this.voiceChannel.name}`);
        return this.voiceChannel.join().then(connection => {
            logger.info(`Connected to Voicechannel ${this.voiceChannel.name}`);
            this.conn = connection;
        });
    }

    playFile(filename) {
        if (this.conn !== null) {
            this.disp = this.conn.playFile(filename);
            this.playing = true;
        } else {
            logger.warn("Not connected to a voicechannel. Connection now.");
            this.connect(this.voiceChannel).then(() => {
                this.playFile(filename);
            });
        }
    }

    playYouTube(url) {
        if (!this.conn) this.connect(this.voiceChannel).then(this.playYouTube(url));
        let plist = url.match(/(?<=\?list=)[\w\-]+/g);
        if (plist) {
            logger.debug(`Adding playlist ${plist} to queue`);
            ypi(ytapiKey, plist).then(items => {
                for (let i = 0; i < items.length; i++) {
                    let vurl = `https://www.youtube.com/watch?v=${items[i].resourceId.videoId}`;
                    this.queue.push({'url': vurl, 'title': null});
                    yttl(vurl.replace(/http(s)?:\/\/(www.)?youtube.com\/watch\?v=/g, ''), (err, title) => {
                        if (err) {
                            logger.error(err);
                        } else {
                            this.queue.find((el) => {
                                return (el.url === vurl);
                            }).title = title;
                        }
                    });
                }
                this.playYouTube(this.queue.shift().url);
            });
            return;
        }
        if (!this.playing) {
            logger.debug(`Playing ${url}`);
            this.disp = this.conn.playStream(ytdl(url, {
                filter: "audioonly"
            }), {seek: 0, volume: this.volume});
            this.disp.on('end', () => {
                this.playing = false;
                this.current = null;
                if (this.queue.length > 0) {
                    this.current = this.queue.shift()
                    this.playYouTube(this.current.url);
                } else {
                    this.stop();
                }
            });
            this.playing = true;
        } else {
            logger.debug(`Added ${url} to the queue`);
            this.queue.push(url);
        }
    }

    setVolume(percentage) {
        logger.verbose(`Setting volume to ${percentage}`);
        if (this.disp !== null) {
            this.disp.setVolume(percentage);
        } else {
            logger.warn("No dispatcher found.")
        }
    }

    pause() {
        logger.verbose("Pausing music...");
        if (this.disp !== null) {
            this.disp.pause();
        } else {
            logger.warn("No dispatcher found");
        }
    }

    resume() {
        logger.verbose("Resuming music...");
        if (this.disp !== null) {
            this.disp.resume();
        } else {
            logger.warn("No dispatcher found");
        }
    }

    stop() {
        logger.verbose("Stopping music...");
        if (this.disp !== null) {
            this.disp.end();
            logger.debug("Ended dispatcher");
        }
        if (this.conn !== null) {
            this.conn.disconnect();
            logger.debug("Ended connection");
        }
    }

    skip () {
        logger.debug("Skipping song");
        if (this.disp !== null) {
            this.disp.end();
        }
    }

    get playlist() {
        let songs = [];
        this.queue.forEach((entry) => {
            songs.push(entry.title);
        });
        return songs;
    }

    get song() {
        return this.current.title;
    }

    shuffle() {
        this.queue = shuffleArray(this.queue);
    }
}

/**
 * Getting the logger;
 * @param {Object} newLogger
 */
exports.setLogger = function (newLogger) {
    logger = newLogger;
};

/**
 * Connects to a voicechannel
 * @param voiceChannel
 */
exports.connect = function(voiceChannel) {
    let gid = voiceChannel.guild.id;
    let voiceDJ =  new DJ(voiceChannel);
    voiceDJ.connect();
    djs[gid] = voiceDJ;
};

/**
 * Plays a file
 * @param filename
 * @param guildId
 */
exports.playFile = function(guildId, filename) {
    djs[guildId].playFile(filename);
};

/**
 * Plays a YT Url
 * @param guildId
 * @param url
 */
exports.play = function(guildId, url) {
    djs[guildId].playYouTube(url);
};

/**
 * Sets the volume of the music
 * @param percentage
 * @param guildId
 */
exports.setVolume = function(guildId, percentage) {
    djs[guildId].setVolume(percentage);
};

/**
 * pauses the music
 */
exports.pause = function(guildId) {
    djs[guildId].pause();
};

/**
 * Resumes the music
 * @param guildId
 */
exports.resume = function(guildId) {
    djs[guildId].resume();
};

/**
 * Stops the music
 * @param guildId
 */
exports.stop = function(guildId) {
    djs[guildId].stop();
    delete djs[guildId];
};

/**
 * Skips the song
 * @param guildId
 */
exports.skip = function(guildId) {
    djs[guildId].skip();
};

/**
 * Returns the queue
 * @param guildId
 */
exports.getQueue = function(guildId) {
    return djs[guildId].playlist;
};

/**
 * evokes the callback function with the title of the current song
 * @param guildId
 */
exports.nowPlaying = function(guildId) {
    return djs[guildId].song;
};

/**
 * shuffles the queue
 * @param guildId
 */
exports.shuffle = function(guildId) {
    djs[guildId].shuffle();
};

/**
 * Shuffles an array with Fisher-Yates Shuffle
 * @param array
 * @returns {Array}
 */
function shuffleArray(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}