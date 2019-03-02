const music = require('./MusicLib'),
    utils = require('./utils'),
    config = require('../config.json'),
    sqliteAsync = require('./sqliteAsync'),
    logging = require('./logging'),
    fs = require('fs-extra'),
    dataDir = config.dataPath || './data';

/**
 * The Guild Handler handles guild settings and data.
 * @type {GuildHandler}
 */
class GuildHandler {

    constructor(guild) {
        this.guild = guild;
        this._logger = new logging.Logger(`${this.constructor.name}@${this.guild}`);
        this.musicPlayer = new music.MusicPlayer(null);
        this._logger.silly('Initialized Guild Handler');
    }

    /**
     * Initializes the database
     * @returns {Promise<void>}
     */
    async initDatabase() {
        this._logger.silly('Initializing Database');
        await fs.ensureDir(dataDir + '/gdb');
        this.db = new sqliteAsync.Database(`${dataDir}/gdb/${this.guild}.db`);
        await this.db.init();
        this._logger.debug(`Connected to the database for ${this.guild}`);
        this._logger.debug('Creating Databases');
        await this.createTables();
    }

    /**
     * Destroys the guild handler
     */
    destroy() {
        this._logger.debug('Ending musicPlayer');
        this.musicPlayer.stop();
        this._logger.debug('Ending Database');
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
        this._logger.silly('Created Table messages');
        await this.db.run(`${utils.sql.tableExistCreate} playlists (
            ${utils.sql.pkIdSerial},
            name VARCHAR(32) UNIQUE NOT NULL,
            url VARCHAR(255) NOT NULL
        )`);
        this._logger.silly('Created Table playlists');
        await this.db.run(`${utils.sql.tableExistCreate} commands (
            ${utils.sql.pkIdSerial},
            name VARCHAR(32) UNIQUE NOT NULL,
            command VARCHAR(255) NOT NULL
        )`);
        this._logger.silly('Created Table commands');
    }
}

Object.assign(exports, {
    GuildHandler: GuildHandler
});
