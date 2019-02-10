const cmd = require('./cmd'),
    music = require('./music'),
    utils = require('./utils'),
    config = require('../config.json'),
    sqliteAsync = require('./sqliteAsync'),
    fs = require('fs-extra'),
    servercmd = require('../commands/servercommands'),
    Discord = require('discord.js'),
    waterfall = require('promise-waterfall'),
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
    }

    async initDatabase() {
        await fs.ensureDir(dataDir + '/gdb');
        this.db = new sqliteAsync.Database(`${dataDir}/gdb/${this.guild}.db`);
        await this.db.init();
        logger.debug(`Connected to the database for ${this.guild}`);
        await this.createTables();
        // register commands
        this.registerCommands();
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
    async createTables() {
        await this.db.run(`${utils.sql.tableExistCreate} messages (
            ${utils.sql.pkIdSerial},
            creation_timestamp DATETIME NOT NULL,
            author VARCHAR(128) NOT NULL,
            author_name VARCHAR(128),
            content TEXT NOT NULL
        )`);
        await this.db.run(`${utils.sql.tableExistCreate} playlists (
            ${utils.sql.pkIdSerial},
            name VARCHAR(32) UNIQUE NOT NULL,
            url VARCHAR(255) NOT NULL
        )`);
        await this.db.run(`${utils.sql.tableExistCreate} commands (
            ${utils.sql.pkIdSerial},
            name VARCHAR(32) UNIQUE NOT NULL,
            command VARCHAR(255) NOT NULL
        )`);
    }

    /**
     * Answers a message via mention if mentioning is active or with just sending it to the same channel.
     * @param msg
     * @param answer
     */
    async answerMessage(msg, answer) {
        if (answer instanceof Promise || answer)
            if (answer instanceof Discord.RichEmbed) {
                (this.mention) ? msg.reply('', answer) : msg.channel.send('', answer);
            } else if (answer instanceof Promise) {
                let resolvedAnswer = await answer;
                await this.answerMessage(msg, resolvedAnswer);
            } else if (answer instanceof  Array) {
                await waterfall(answer.map((x) => async () => await this.answerMessage(msg, x)));
            } else if ({}.toString.call(answer) === '[object Function]') {  // check if the answer is of type function
                await this.answerMessage(msg, answer());
            } else {
                (this.mention) ? msg.reply(answer) : msg.channel.send(answer);
            }
    }

    /**
     * handles the message by letting the servant parse the command. Depending on the message setting it
     * replies or just sends the answer.
     * @param msg
     */
    async handleMessage(msg) {
        if (this.db)
            await this.db.run(
                'INSERT INTO messages (author, creation_timestamp, author_name, content) values (?, ?, ?, ?)',
                [msg.author.id, msg.createdTimestamp, msg.author.username, msg.content]
            );
       await this.answerMessage(msg, this.servant.parseCommand(msg));
    }

    /**
     * Connect to a voice-channel if not connected and play the url
     * @param vc
     * @param url
     * @param next
     */
    async connectAndPlay(vc, url, next) {
        if (!this.dj.connected) {
            await this.dj.connect(vc);
            await this.dj.playYouTube(url, next);
        } else {
            await this.dj.playYouTube(url, next);
        }
    }

    /**
     * registers all music commands and initializes a dj
     */
    registerCommands() {
        this.dj = new music.DJ();

        let playCb = async (msg, kwargs, argv, template, next) => {
            let vc = this.dj.voiceChannel || msg.member.voiceChannel;
            let url = kwargs['url'];
            if (!vc)
                return template.response.no_voicechannel;
            if (!url)
                return template.response.no_url;
            if (!utils.YouTube.isValidEntityUrl(url)) {
                if (argv && argv.length > 0)
                    url += ' ' + argv.join(' ');    // join to get the whole expression behind the command
                let row = await this.db.get('SELECT url FROM playlists WHERE name = ?', [url]);
                if (!row) {
                    logger.debug('Got invalid url for play command.');
                    return template.response.url_invalid;
                } else {
                    await this.connectAndPlay(vc, row.url, next);
                    return template.response.success;
                }
            } else {
                await this.connectAndPlay(vc, url, next);
                return template.response.success;
            }
        };

        // play command
        this.servant.createCommand(servercmd.music.play, async (msg, kwargs, argv) => {
            return await playCb(msg, kwargs, argv, servercmd.music.play, false);
        });

        // playnext command
        this.servant.createCommand(servercmd.music.playnext, async (msg, kwargs, argv) => {
            return await playCb(msg, kwargs, argv, servercmd.music.playnext, true);
        });

        // join command
        this.servant.createCommand(servercmd.music.join, (msg) => {
            if (msg.member.voiceChannel)
                this.dj.connect(msg.member.voiceChannel);
             else
                return servercmd.music.join.response.not_connected;

        });

        // stop command
        this.servant.createCommand(servercmd.music.stop, () => {
            if (this.dj.connected) {
                this.dj.stop();
                return servercmd.music.stop.response.success;
            } else {
                return servercmd.music.stop.response.not_playing;
            }
        });

        // pause command
        this.servant.createCommand(servercmd.music.pause, () => {
            if (this.dj.playing) {
                this.dj.pause();
                return servercmd.music.pause.response.success;
            } else {
                return servercmd.music.pause.response.not_playing;
            }
        });

        // resume command
        this.servant.createCommand(servercmd.music.resume, () => {
            if (this.dj.playing) {
                this.dj.resume();
                return servercmd.music.resume.response.success;
            } else {
                return servercmd.music.resume.response.not_playing;
            }
        });

        // skip command
        this.servant.createCommand(servercmd.music.skip, () => {
            if (this.dj.playing) {
                this.dj.skip();
                return servercmd.music.skip.response.success;
            } else {
                return servercmd.music.skip.response.not_playing;
            }

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
            if (song)
                return new Discord.RichEmbed()
                    .setTitle('Now playing:')
                    .setDescription(`[${song.title}](${song.url})`)
                    .setImage(utils.YouTube.getVideoThumbnailUrlFromUrl(song.url))
                    .setColor(0x00aaff);
             else
                return servercmd.music.current.response.not_playing;

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

        // saves playlists and videos
        this.servant.createCommand(servercmd.music.savemedia, async (msg, kwargs, argv) => {
            let saveName = argv.join(' ');
            let row = await this.db.get('SELECT COUNT(*) count FROM playlists WHERE name = ?', [saveName]);
            if (!row || row.count === 0)
                await this.db.run('INSERT INTO playlists (name, url) VALUES (?, ?)', [saveName, kwargs.url]);
            else
                await this.db.run('UPDATE playlists SET url = ? WHERE name = ?', [kwargs.url, saveName]);
            return `Saved song/playlist as ${saveName}`;
        });

        // savedmedia command - prints out saved playlists and videos
        this.servant.createCommand(servercmd.music.savedmedia, async () => {
            let response = '';
            let rows = await this.db.all('SELECT name, url FROM playlists');
            for (let row of rows)
                response += `[${row.name}](${row.url})\n`;

            if (rows.length === 0)
                return servercmd.music.savedmedia.response.no_saved;
             else
                return new Discord.RichEmbed()
                    .setTitle('Saved Songs and Playlists')
                    .setDescription(response)
                    .setFooter(`Play a saved entry with ${this.prefix}play [Entryname]`)
                    .setTimestamp();
        });

        this.servant.createCommand(servercmd.music.deletemedia, async (msg, kwargs, argv) => {
            let saveName = argv.join(' ');
            if (!saveName) {
                return servercmd.music.deletemedia.response.no_name;
            } else {
                await this.db.run('DELETE FROM playlists WHERE name = ?', [saveName]);
                return `Deleted ${saveName} from saved media`;
            }
        });

        // savecmd - saves a command sequence with a name
        this.servant.createCommand(servercmd.utils.savecmd, async (msg, kwargs, argv) => {
            let saveName = argv.pop();
            if (argv.includes(this.prefix + servercmd.utils.execute.name)) {
                return servercmd.utils.savecmd.response.no_recursion;
            } else {
                let cmdsequence = argv.join(' ').replace(/\\/g, '');
                let row = await this.db.get('SELECT COUNT(*) count FROM commands WHERE name = ?', [saveName]);
                if (!row || row.count === 0)
                    await this.db.run('INSERT INTO commands (name, command) VALUES (?, ?)', [saveName, cmdsequence]);
                else
                    await this.db.run('UPDATE commands SET sequence = ? WHERE name = ?', [cmdsequence, saveName]);
                return `saved command sequence as ${saveName}`;
            }
        });

        // savedcmd - prints saved commands
        this.servant.createCommand(servercmd.utils.savedcmd, async () => {
            let response = new Discord.RichEmbed()
                .setTitle('Saved Commands')
                .setFooter(`Execute a saved entry with ${this.prefix}execute [Entryname]`)
                .setTimestamp();
            let rows = await this.db.all('SELECT name, command FROM commands');
            if (rows.length === 0)
                return servercmd.utils.savedcmd.response.no_commands;
            else
                for (let row of rows)
                    response.addField(row.name, '`' + row.command + '`');
            return response;
        });

        // deletecmd - deletes a command from saved commands
        this.servant.createCommand(servercmd.utils.deletecmd, async (msg, kwargs) => {
            await this.db.run('DELETE FROM commands WHERE name = ?', [kwargs.cmdname]);
            return `Deleted command ${kwargs.cmdname}`;
        });

        // execute - executes a saved command
        this.servant.createCommand(servercmd.utils.execute, async (msg, kwargs) => {
            let row = await this.db.get('SELECT command FROM commands WHERE name = ?', [kwargs.cmdname]);
            if (row) {
                msg.content = row.command;
                await this.handleMessage(msg);
            } else {
                return servercmd.utils.execute.response.not_found;
            }
        });
    }
};
