const ytdl = require("ytdl-core"),
    ypi = require('youtube-playlist-info'),
    yttl = require('get-youtube-title'),
    args = require('args-parser')(process.argv),
    config = require('../config.json'),
    utils = require('./utils.js'),
    ytapiKey = args.ytapi || config.api.youTubeApiKey;
/* Variable Definition */
let logger = require('winston');

/* Function Definition */

exports.setLogger = function (newLogger) {
    logger = newLogger;
};

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
        this.exitTimeout = null;
    }

    /**
     * Connects to the given voice channel. Disconnects from the previous one if it exists.
     * When the bot was moved and connect is executed again, it connects to the initial VoiceChannel because the
     * VoiceChannel is saved as object variable.
     */
    async connect(voiceChannel) {
        this.voiceChannel = voiceChannel || this.voiceChannel;
        if (this.connected)
            this.stop();

        logger.verbose(`Connecting to voiceChannel ${this.voiceChannel.name}`);
        let connection = await this.voiceChannel.join();
        logger.info(`Connected to Voicechannel ${this.voiceChannel.name}`);
        this.conn = connection;
    }

    /**
     * Defining setter for listenOnRepeat to include the current song into the repeating loop.
     * @param value
     */
    set listenOnRepeat(value) {
        this.repeat = value;
        if (this.current)
            this.queue.push(this.current);

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
     * Updates the channel e.g. when the bot is moved to another channel.
     * @param voiceChannel
     */
    updateChannel(voiceChannel) {
        this.voiceChannel = voiceChannel;
        logger.debug(`Updated voiceChannel to ${this.voiceChannel.name}`);
    }

    /**
     * Plays a file for the given filename.
     * TODO: Implement queue
     * @param filename
     * @todo
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
     * Checks if there are still members listening and sets an exit timeout (5 min)
     * not connected).
     */
    checkListeners() {
        if (this.exitTimeout) {
            clearTimeout(this.exitTimeout);
            this.exitTimeout = null;
            logger.debug(`Cleared exit timout for ${this.voiceChannel.name}`);
        }
        if (this.connected && this.voiceChannel.members.size === 1) {
            logger.debug(`Set exit timout for ${this.voiceChannel.name}`);
            this.exitTimeout = setTimeout(() => {
                if (this.connected && this.voiceChannel.members.size === 1)
                    logger.verbose(`Exiting ${this.voiceChannel.name}`);
                this.stop();
            }, config.music.timeout || 300000);
        }
    }

    /**
     * Plays the url of the current song if there is no song playing or puts it in the queue.
     * If the url is a playlist, the videos of the playlist are fetched and put
     * in the queue. For each song the title is saved in the queue too.
     * @param url
     * @param playnext
     */
    async playYouTube(url, playnext) {
        let plist = utils.YouTube.getPlaylistIdFromUrl(url);
        if (plist) {
            logger.debug(`Adding playlist ${plist} to queue`);
            let playlistItems = await ypi(ytapiKey, plist);
            let firstSong = utils.YouTube.getVideoUrlFromId(playlistItems.shift().resourceId.videoId);
            let firstSongTitle = null;
            try {
                firstSongTitle = await this.getVideoName(firstSong);
            } catch(err) {
                if (err.message !== 'Not found') {
                    logger.warn(err.message);
                    logger.debug(err.stack);
                }
            }

            if (this.repeat)
                this.queue.push({'url': firstSong, 'title': firstSongTitle});
            this.playYouTube(firstSong).catch((err) => logger.warn(err.message));

            for (let item of playlistItems) {
                let vurl = utils.YouTube.getVideoUrlFromId(item.resourceId.videoId);
                try {
                    this.queue.push({'url': vurl, 'title': await this.getVideoName(vurl)}); //eslint-disable-line no-await-in-loop
                } catch (err) {
                    if (err.message !== 'Not found') {
                        logger.warn(err.message);
                        logger.debug(err.stack);
                    }
                }
            }
            logger.debug(`Added ${playlistItems.length} songs to the queue`);
        } else if (!this.playing || !this.disp) {
            logger.debug(`Playing ${url}`);
            this.current = ({'url': url, 'title': await this.getVideoName(url)});

            this.disp = this.conn.playStream(ytdl(url,
                {filter: 'audioonly', quality: this.quality, liveBuffer: config.music.livePuffer || 20000}),
                {volume: this.volume});

            this.disp.on('end', (reason) => {   // end event triggers the next song to play when the reason is not stop
                if (reason !== 'stop') {
                    this.playing = false;
                    this.current = null;
                    if (this.queue.length > 0) {
                        this.current = this.queue.shift();
                        if (this.repeat)            // listen on repeat
                            this.queue.push(this.current);
                        this.playYouTube(this.current.url).catch((err) => logger.warn(err.message));
                    } else {
                        this.stop();
                    }
                }
            });
            this.playing = true;
        } else {
            logger.debug(`Added ${url} to the queue`);
            if (playnext)
                this.queue.unshift({'url': url, 'title': await this.getVideoName(url)});
            else
                this.queue.push({'url': url, 'title': await this.getVideoName(url)});
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
            logger.warn("No dispatcher found.");
        }
    }

    /**
     * Pauses if a dispatcher exists
     */
    pause() {
        logger.verbose("Pausing music...");
        if (this.disp !== null)
            this.disp.pause();
         else
            logger.warn("No dispatcher found");

    }

    /**
     * Resumes if a dispatcher exists
     */
    resume() {
        logger.verbose("Resuming music...");
        if (this.disp !== null)
            this.disp.resume();
         else
            logger.warn("No dispatcher found");

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
                this.playYouTube(this.current.url).catch((err) => {
                    logger.error(err.message);
                    logger.debug(err.stack);
                });
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
