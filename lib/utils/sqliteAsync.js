const sqlite3 = require('sqlite3');

/**
 * Promise function wrappers for sqlite3
 * @type {Database}
 */
exports.Database = class {
    constructor(path) {
        this.path = path;
        this.database = null;
    }

    /**
     * Promise wrapper for sqlite3/Database constructor
     * @returns {Promise<any>}
     */
    init() {
        return new Promise((resolve, reject) => {
            this.database = new sqlite3.Database(this.path, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    /**
     * Promise wrapper for sqlite3/Database run
     * @param SQL
     * @param values
     * @returns {Promise<any>}
     */
    run(SQL, values) {
        return new Promise((resolve, reject) => {
            if (values !== null && values instanceof Array)
                this.database.run(SQL, values, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
             else
                this.database.run(SQL, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });

        });
    }

    /**
     * Promise wrapper for sqlite3/Database get
     * @param SQL
     * @param values
     * @returns {Promise<any>}
     */
    get(SQL, values) {
        return new Promise((resolve, reject) => {
            if (values !== null && values instanceof Array)
                this.database.get(SQL, values, (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            else
                this.database.get(SQL, (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });

        });
    }

    /**
     * Promise wrapper for sqlite3/Database all
     * @param SQL
     * @param values
     * @returns {Promise<any>}
     */
    all(SQL, values) {
        return new Promise((resolve, reject) => {
            if (values !== null && values instanceof Array)
                this.database.all(SQL, values, (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            else
                this.database.all(SQL, (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });

        });
    }

    /**
     * Wrapper for sqlite3/Database close
     */
    close() {
        this.database.close();
    }
};
