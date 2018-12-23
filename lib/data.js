/* Module definition */
const
    fs = require('fs'),
    path = require('path');

/* Variable Definition */
let logger = require('winston'),
    datapath = './data',
    entryfile = 'fileentries.json';

fs.exists(datapath, (exist) => {
    if (!exist) {
        fs.mkdir(datapath, (err) => {
            if (err)
                logger.warn(JSON.stringify(err));
        })
    }
});

/* Function Definition */

exports.DataHandler = class {
    constructor(name) {
        this.workingDir = path.join(datapath, name);
        this.fileEntries = {};
        this.fileData = {};
        fs.exists(this.workingDir, (exists) => {
            if (!exists) {
                fs.mkdir(this.workingDir, (err) => {
                    if (err)
                        logger.error(JSON.stringify(err));
                });
            }
        });
        if (fs.existsSync(this.getfp(entryfile))) {
            try {
                this.fileEntries = this.getJSONSync(entryfile);
            } catch (err) {
                logger.error(JSON.stringify(err));
            }
        }
    }

    /**
     * adds an entry to the fileEntries. refreshes the entrie file
     * @param name
     * @param path
     */
    addEntry(name, path) {
        this.fileEntries.name = path;
        this.refreshEntries();
    }

    /**
     * shortcut function to join the path with the working directory
     * @param file
     * @returns {Promise<VoiceConnection> | string}
     */
    getfp(file) {
        return path.join(this.workingDir, file);
    }

    /**
     * shortcut function that evokes the callback after reading the file. the files path is the name
     * joined with the working directory
     * @param file
     * @param callback
     */
    getcont(file, callback) {
        fs.readFile(this.getfp, 'utf-8', callback);
    }

    /**
     * returns the JSON content of a file in the working directory
     * @param file
     * @returns {any}
     */
    getJSONSync(file) {
        return JSON.parse(fs.readFileSync(this.getfp(file), 'utf-8'));
    }

    /**
     * writes all entris of the fileEntries variable into the fileEntries file.
     */
    refreshEntries() {
        fs.writeFile(this.getfp(entryfile), JSON.stringify(this.fileEntries), (err) => {
            if (err)
                logger.warn(JSON.stringify(err));
        });
    }

    /**
     * returns the data for the entry <name>
     * @param name
     * @returns {*}
     */
    getData(name) {
        try {
            if (this.fileData[name])
                return this.fileData[name];
            else if (this.fileEntries[name]) {
                this.fileData[name] = this.getJSONSync(this.fileEntries[name]);
                return this.fileData[name];
            }
            return {};
        } catch (err) {
            logger.error(JSON.stringify(err));
        }
    }

    /**
     * sets the entry <name> to data
     * @param name
     * @param data
     */
    setData(name, data) {
        this.fileData[name] = data;
        if (!this.fileEntries[name]) {
            this.fileEntries[name] = name + '.json';
        }
        this.refreshEntries();
        fs.writeFile(this.getfp(this.fileEntries[name]), JSON.stringify(this.fileData[name]), (err) => {
            if (err)
                logger.warn(JSON.stringify(err));
        });
    }
};

/**
 * Getting the logger
 * @param {Object} newLogger
 */
exports.setLogger = function (newLogger) {
    logger = newLogger;
};