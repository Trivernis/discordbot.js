const genericSql = require('../utils/genericSql'),
    logging = require('../utils/logging'),
    config = require('../../config.json');

class Database {
    /**
     * Creates a new database.
     * @param name {String} - the name of the database.
     */
    constructor(name) {
        this.name = name;
        this._logger = new logging.Logger(`Database@${name}`);
        this._dbType = config.database? config.database : 'sqlite';
        if (this._dbType === 'sqlite')
            this.database = new (require('../utils/sqliteAsync')).Database(`./data/${this.name}.db`);
        else if (this._dbType === 'postgresql')
            this.database = new (require('pg')).Pool({
                user: config.databaseConnection.user,
                host: config.databaseConnection.host,
                database: config.databaseConnection.database,
                password: config.databaseConnection.password,
                port: config.databaseConnection.port
            });
        this.sql = new genericSql.GenericSql(this._dbType);
    }

    /**
     * Initializes the database.
     * @returns {Promise<void>}
     */
    async initDatabase() {
        if (this._dbType === 'sqlite') {
            await this.database.init();
        } else if (this._dbType === 'postgresql') {
            await this.database.connect();
            await this.begin();
            await this.database.query(`CREATE SCHEMA IF NOT EXISTS ${this.name.replace(/\W/g, '')}`);
            await this.database.query(`SET search_path TO ${this.name.replace(/\W/g, '')}`);
            await this.commit();
        }
        this._logger.verbose(`Connected to ${this._dbType} database ${this.name}`);
    }

    /**
     * Run a sql statement with seperate values and no return.
     * Autocommit.
     * @param sql {String}
     * @param [values] {Array<String|Number>}
     * @returns {Promise<*>}
     */
    async run(sql, values) {
        this._logger.debug(`Running SQL "${sql}" with values ${values}`);
        if (this._dbType === 'sqlite')
            await this.database.run(sql, values);
         else if (this._dbType === 'postgresql')
            try {
                await this.begin();
                await this.database.query(sql, values);
                await this.commit();
            } catch (err) {
                this._logger.error(err.message);
                this._logger.verbose(err.stack);
                await this.rollback();
            }
    }

    /**
     * Begin. Part of Postgresqls BEGIN / COMMIT / ROLLBACK
     * @returns {Promise<void>}
     */
    async begin() {
        if (this._dbType === 'postgresql') {
            await this.database.query('BEGIN');
            await this.database.query(`SET search_path TO ${this.name.replace(/\W/g, '')};`);
        }
    }

    /**
     * Add a query to the current changes. No autocommit (except on sqlite).
     * @param sql
     * @param values
     * @returns {Promise<void>}
     */
    async query(sql, values) {
        if (this._dbType === 'sqlite') {
            await this.run(sql, values);
        } else if (this._dbType === 'postgresql') {
            await this.database.query(sql, values);
            this._logger.debug(`Running SQL "${sql}" with values ${values}`);
        }
    }

    /**
     * Commit. Part of Postgresqls BEGIN / COMMIT / ROLLBACK.
     * Writes data to the database, ROLLBACK on error. (has no effect on sqlite)
     * @returns {Promise<void>}
     */
    async commit() {
        if (this._dbType === 'postgresql')
            try {
                await this.database.query('COMMIT');
            } catch (err) {
                await this.database.query('ROLLBACK');
                this._logger.error(err.message);
                this._logger.verbose(err.stack);
            }
    }

    /**
     * Rollback. Part of Postgresqls BEGIN / COMMIT / ROLLBACK.
     * Reverts changes done in the current commit. (has no effect on sqlite)
     * @returns {Promise<void>}
     */
    async rollback() {
        if (this._dbType === 'postgresql')
            this.database.query('ROLLBACK');
    }


    /**
     * Run a sql statement with seperate values and first result row as return.
     * @param sql {String} - the sql statement with escaped values ($1, $2... for postgres, ? for sqlite)
     * @param [values] {Array<String|Number>}
     * @returns {Promise<void>}
     */
    async get(sql, values) {
        this._logger.debug(`Running SQL "${sql}" with values ${values}`);
        let result = null;
        if (this._dbType === 'sqlite') {
            result =  await this.database.get(sql, values);
        } else if (this._dbType === 'postgresql') {
            await this.database.query(`SET search_path TO ${this.name.replace(/\W/g, '')};`);
            result = (await this.database.query({
                text: sql,
                values: values
            })).rows;
        }
        if (result instanceof Array && result.length > 0)
            return result[0];
        else
            return result;
    }

    /**
     * Run a sql statement with seperate values and all result rows as return.
     * @param sql {String} - the sql statement with escaped values ($1, $2... for postgres, ? for sqlite)
     * @param [values] {Array<String|Number>} - the seperate values
     * @returns {Promise<any>}
     */
    async all(sql, values) {
        this._logger.debug(`Running SQL "${sql}" with values ${values}`);
        if (this._dbType === 'sqlite') {
            return await this.database.all(sql, values);
        } else if (this._dbType === 'postgresql') {
            await this.database.query(`SET search_path TO ${this.name.replace(/\W/g, '')};`);
            return (await this.database.query({
                text: sql,
                values: values
            })).rows;
        }
    }

    /**
     * Closes the connection to the database.
     */
    close() {
        if (this._dbType === 'sqlite')
            this.database.close();
    }
}

Object.assign(exports, {
    Column: genericSql.Column,
    Database: Database
});
