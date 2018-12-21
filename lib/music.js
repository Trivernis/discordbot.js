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

    /**
     * Connects to the given voice channel. Disconnects from the previous one if it exists.
     * When the bot was moved and connect is executed again, it connects to the initial VoiceChannel because the
     * VoiceChannel is saved as object variable.
     * @returns {Promise<T | never>}
     */
    connect() {
        if (this.conn) {
            this.stop();
        }
        logger.verbose(`Connecting to voiceChannel ${this.voiceChannel.name}`);
        return this.voiceChannel.join().then(connection => {
            logger.info(`Connected to Voicechannel ${this.voiceChannel.name}`);
            this.conn = connection;
        });
    }

    /**
     * Plays a file for the given filename.
     * TODO: Implement queue
     * @param filename
     */
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

    /**
     * Plays the url of the current song if there is no song playing or puts it in the queue.
     * If the url is a playlist (regex match), the videos of the playlist are fetched and put
     * in the queue. For each song the title is saved in the queue too.
     * @param url
     */
    playYouTube(url, playnext) {
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
                            logger.debug(JSON.stringify(err));
                        } else {
                            try {
                                logger.debug(`Found title: ${title} for ${vurl}`);
                                this.queue.find((el) => {
                                    return (el.url === vurl);
                                }).title = title;
                            } catch (error) {
                                logger.verbose(JSON.stringify(error));
                            }
                        }
                    });
                }
                this.current = this.queue.shift();
                this.playYouTube(this.current.url);
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
                    this.current = this.queue.shift();
                    this.playYouTube(this.current.url);
                } else {
                    this.stop();
                }
            });
            this.playing = true;
        } else {
            logger.debug(`Added ${url} to the queue`);
            if (playnext) {
                this.queue.unshift({'url': url, 'title': null});
            } else {
                this.queue.push({'url': url, 'title': null});
            }
            yttl(url.replace(/http(s)?:\/\/(www.)?youtube.com\/watch\?v=/g, ''), (err, title) => {
                if (err) {
                    logger.debug(JSON.stringify(err));
                } else {
                    try {
                        logger.debug(`Found title: ${title} for ${url}`);
                        this.queue.find((el) => {
                            return (el.url === url);
                        }).title = title;
                    } catch (error) {
                        console.verbose(JSON.stringify(error));
                    }
                }
            });
        }
    }

    /**
     * Sets the volume of the dispatcher to the given value
     * @param percentage
     */
    setVolume(percentage) {
        logger.verbose(`Setting volume to ${percentage}`);
        if (this.disp !== null) {
            this.volume = percentage;
            this.disp.setVolume(percentage);
        } else {
            logger.warn("No dispatcher found.")
        }
    }

    /**
     * Pauses if a dispatcher exists
     */
    pause() {
        logger.verbose("Pausing music...");
        if (this.disp !== null) {
            this.disp.pause();
        } else {
            logger.warn("No dispatcher found");
        }
    }

    /**
     * Resumes if a dispatcher exists
     */
    resume() {
        logger.verbose("Resuming music...");
        if (this.disp !== null) {
            this.disp.resume();
        } else {
            logger.warn("No dispatcher found");
        }
    }

    /**
     * Stops playing music by ending the Dispatcher and disconnecting
     */
    stop() {
        this.queue = [];
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

    /**
     * Skips to the next song by ending the current StreamDispatcher and thereby triggering the
     * end event of the dispatcher that automatically plays the next song.
     */
    skip () {
        logger.debug("Skipping song");
        if (this.disp !== null) {
            this.disp.end();
        }
    }

    /**
     * Returns the title for each song saved in the queue
     * @returns {Array}
     */
    get playlist() {
        let songs = [];
        this.queue.forEach((entry) => {
            songs.push(entry.title);
        });
        return songs;
    }

    /**
     * Returns the song saved in the private variable 'current'
     * @returns {null|*}
     */
    get song() {
        return this.current;
    }

    /**
     * Shuffles the queue
     */
    shuffle() {
        this.queue = shuffleArray(this.queue);
    }

    /**
     * Clears the playlist
     */
    clear() {
        this.queue = [];
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
    djs[gid] = voiceDJ;
    return voiceDJ.connect();
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
 * @param voiceChannel
 * @param url
 */
exports.play = function(voiceChannel, url) {
    let guildId = voiceChannel.guild.id;
    if (!djs[guildId]) {
        this.connect(voiceChannel).then(() => {
            djs[guildId].playYouTube(url);
        });
    } else {
        djs[guildId].playYouTube(url);
    }
};

/**
 * plays the given url as next song
 * @param voiceChannel
 * @param url
 */
exports.playnext = function(voiceChannel, url) {
    let guildId = voiceChannel.guild.id;
    if (!djs[guildId]) {
        this.connect(voiceChannel).then(() => {
            djs[guildId].playYouTube(url, true);
        });
    } else {
        djs[guildId].playYouTube(url, true);
    }
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
 * Clears the playlist
 * @param guildId
 */
exports.clearQueue = function(guildId) {
    djs[guildId].clear();
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