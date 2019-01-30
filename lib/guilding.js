const cmd = require('./cmd'),
    music = require('./music'),
    utils = require('./utils'),
    config = require('../config.json'),
    servercmd = require('../commands/servercommands'),
    sqlite3 = require('sqlite3'),
    Discord = require('discord.js'),
    handlers = {},
    dataDir = config.dataPath || './data';
let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
    music.setLogger(logger);
    cmd.setLogger(logger);
};

/**
 * Server-Specific commands, music and more
 * @type {GuildHandler}
 */
exports.GuildHandler = class {
    constructor(guild, prefix) {
        this.guild = guild;
        this.dj = null;
        this.mention = false;
        this.prefix = prefix || config.prefix;
        this.servant = new cmd.Servant(this.prefix);
        this.ready = false;
        this.msgsQueue = [];
        // checking if the data direcotry exists and if the gdb directory exists and creates them if they don't
        utils.dirExistence(dataDir, () => {
            utils.dirExistence(dataDir + '/gdb', () => {
                this.db = new sqlite3.Database(`${dataDir}/gdb/${guild}.db`, (err) => {
                    if (err)
                        logger.error(err.message);
                    logger.debug(`Connected to the database for ${guild}`);
                    this.createTables();
                    // register commands
                    this.registerMusicCommands();
                    this.ready = true;
                    // handle all messages that have been received while not being ready
                    for (let i = 0; i < this.msgsQueue.length; i++) {
                        this.handleMessage(this.msgsQueue.shift());
                    }
                });
            })
        });
    }

    /**
     * Destroys the guild handler
     */
    destroy() {
        this.dj.stop();
        this.db.close();
    }

    /**
     * Creates all tables needed in the Database.
     * These are at the moment:
     *  messages - logs all messages send on the server
     *  playlists - save playlists to play them later
     */
    createTables() {
        this.db.run(`${utils.sql.tableExistCreate} messages (
            ${utils.sql.pkIdSerial},
            creation_timestamp DATETIME NOT NULL,
            author VARCHAR(128) NOT NULL,
            author_name VARCHAR(128),
            content TEXT NOT NULL
        )`);
        this.db.run(`${utils.sql.tableExistCreate} playlists (
            ${utils.sql.pkIdSerial},
            name VARCHAR(32) UNIQUE NOT NULL,
            url VARCHAR(255) NOT NULL
        )`);
    }

    /**
     * Answers a message via mention if mentioning is active or with just sending it to the same channel.
     * @param msg
     * @param answer
     */
    answerMessage(msg, answer) {
        if (answer instanceof Promise || answer) {
            if (answer instanceof Discord.RichEmbed) {
                (this.mention) ? msg.reply('', answer) : msg.channel.send('', answer);
            } else if (answer instanceof Promise) {
                answer
                    .then((answer) => this.answerMessage(msg, answer))
                    .catch((error) => this.answerMessage(msg, error));
            } else {
                (this.mention) ? msg.reply(answer) : msg.channel.send(answer);
            }
        } else {
            logger.debug(`Empty answer won't be send.`);
        }
    }

    /**
     * handles the message by letting the servant parse the command. Depending on the message setting it
     * replies or just sends the answer.
     * @param msg
     */
    handleMessage(msg) {
        if (this.ready) {
            if (this.db) {
                this.db.run(
                    'INSERT INTO messages (author, creation_timestamp, author_name, content) values (?, ?, ?, ?)',
                    [msg.author.id, msg.createdTimestamp, msg.author.username, msg.content],
                    (err) => {
                        if (err)
                            logger.error(err.message);
                    }
                );
            }
            this.answerMessage(msg, this.servant.parseCommand(msg));
        } else {
            this.msgsQueue.push(msg);
        }
    }

    /**
     * Connect to a voice-channel if not connected and play the url
     * @param vc
     * @param url
     * @param next
     */
    connectAndPlay(vc, url, next) {
        return new Promise((resolve, reject) => {
            if (!this.dj.connected) {
                this.dj.connect(vc).then(() => {
                    this.dj.playYouTube(url, next);
                    resolve();
                }).catch((err) => reject(err));
            } else {
                this.dj.playYouTube(url, next);
                resolve();
            }
        });
    }

    /**
     * registers all music commands and initializes a dj
     * @param cmdPrefix
     */
    registerMusicCommands(cmdPrefix) {
        this.dj = new music.DJ();

        // play command
        this.servant.createCommand(servercmd.music.play, (msg, kwargs, argv) => {
            return new Promise((resolve, reject) => {
                let vc = this.dj.voiceChannel || msg.member.voiceChannel;
                let url = kwargs['url'];
                if (!vc)
                    reject(servercmd.music.play.response.no_voicechannel);
                if (!url)
                    reject(servercmd.music.play.response.no_url);
                if (!utils.YouTube.isValidEntityUrl(url)) {
                    if (argv && argv.length > 0)
                        url += ' ' + argv.join(' ');    // join to get the whole expression behind the command
                    this.db.get('SELECT url FROM playlists WHERE name = ?', [url], (err, row) => {
                        if (err)
                            console.error(err.message);
                        if (!row) {
                            reject(servercmd.music.play.response.url_invalid);
                            logger.verbose('Got invalid url for play command.');
                        } else {
                            url = row.url;

                            this.connectAndPlay(vc, url).then(() => {
                                resolve(servercmd.music.play.response.success);
                            }).catch((err) => {
                                logger.error(err.message);
                                reject(servercmd.music.play.response.failure);
                            });
                        }
                    });
                } else {
                    this.connectAndPlay(vc, url).then(() => {
                        resolve(servercmd.music.play.response.success);
                    }).catch((err) => {
                        logger.error(err.message);
                        reject(servercmd.music.play.response.failure);
                    });
                }
            })
        });

        // playnext command
        this.servant.createCommand(servercmd.music.playnext, (msg, kwargs, argv) => {
            return new Promise((resolve, reject) => {
                let vc = msg.member.voiceChannel;
                if (!this.dj.connected) this.dj.voiceChannel = vc;
                let url = kwargs['url'];
                if (!url) reject(servercmd.music.playnext.response.no_url);
                if (!utils.YouTube.isValidEntityUrl(url)) {
                    if (argv)
                        url += ' ' + argv.join(' ');
                    this.db.get('SELECT url FROM playlists WHERE name = ?', [url], (err, row) => {
                        if (err)
                            console.error(err.message);
                        if (!row) {
                            reject(servercmd.music.play.response.url_invalid);
                        } else {
                            url = row.url;

                            this.connectAndPlay(url, true).then(() => {
                                resolve(servercmd.music.playnext.response.success);
                            }).catch((err) => {
                                logger.error(err.message);
                                reject(servercmd.music.play.response.failure);
                            });
                        }
                    });
                } else {
                    this.connectAndPlay(url, true).then(() => {
                        resolve(servercmd.music.playnext.response.success);
                    }).catch((err) => {
                        logger.error(err);
                        reject(servercmd.music.playnext.response.failure);
                    });
                }
            })
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
            logger.debug(`found ${this.dj.queue.length} songs`);
            let describtion = '';
            for (let i = 0; i < Math.min(this.dj.queue.length, 9); i++) {
                let entry = this.dj.queue[i];
                describtion += `[${entry.title}](${entry.url})\n`;
            }
            return new Discord.RichEmbed()
                .setTitle(`${this.dj.queue.length} songs in queue`)
                .setDescription(describtion);
        });

        // np command
        this.servant.createCommand(servercmd.music.current, () => {
            let song = this.dj.song;
            if (song) {
                return new Discord.RichEmbed()
                    .setTitle('Now playing:')
                    .setDescription(`[${song.title}](${song.url})`)
                    .setImage(utils.YouTube.getVideoThumbnailUrlFromUrl(song.url))
                    .setColor(0x00aaff);
            } else {
                return servercmd.music.current.response.not_playing;
            }
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
        this.servant.createCommand(servercmd.music.save, (msg, kwargs, argv) => {
            return new Promise((resolve, reject) => {
                let saveName = argv.join(' ');
                this.db.get('SELECT COUNT(*) count FROM playlists WHERE name = ?', [saveName], (err, row) => {
                    if (err) {
                        logger.error(err.message);
                        reject();
                    }
                    let cb = (err) => { // defining the callback for usage below
                        if (err)
                            logger.error(err.message);
                        else
                            resolve(`Saved song/playlist as ${saveName}`);
                    };
                    if (!row || row.count === 0) {
                        this.db.run('INSERT INTO playlists (name, url) VALUES (?, ?)', [saveName, kwargs.url], cb);
                    } else {
                        this.db.run('UPDATE playlists SET url = ? WHERE name = ?', [kwargs.url, saveName], cb)
                    }
                });
            });
        });

        // saved command - prints out saved playlists
        this.servant.createCommand(servercmd.music.saved, (msg) => {
            return new Promise((resolve, reject) => {
                let response = '';
                this.db.all('SELECT name, url FROM playlists', (err, rows) => {
                    if (err) {
                        logger.error(err.message);
                        reject();
                    }
                    for (let row of rows) {
                        response += `[${row.name}](${row.url})\n`;
                    }
                    if (rows.length === 0) {
                        msg.channel.send(servercmd.music.saved.response.no_saved);
                    } else {
                        let richEmbed = new Discord.RichEmbed()
                            .setTitle('Saved Songs and Playlists')
                            .setDescription(response);
                        resolve(richEmbed);
                    }
                });
            });
        });
    }
};

/**
 * @param guild
 * @param prefix
 * @returns {GuildHandler}
 * @deprecated use Bot class method instead
 */
exports.getHandler = function (guild, prefix) {
    if (!handlers[guild.id])
        handlers[guild.id] = new this.GuildHandler(guild, prefix);
    return handlers[guild.id];
};

/**
 * Destroy all handlers to safely end all sql3-clients.
 * @deprecated automated in Bot class cleanup
 */
exports.destroyAll = function () {
    logger.debug('Destroying all handlers...');
    for (let key in Object.keys(handlers)) {
        if (handlers[key])
            handlers[key].destroy();
    }
};