const music = require('./MusicLib'),
    utils = require('./utils'),
    config = require('../config.json'),
    sqliteAsync = require('./sqliteAsync'),
    fs = require('fs-extra'),
    dataDir = config.dataPath || './data';

let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
    music.setLogger(logger);
};

/**
 * The Guild Handler handles guild settings and data.
 * @type {GuildHandler}
 */
class GuildHandler {

    constructor(guild) {
        this.guild = guild;
        this.musicPlayer = new music.MusicPlayer(null);
    }

    /**
     * Initializes the database
     * @returns {Promise<void>}
     */
    async initDatabase() {
        await fs.ensureDir(dataDir + '/gdb');
        this.db = new sqliteAsync.Database(`${dataDir}/gdb/${this.guild}.db`);
        await this.db.init();
        logger.debug(`Connected to the database for ${this.guild}`);
        await this.createTables();
    }

    /**
     * Destroys the guild handler
     */
    destroy() {
        this.musicPlayer.stop();
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
}

Object.assign(exports, {
    GuildHandler: GuildHandler
});
