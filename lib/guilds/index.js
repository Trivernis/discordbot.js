const music = require('../music'),
    utils = require('../utils'),
    config = require('../../config.json'),
    dblib = require('../database'),
    logging = require('../utils/logging'),
    fs = require('fs-extra'),
    dataDir = config.dataPath || './data';

/**
 * GuildDatabase class has abstraction for some sql statements.
 */
class GuildDatabase extends dblib.Database {

    /**
     * Constructor.
     * @param name
     */
    constructor(name) {
        super(name);
    }

    /**
     * Creates all tables needed in the guilds Database.
     */
    async createTables() {
        let sql = this.sql;
        await this.run(sql.createTableIfNotExists('playlists', [
            sql.templates.idcolumn,
            new dblib.Column('name', sql.types.getVarchar(32), [sql.constraints.unique, sql.constraints.notNull]),
            new dblib.Column('url', sql.types.getVarchar(255), [sql.constraints.notNull])
        ]));
        this._logger.silly('Created Table playlists.');
        await this.run(sql.createTableIfNotExists('commands', [
            sql.templates.idcolumn,
            new dblib.Column('name', sql.types.getVarchar(32), [sql.constraints.unique, sql.constraints.notNull]),
            new dblib.Column('command', sql.types.getVarchar(255), [sql.constraints.notNull])
        ]));
        this._logger.silly('Created Table commands.');
        await this.run(sql.createTableIfNotExists('settings', [
            sql.templates.idcolumn,
            new dblib.Column('key', sql.types.getVarchar(32), [sql.constraints.unique, sql.constraints.notNull]),
            new dblib.Column('value', sql.types.getVarchar(32), [])
        ]));
        this._logger.silly('Created Table settings.');
    }

    /**
     * Returns the value of the column where the key has the value keyvalue
     * @param table {String} - the table name
     * @param column {String} - the name of the column
     * @param keyname {String} - the name of the key
     * @param keyvalue {*} - the value of the key
     * @returns {Promise<*>}
     */
    async getSingleValue(table, column, keyname, keyvalue) {
        let result = await this.get(this.sql.select(table, false, column,
            this.sql.where(this.sql.parameter(1), '=', this.sql.parameter(2))),
            [keyname, keyvalue]);
        if (result)
            return result[column];
        else
            return null;
    }

    /**
     * Returns either the whole table or a limited version
     * @param tablename
     * @param limit
     * @returns {Promise<void>}
     */
    async getTableContent(tablename, limit) {
        if (limit)
            return await this.all(this.sql.select(tablename, false, ['*'], [], [
                this.sql.limit(limit)
            ]));
        else
            return await this.all(this.sql.select(tablename, false, ['*'], [], []));
    }

    /**
     * Get the value of a setting
     * @param name
     * @returns {Promise<*>}
     */
    async getSetting(name) {
        let result = await this.get(this.sql.select('settings', false, 'value',
            this.sql.where('key', '=', this.sql.parameter(1))), [name]);
        if (result)
            return result.value;
        else
            return null;
    }

    /**
     * Get all settings as object.
     * @returns {Promise<void>}
     */
    async getSettings() {
        let rows = await this.all(this.sql.select('settings', false, ['key', 'value'], [], []));
        let retObj = {};
        if (rows)
            for (let row of rows)
                retObj[row.key] = row.value;
        return retObj;
    }

    /**
     * Insert or update a setting parameter in the settings database.
     * @param name
     * @param value
     * @returns {Promise<void>}
     */
    async setSetting(name, value) {
        let row = await this.get(this.sql.select('settings', false, [this.sql.count('*')],
            this.sql.where('key', '=', this.sql.parameter(1))), [name]);
        if (!row || Number(row.count) === 0)
            await this.run(this.sql.insert('settings', {key: this.sql.parameter(1), value: this.sql.parameter(2)}),
                [name, value]);
        else
            await this.run(this.sql.update('settings', {value: this.sql.parameter(1)},
                this.sql.where('key', '=', this.sql.parameter(2))), [value, name]);
    }
}

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
        this._votes = {};
        this.settings = {};
    }

    /**
     * Initializes the database
     * @returns {Promise<void>}
     */
    async initDatabase() {
        this._logger.silly('Initializing Database');
        this.db = new GuildDatabase(`guild_${this.guild.name.replace(/\s/g, '_').replace(/\W/g, '')}`);
        await this.db.initDatabase();
        this._logger.debug(`Connected to the database for ${this.guild}`);
        this._logger.debug('Creating Databases');
        await this.db.createTables();
    }

    /**
     * Applies all relevant guild settings.
     * @returns {Promise<void>}
     */
    async applySettings() {
        this.settings = await this.db.getSettings();
        this.musicPlayer.quality = this.settings.musicPlayerQuality || 'lowest';
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
     * Sets the vote counter for a command up and adds the user.
     * @param command {String}
     * @param user {String}
     */
    updateCommandVote(command, user) {
        if (!this._votes[command])
            this._votes[command] = {count: 0, users: []};
        if (!this._votes[command].users.includes(user)) {
            this._votes[command].count++;
            this._votes[command].users.push(user);
        }
        return this._votes[command];
    }

    /**
     * Resets the vote counter and voted users for a command.
     * @param command {String}
     */
    resetCommandVote(command) {
        this._votes[command] = {count: 0, users: []};
    }
}

Object.assign(exports, {
    GuildHandler: GuildHandler
});
