const Discord = require("discord.js"),
    ytdl = require("ytdl-core"),
    ypi = require('youtube-playlist-info'),
    yttl = require('get-youtube-title'),
    ytapiKey = "AIzaSyBLF20r-c4mXoAT2qBFB5YlCgT0D-izOaU";
/* Variable Definition */
let logger = require('winston');
let client = null;
let connections = {};
let current = null;
let queue = [];

/* Function Definition */
// TODO: initCommands function that takes the cmd.js module as variable and uses it to create commands

/**
 * Getting the logger;
 * @param {Object} newLogger
 */
exports.setLogger = function (newLogger) {
    logger = newLogger;
};

/**
 * Sets the discord Client for the module
 * @param newClient
 */
exports.setClient = function(newClient) {
    client = newClient;
};

/**
 * Connects to a voicechannel
 * @param voiceChannel
 */
exports.connect = function(voiceChannel) {
    logger.debug(JSON.stringify());
    logger.verbose(`Connecting to voiceChannel ${voiceChannel.name}`);
    if (client !== null) {
        voiceChannel.join().then(connection => {
           logger.info(`Connected to Voicechannel ${voiceChannel.name}`);
           connections[voiceChannel.guild.id] = {
               'conn': connection,
               'disp': null,
               'queue': [],
               'playing': false,
               current: null
           };
        });
    } else {
        logger.error("Client is null");
    }
};

/**
 * Plays a file
 * @param filename
 */
exports.playFile = function(voiceChannel, filename) {
    let gid = voiceChannel.guild.id;
    let conn = connections[gid].conn;
    if (conn !== null) {
        connections[gid].disp = conn.playFile(filename);
        connections[gid].playing = true;
    } else {
        this.connect(voiceChannel);
        logger.warn("Not connected to a voicechannel");
    }
};

exports.play = function(voiceChannel, url) {
    let gid = voiceChannel.guild.id;
    if (!connections[gid]) this.connect(voiceChannel);
    let conn = connections[gid].conn;
    if (conn !== null) {
        let plist = url.match(/(?<=\?list=)[\w\-]+/g);
        if (plist) {
            logger.debug(`Adding playlist ${plist} to queue`);
            ypi(ytapiKey, plist).then(items => {
                for (let i = 0; i < items.length; i++) {
                    let vurl = `https://www.youtube.com/watch?v=${items[i].resourceId.videoId}`;
                    connections[gid].queue.push(vurl);
                }
                this.play(voiceChannel, connections[gid].queue.shift());
            });
            return;
        }
        if (!connections[gid].playing) {
            logger.debug(`Playing ${url}`);
            connections[gid].disp = conn.playStream(ytdl(url, {
                filter: "audioonly"
            }), {seek: 0, volume: 0.5});
            connections[gid].disp.on('end', () => {
                connections[gid].playing = false;
                connections[gid].current = null;
                if (connections[gid].queue.length > 0) {
                    this.play(voiceChannel, connections[gid].queue.shift());
                }
            });
            connections[gid].playing = true;
            connections[gid].current = url;
        } else {
            logger.debug(`Added ${url} to the queue`);
            connections[gid].queue.push(url);
        }
    } else {
        logger.warn("Not connected to a voicechannel");
    }
};

/**
 * Sets the volume of the music
 * @param percentage
 * @param voiceChannel
 */
exports.setVolume = function(voiceChannel, percentage) {
    let disp = connections[voiceChannel.guild.id].disp;
    logger.verbose(`Setting volume to ${percentage}`);
    if (disp !== null) {
        disp.setVolume(percentage);
    } else {
        logger.warn("No dispatcher found.")
    }
};

/**
 * pauses the music
 */
exports.pause = function(voiceChannel) {
    let disp = connections[voiceChannel.guild.id].disp;
    logger.verbose("Pausing music...");
    if (disp !== null) {
        disp.pause();
    } else {
        logger.warn("No dispatcher found");
    }
};

/**
 * Resumes the music
 */
exports.resume = function(voiceChannel) {
    let disp = connections[voiceChannel.guild.id].disp;
    logger.verbose("Resuming music...");
    if (disp !== null) {
        disp.resume();
    } else {
        logger.warn("No dispatcher found");
    }
};

/**
 * Stops the music
 */
exports.stop = function(voiceChannel) {
    let gid = voiceChannel.guild.id;
    let disp = connections[gid].disp;
    let conn = connections[gid].conn;
    logger.verbose("Stopping music...");
    if (disp !== null) {
        disp.end();
        logger.debug("Ended dispatcher");
    }
    if (conn !== null) {
        conn.disconnect();
        logger.debug("Ended connection");
    }
    connections[gid].playing = false;
};

/**
 * Skips the song
 */
exports.skip = function(voiceChannel) {
    let disp = connections[voiceChannel.guild.id].disp;
    logger.debug("Skipping song");
    if (disp !== null) {
        disp.end();
    }
};

/**
 * executes the callback when the titlelist is finished
 */
exports.getQueue = function(voiceChannel, callback) {
    let titles = [];
    connections[voiceChannel.guild.id].queue.forEach((url) => {
       yttl(url.replace(/http(s)?:\/\/(www.)?youtube.com\/watch\?v=/g, ''), (err, title) => {
           if (err) {
               logger.error(err);
           } else {
               titles.push(title);
           }
       });
    });
    setTimeout(() => callback(titles), 2000 );
};

/**
 * evokes the callback function with the title of the current song
 * @param callback
 * @param voiceChannel
 */
exports.nowPlaying = function(voiceChannel, callback) {
    let gid = voiceChannel.guild.id;
    if  (connections[gid].queue.length > 0) {
        yttl(connections[gid].current.replace(/http(s)?:\/\/(www.)?youtube.com\/watch\?v=/g, ''), (err, title) => {
            if (err) {
                logger.error(err);
            } else {
                callback(title, connections[gid].current);
            }
        });
    }
};

/**
 * shuffles the queue
 */
exports.shuffle = function(voiceChannel) {
    connections[voiceChannel.guild.id].queue = shuffle(queue);
};

/**
 * Shuffles an array with Fisher-Yates Shuffle
 * @param array
 * @returns {Array}
 */
function shuffle(array) {
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