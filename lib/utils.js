/**
 * A Series of utility functions
 */
const fs = require('fs');

function noOp() {
}

let sysdataPath = './res/data/sys.json';
let sysData = {};

/**
 * returns the extension of a file for the given filename.
 * @param  {String} filename The name of the file.
 * @return {String}          A string that represents the file-extension.
 */
exports.getExtension = function (filename) {
    if (!filename)
        return null;
    try {
        let exts = filename.match(/\.\w+/g); // get the extension by using regex
        if (exts)
            return exts.pop(); // return the found extension
        else
            return null; // return null if no extension could be found
    } catch (error) {
        console.error(error);
        return null;
    }
};

/**
 * Walks the path to the objects attribute and returns the value.
 * @param object
 * @param attributePath
 * @returns {undefined/Object}
 */
exports.objectDeepFind = function (object, attributePath) {
  let current = object,
    paths = attributePath.split('.');
  for (let path of paths) {
      if (current[path] !== undefined && current[path] !== null)
          current = current[path];
      else
          return undefined;
  }
  return current;
};

/**
 * lets you define a cleanup for your program exit
 * @param       {Function} callback the cleanup function
 * @constructor
 * @author CanyonCasa & Pier-Luc Gendreau on StackOverflow
 */
exports.Cleanup = function Cleanup(callback) {

    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || noOp;
    process.on('cleanup', callback);

    // do app specific cleaning before exiting
    process.on('exit', function () {
        process.emit('cleanup');
    });

    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
        console.log('Ctrl-C...');
        process.exit(2);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function (e) {
        console.log('Uncaught Exception...');
        console.log(e.stack);
        process.exit(99);
    });
};

/* FS */

exports.dirExistence = function (path, callback) {
    fs.exists(path, (exist) => {
        if (!exist) {
            fs.mkdir(path, (err) => {
                if (!err)
                    callback();
            });
        } else {
            callback();
        }
    })
};

/* Classes */

exports.YouTube = class {
    /**
     * returns if an url is a valid youtube url (without checking for an entity id)
     * @param url
     * @returns {boolean}
     */
    static isValidUrl(url) {
        return /https?:\/\/(www\.)?youtube\.com\/(watch\?v=|playlist\?list=)/g.test(url) ||
            /https?:\/\/youtu\.be\//g.test(url);
    }

    /**
     * returns if an url is a valid youtube url for an entity
     * @param url
     * @returns {boolean}
     */
    static isValidEntityUrl(url) {
        return /https?:\/\/(www\.)?youtube\.com\/(watch\?v=.+?|playlist\?list=.+?)/g.test(url) ||
            /https?:\/\/youtu\.be\/.+?/g.test(url);
    }

    /**
     * Returns if an url is a valid youtube url for a playlist
     * @param url
     * @returns {boolean}
     */
    static isValidPlaylistUrl(url) {
        return /https?:\/\/(www\.)?youtube\.com\/playlist\?list=.+?/g.test(url);
    }

    /**
     * Returns if an url is a valid youtube url for a video
     * @param url
     * @returns {boolean}
     */
    static isValidVideoUrl(url) {
        return /https?:\/\/(www\.)?youtube\.com\/watch\?v=.+?/g.test(url) || /https?:\/\/youtu\.be\/.+?/g.test(url);
    }

    /**
     * Returns the id for a youtube video stripped from the url
     * @param url
     * @returns {String}
     */
    static getPlaylistIdFromUrl(url) {
        if (!exports.YouTube.isValidPlaylistUrl(url))
            return null;
        let matches = url.match(/(?<=\?list=)[\w\-]+/);
        if (matches)
            return matches[0];
        else
            return null;
    }

    /**
     * Returns the id for a youtube video stripped from the url
     * @param url
     * @return {String}
     */
    static getVideoIdFromUrl(url) {
        if (!exports.YouTube.isValidVideoUrl(url))
            return null;
        let matches1 = url.match(/(?<=\?v=)[\w\-]+/);
        if (matches1)
            return matches1[0];
        else {
            let matches2 = url.match(/(?<=youtu\.be\/)[\w\-]+/);
            if (matches2)
                return matches2[0];
            else
                return null;
        }
    }

    /**
     * Returns the youtube video url for a video id by string concatenation
     * @param id
     */
    static getVideoUrlFromId(id) {
        return `https://www.youtube.com/watch?v=${id}`;
    }

    /**
     * Returns the youtube video thumbnail for a video url
     * @param url
     * @returns {string}
     */
    static getVideoThumbnailUrlFromUrl(url) {
        return `https://i3.ytimg.com/vi/${exports.YouTube.getVideoIdFromUrl(url)}/maxresdefault.jpg`
    }
};

exports.ConfigVerifyer = class {
    /**
     * @param confObj
     * @param required {Array}  the attributes that are required for the bot to work
     */
    constructor(confObj, required) {
        this.config = confObj;
        this.requiredAttributes = required;
    }

    /**
     * @param promtMissing {Boolean} true - everything is fine; false - missing attributes
     */
    verifyConfig(logger) {
        let missing = [];
        for (let reqAttr of this.requiredAttributes) {
            if (exports.objectDeepFind(this.config, reqAttr) === undefined)
                missing.push(reqAttr);
        }
        this.missingAttributes = missing;
        this.logMissing(logger);
        return this.missingAttributes.length === 0;
    }

    /**
     * Promts the user which attributes are missing
     * @param logger
     */
    logMissing(logger) {
        if (this.missingAttributes.length > 0) {
            logger.error(`Missing required Attributes ${this.missingAttributes.join(', ')}`);
        }
    }
};