const ytdl = require("ytdl-core"),
    ypi = require('youtube-playlist-info'),
    yttl = require('get-youtube-title'),
    args = require('args-parser')(process.argv),
    config = require('../config.json'),
    utils = require('./utils.js'),
    ytapiKey = args.ytapi || config.api.youTubeApiKey;
/* Variable Definition */
let logger = require('winston');
let djs = {};

/* Function Definition */

exports.DJ = class {
    constructor(voiceChannel) {
        this.conn = null;
        this.disp = null;
        this.queue = [];
        this.playing = false;
        this.current = null;
        this.repeat = false;
        this.volume = 0.5;
        this.voiceChannel = voiceChannel;
        this.quality = 'lowest';
    }

    /**
     * Connects to the given voice channel. Disconnects from the previous one if it exists.
     * When the bot was moved and connect is executed again, it connects to the initial VoiceChannel because the
     * VoiceChannel is saved as object variable.
     */
    connect(voiceChannel) {
        return new Promise((resolve, reject) => {
            this.voiceChannel = voiceChannel || this.voiceChannel;
            if (this.connected) {
                this.stop();
            }
            logger.verbose(`Connecting to voiceChannel ${this.voiceChannel.name}`);
            this.voiceChannel.join().then(connection => {
                logger.info(`Connected to Voicechannel ${this.voiceChannel.name}`);
                this.conn = connection;
                this.checkListeners();
                resolve();
            }).catch((error) => reject(error));
        })
    }

    /**
     * Defining setter for listenOnRepeat to include the current song into the repeating loop.
     * @param value
     */
    set listenOnRepeat(value) {
        this.repeat = value;
        if (this.current) {
            this.queue.push(this.current);
        }
    }

    /**
     * Returns if a connection exists
     * @returns {boolean}
     */
    get connected() {
        return (
            this.conn !== null &&
            this.conn !== undefined &&
            this.conn.status !== 4 // status 4 means disconnected.
        );
    }

    /**
     * Plays a file for the given filename.
     * TODO: Implement queue
     * @param filename
     */
    playFile(filename) {
        if (this.connected) {
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
     * Checks if there are still members listening and sets an exit timeout (5 min) before checking again
     * and exiting when noone is listening. Once this function is executed, it calls itself every 10 seconds (stops when
     * not connected).
     */
    checkListeners() {
        if (this.connected && this.conn.channel.members.size === 1) {
            logger.verbose(`Set exit timout for ${this.voiceChannel.name}`);
            setTimeout(() => {
                if (this.voiceChannel && this.voiceChannel.members.size === 1)
                    logger.verbose(`Exiting ${this.voiceChannel.name}`);
                this.stop();
            }, config.music.timeout || 300000);
        } else if (this.connected)
            setTimeout(() => this.checkListeners(), 10000);
    }

    /**
     * Plays the url of the current song if there is no song playing or puts it in the queue.
     * If the url is a playlist (regex match), the videos of the playlist are fetched and put
     * in the queue. For each song the title is saved in the queue too.
     * @param url
     * @param playnext
     */
    playYouTube(url, playnext) {
        let plist = utils.YouTube.getPlaylistIdFromUrl(url);
        if (plist) {
            logger.debug(`Adding playlist ${plist} to queue`);
            ypi(ytapiKey, plist).then(items => {
                let firstSong = utils.YouTube.getVideoUrlFromId(items.shift().resourceId.videoId);

                this.getVideoName(firstSong).then((title) => { // getting the first song to start playing music
                    if (this.repeat)                    // listen on repeat
                        this.queue.push({'url': firstSong, 'title': title});  // put the current song back at the end of the queue
                    this.playYouTube(firstSong);    // call with single url that gets queued if a song is already playing
                }).catch((err) => logger.verbose(err.message));
                for (let item of items) {
                    let vurl = utils.YouTube.getVideoUrlFromId(item.resourceId.videoId);
                    this.getVideoName(vurl).then((title) => {
                        this.queue.push({'url': vurl, 'title': title});
                    }).catch((err) => logger.verbose(err.message));
                }
                logger.debug(`Added ${items.length} songs to the queue`);
            });
        } else {
            if (!this.playing || !this.disp) {
                logger.debug(`Playing ${url}`);

                this.getVideoName(url).then((title) => {
                    this.current = ({'url': url, 'title': title});

                    this.disp = this.conn.playStream(ytdl(url, {
                        filter: 'audioonly', quality: this.quality, liveBuffer: 40000
                    }), {volume: this.volume});

                    this.disp.on('end', (reason) => {   // end event triggers the next song to play when the reason is not stop
                        if (reason !== 'stop') {
                            this.playing = false;
                            this.current = null;
                            if (this.queue.length > 0) {
                                this.current = this.queue.shift();
                                if (this.repeat)            // listen on repeat
                                    this.queue.push(this.current);
                                this.playYouTube(this.current.url);
                            } else {
                                this.stop();
                            }
                        }
                    });
                    this.playing = true;
                });
            } else {
                logger.debug(`Added ${url} to the queue`);
                if (playnext) {
                    this.getVideoName(url).then((title) => {
                        this.queue.unshift({'url': url, 'title': title});
                    }).catch((err) => logger.verbose(err.message));
                } else {
                    this.getVideoName(url).then((title) => {
                        this.queue.push({'url': url, 'title': title});
                    }).catch((err) => logger.verbose(err.message));
                }
            }
        }
    }

    /**
     * Gets the name of the YouTube Video at url
     * @param url
     * @returns {Promise<>}
     */
    getVideoName(url) {
        return new Promise((resolve, reject) => {
            yttl(utils.YouTube.getVideoIdFromUrl(url), (err, title) => {
                if (err) {
                    logger.debug(JSON.stringify(err));
                    reject(err);
                } else {
                    resolve(title);
                }
            });
        });
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
     * Stops playing music by ending the Dispatcher and disconnecting.
     * Also sets playing to false and clears the queue and the current song.
     */
    stop() {
        this.playing = false;
        this.queue = [];
        this.current = null;
        logger.verbose("Stopping music...");
        try {
            if (this.disp) {
                this.disp.end('stop');
                this.disp = null;
                logger.debug("Ended dispatcher");
            }
            if (this.conn) {
                this.conn.channel.leave();
                this.conn.disconnect();
                this.conn = null;
                logger.debug("Ended connection");
            }
            if (this.voiceChannel) {
                this.voiceChannel.leave();
                logger.debug("Left VoiceChannel");
                logger.info(`Disconnected from Voicechannel ${this.voiceChannel.name}`);
            }
        } catch (error) {
            logger.verbose(JSON.stringify(error));
        }
    }

    /**
     * Skips to the next song by ending the current StreamDispatcher and thereby triggering the
     * end event of the dispatcher that automatically plays the next song. If no dispatcher is found
     * It tries to play the next song with playYouTube
     */
    skip() {
        logger.debug("Skipping song");
        if (this.disp !== null) {
            this.disp.end();
        } else {
            this.playing = false;
            if (this.queue.length > 0) {
                this.current = this.queue.shift();
                this.playYouTube(this.current.url);
            } else {
                this.stop();
            }
        }
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
        this.queue = utils.shuffleArray(this.queue);
    }

    /**
     * Clears the playlist
     */
    clear() {
        this.queue = [];
    }
};

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
 * @deprecated
 */
exports.connect = function (voiceChannel) {
    let gid = voiceChannel.guild.id;
    let voiceDJ = new this.DJ(voiceChannel);
    djs[gid] = voiceDJ;
    return voiceDJ.connect();
};

/**
 * Plays a file
 * @param filename
 * @param guildId
 * @deprecated
 */
exports.playFile = function (guildId, filename) {
    djs[guildId].playFile(filename);
};

/**
 * Plays a YT Url
 * @param voiceChannel
 * @param url
 * @deprecated
 */
exports.play = function (voiceChannel, url) {
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
 * @deprecated
 */
exports.playnext = function (voiceChannel, url) {
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
 * @deprecated
 */
exports.setVolume = function (guildId, percentage) {
    djs[guildId].setVolume(percentage);
};

/**
 * pauses the music
 * @deprecated
 */
exports.pause = function (guildId) {
    djs[guildId].pause();
};

/**
 * Resumes the music
 * @param guildId
 * @deprecated
 */
exports.resume = function (guildId) {
    djs[guildId].resume();
};

/**
 * Stops the music
 * @param guildId
 * @deprecated
 */
exports.stop = function (guildId) {
    djs[guildId].stop();
    delete djs[guildId];
};

/**
 * Skips the song
 * @param guildId
 * @deprecated
 */
exports.skip = function (guildId) {
    djs[guildId].skip();
};

/**
 * Clears the playlist
 * @param guildId
 * @deprecated
 */
exports.clearQueue = function (guildId) {
    djs[guildId].clear();
};

/**
 * Returns the queue
 * @param guildId
 * @deprecated
 */
exports.getQueue = function (guildId) {
    return djs[guildId].playlist;
};

/**
 * evokes the callback function with the title of the current song
 * @param guildId
 * @deprecated
 */
exports.nowPlaying = function (guildId) {
    return djs[guildId].song;
};

/**
 * shuffles the queue
 * @param guildId
 * @deprecated
 */
exports.shuffle = function (guildId) {
    djs[guildId].shuffle();
};
