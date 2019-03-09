/**
 * Returns types based on the database.
 */
class GenericTypes {
    /**
     * Constructor.
     * @param database {String}
     */
    constructor(database) {
        this.database = database;
    }

    get null() {
        switch(this.database) {
            case 'postgresql':
            case 'sqlite':
            default:
                return 'NULL';
        }
    }

    get integer() {
        switch(this.database) {
            case 'postgresql':
            case 'sqlite':
            default:
                return 'INTEGER';
        }
    }

    get real() {
        switch(this.database) {
            case 'sqlite':
                return 'REAL';
            case 'postgresql':
            default:
                return 'FLOAT';
        }
    }

    get text() {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
            default:
                return 'TEXT';
        }
    }

    get varchar() {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
            default:
                return 'VARCHAR';
        }
    }

    get date() {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
            default:
                return 'DATE';
        }
    }

    get datetime() {
        switch (this.database) {
            case 'postgresql':
                return 'TIMESTAMP';
            case 'sqlite':
            default:
                return 'DATETIME';
        }
    }

    get serial() {
        switch (this.database) {
            case 'sqlite':
                return 'INTEGER AUTOINCREMENT NOT NULL';
            case 'postgresql':
            default:
                return 'SERIAL';
        }
    }

    /**
     * Returns the VARCHAR type with the specified length.
     * @param length {Number}
     */
    getVarchar(length) {
        return `${this.varchar}(${length})`;
    }
}

/**
 * Returns sql statements based on the database.
 */
class GenericSql {
    /**
     * Constructor.
     * @param database {String}
     */
    constructor(database) {
        this.database = database;
        this.types = new GenericTypes(database);
        this.constraints = {
            primaryKey: 'PRIMARY KEY',
            notNull: 'NOT NULL',
            unique: 'UNIQUE',
            like: 'LIKE',
            exists: 'EXISTS',
            and: 'AND',
            or: 'OR',
            in: 'IN',
            any: 'ANY',
            all: 'ALL'
        };
    }

    /**
     * A sum selector - calculates the sum of all values of the column
     * @param colname {String} - the name of the column where the sum is selected.
     * @returns {string}
     */
    sum(colname) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `SUM(${colname})`;
        }
    }

    /**
     * A avg selector - selects the average
     * @param colname {String} - the name of the column where the avg value is selected.
     * @returns {string}
     */
    avg(colname) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `AVG(${colname})`;
        }
    }

    /**
     * A min selector - selects the minimum
     * @param colname {String} - the name of the column where the min value is selected.
     * @returns {string}
     */
    min(colname) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `MIN(${colname})`;
        }
    }

    /**
     * A max selector - selects the maximum
     * @param colname {String} - the name of the column where the max value is selected.
     * @returns {string}
     */
    max(colname) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `MAX(${colname})`;
        }
    }

    /**
     * A count selector - counts the results
     * @param colname {String} - the name of the column to be counted.
     * @returns {string}
     */
    count(colname) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `COUNT(${colname})`;
        }
    }

    /**
     * A default constraint
     * @param expression {String} - the expression to generate the default value.
     * @returns {string}
     */
    default(expression) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `DEFAULT ${expression}`;
        }
    }

    /**
     * A where statement
     * @param row {String} - the row
     * @param operator {String} - the comparison operator
     * @param comparator {String} the value or row to compare to
     */
    and(row, operator, comparator) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `AND ${row} ${operator} ${comparator}`;
        }
    }

    /**
     * A or statement
     * @param row {String} - the row
     * @param operator {String} - the comparison operator
     * @param comparator {String} the value or row to compare to
     */
    or(row, operator, comparator) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `OR ${row} ${operator} ${comparator}`;
        }
    }

    /**
     * A where statement
     * @param row {String} - the row
     * @param operator {String} - the comparison operator
     * @param comparator {String} the value or row to compare to
     */
    where(row, operator, comparator) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `WHERE ${row} ${operator} ${comparator}`;
        }
    }

    /**
     * Create Table statement
     * @param table {String}
     * @param rows {Array<Column>}
     * @returns {string}
     */
    createTable(table, rows) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `CREATE TABLE ${table} (${rows.map(x => x.sql).join(',')})`;
        }
    }

    /**
     * Create Table if it doesn't exist statement
     * @param table {String}
     * @param columns {Array<Column>}
     * @returns {string}
     */
    createTableIfNotExists(table, columns) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `CREATE TABLE IF NOT EXISTS ${table} (${columns.map(x => x.sql).join(',')})`;
        }
    }

    /**
     * Insert into the table.
     * @param table {String} - the table name
     * @param colValueObj {Object} - an object with keys as columnnames and values as columnvalues
     * @returns {string}
     */
    insert(table, colValueObj) {
        let rownames = Object.keys(colValueObj);
        let values = Object.values(colValueObj);
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `INSERT INTO ${table} (${rownames.join(',')}) values (${values.join(',')})`;
        }
    }

    /**
     * Updates the table with the rowValueObject.
     * @param table {String} - the table name
     * @param colValueObj {Object} - an object with keys as columnnames and values as columnvalues
     * @param conditions {Array<String>} - conditions for the update row selection (WHERE ... [OR ...][AND ...]
     * @returns {string}
     */
    update(table, colValueObj, conditions) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `UPDATE ${table} SET ${Object.entries(colValueObj).map(x => `${x[0]} = ${x[1]}`).join(',')} ${conditions.join(' ')}`;
        }
    }

    /**
     * Selects from a table
     * @param table {String} - the tablename
     * @param distinct {String|boolean} - should distinct values be selected? If yes provide distinct keyword.
     * @param colnames {Array<String>} - the rows to select
     * @param conditions {Array<String>} - conditions for the row selection (WHERE ... [OR ...][AND ...]
     * @param operations {Array<String>} - operations on the selected rows
     * @returns {String}
     */
    select(table, distinct, colnames, conditions, operations) {
        switch (this.database) {
            case 'postgresql':
            case 'sqlite':
                return `SELECT${distinct? ' ' + distinct : ''} ${colnames.join(' ')} FROM ${table} ${conditions.join(' ')} ${operations.join(' ')}`;
        }
    }
}

class Column {
    /**
     * Create a column for usage in the generic sql statements
     * @param name {String}
     * @param [type] {String}
     * @param [constraints] {Array<String>}
     */
    constructor(name, type, constraints) {
        this.name = name;
        this.type = type;
        this.constraints = constraints || [];
    }

    /**
     * Sets the datatype of the row.
     * @param constraint {String}
     */
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    get sql() {
        return `${this.name} ${this.type} ${this.constraints.join(',')}`;
    }
}

Object.assign(exports, {
    GenericSql: GenericSql,
    GenericTypes: GenericSql,
    Column: Column
});
