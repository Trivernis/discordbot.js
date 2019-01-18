const cmd = require('./cmd'),
    music = require('./music'),
    utils = require('./utils.js'),
    config = require('../config.json'),
    servercmd = require('../commands/servercommands'),
    sqlite3 = require('sqlite3'),
    handlers = {},
    dbDir = './data/gdb';
let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
    music.setLogger(logger);
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
        utils.dirExistence('./data', () => {
            utils.dirExistence('./data/gdb', () => {
                this.db = new sqlite3.Database(`./data/gdb/${guild}.db`);
                this.createTables();
            })
        });
        this.registerMusicCommands();
    }

    /**
     * Creates all tables needed in the Database.
     * These are at the moment:
     *  messages - logs all messages send on the server
     *  playlists - save playlists to play them later
     */
    createTables() {
        let createCmd = 'CREATE TABLE IF NOT EXISTS';
        let autoIdPK = 'id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL';
        this.db.run(`${createCmd} messages (
            ${autoIdPK},
            creation_timestamp DATETIME NOT NULL,
            author VARCHAR(128) NOT NULL,
            author_name VARCHAR(128),
            content TEXT NOT NULL
        )`);
        this.db.run(`${createCmd} playlists (
            ${autoIdPK},
            name VARCHAR(32) UNIQUE NOT NULL,
            url VARCHAR(255) NOT NULL
        )`);
    }

    /**
     * handles the message by letting the servant parse the command. Depending on the message setting it
     * replies or just sends the answer.
     * @param msg
     */
    handleMessage(msg) {
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
        let answer = this.servant.parseCommand(msg);
        if (!answer) return;
        if (this.mention) {
            msg.reply(answer);
        } else {
            msg.channel.send(answer);
        }
    }

    /**
     * Connect to a voice-channel if not connected and play the url
     * @param vc
     * @param url
     */
    connectAndPlay(vc, url) {
        if (!this.dj.connected) {
            this.dj.connect(vc).then(() => {
                this.dj.playYouTube(url);
            });
        } else {
            this.dj.playYouTube(url);
        }
    }

    /**
     * registers all music commands and initializes a dj
     * @param cmdPrefix
     */
    registerMusicCommands(cmdPrefix) {
        let prefix = cmdPrefix || this.prefix;
        this.dj = new music.DJ();

        // play command
        this.servant.createCommand(servercmd.music.play, (msg, kwargs, argv) => {
            let vc = msg.member.voiceChannel;
            let url = kwargs['url'];
            if (!vc)
                return 'You are not connected to a VoiceChannel';
            if (!url)
                return servercmd.music.play.response.no_url;
            if (!url.match(/http/g)) {
                if (argv)
                    url += ' ' + argv.join(' ');
                this.db.get('SELECT url FROM playlists WHERE name = ?', [url], (err, row) => {
                    if (err) {
                        console.error(err.message);
                    }
                    if (!row) {
                        return servercmd.music.play.response.url_invalid;
                    }
                    url = row.url;
                    try {
                        this.connectAndPlay(vc, url);
                    } catch (err) {
                        logger.error(err.message);
                        return servercmd.music.play.response.failure;
                    }
                });
            } else {
                try {
                    this.connectAndPlay(vc, url);
                } catch (err) {
                    logger.error(err.message);
                    return servercmd.music.play.response.failure;
                }
            }
            return servercmd.music.play.response.success;
        });

        // playnext command
        this.servant.createCommand(servercmd.music.playnext,(msg, kwargs, argv) => {
            let vc = msg.member.voiceChannel;
            if (!this.dj.connected) this.dj.voiceChannel = vc;
            let url = kwargs['url'];
            if (!url) return servercmd.music.playnext.response.no_url;
            if (!url.match(/http/g)) {
                if (argv)
                    url += ' ' + argv.join(' ');
                this.db.get('SELECT url FROM playlists WHERE name = ?', [url], (err, row) => {
                    if (err) {
                        console.error(err.message);
                    }
                    if (!row) {
                        return servercmd.music.play.response.url_invalid;
                    }
                    url = row.url;
                    try {
                        this.dj.playYouTube(url, true);
                    } catch (err) {
                        logger.error(err.message);
                        return servercmd.music.play.response.failure;
                    }
                });
            } else {
                try {
                    this.dj.playYouTube(url, true);
                } catch (err) {
                    logger.error(err);
                    return servercmd.music.playnext.response.failure;
                }
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
        this.servant.createCommand(servercmd.music.save, (msg, kwargs, argv) => {
            let saveName = argv.join(' ');
            this.db.get('SELECT COUNT(*) count FROM playlists WHERE name = ?', [saveName], (err, row) => {
                if(err) {
                    logger.error(err.message);
                }
                if (!row || row.count === 0) {
                    this.db.run('INSERT INTO playlists (name, url) VALUES (?, ?)', [saveName, kwargs.url], (err) => {
                        if (err)
                            logger.error(err.message);
                    });
                } else {
                    this.db.run('UPDATE playlists SET url = ? WHERE name = ?', [kwargs.url, saveName], (err) => {
                        if (err)
                            logger.error(err.message);
                    });
                }
            });
            return `Saved song/playlist as ${saveName}`
        });

        // saved command - prints out saved playlists
        this.servant.createCommand(servercmd.music.saved, (msg) => {
            let response = '```markdown\nSaved Playlists:\n==\n';
            this.db.all('SELECT name, url FROM playlists', (err, rows) => {
                if (err)
                    logger.error(err.message);
                for (let row of rows) {
                    response += `${row.name.padEnd(10, ' ')}: ${row.url} \n\n`;
                }
                response += '```';
                if (rows.length === 0)
                    msg.channel.send(servercmd.music.saved.response.no_saved);
                else
                    msg.channel.send(response);
            });
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