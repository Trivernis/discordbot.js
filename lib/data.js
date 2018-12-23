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

    addEntry(name, path) {
        this.fileEntries.name = path;
        this.refreshEntries();
    }

    getfp(file) {
        return path.join(this.workingDir, file);
    }

    getcont(file, callback) {
        fs.readFile(this.getfp, 'utf-8', callback);
    }

    getJSONSync(file) {
        return JSON.parse(fs.readFileSync(this.getfp(file), 'utf-8'));
    }

    refreshEntries() {
        fs.writeFile(this.getfp(entryfile), JSON.stringify(this.fileEntries), (err) => {
            if (err)
                logger.warn(JSON.stringify(err));
        });
    }

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