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
    if (!filename) return null;
    try {
        let exts = filename.match(/\.[a-z]+/g); // get the extension by using regex
        if (exts) return exts[exts.length - 1]; // return the found extension
        else return null; // return null if no extension could be found
    } catch (error) {
        console.error(error);
        return null;
    }
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

exports.YouTube = class {
    /**
     * returns if an url is a valid youtube url (without checking for an entity id)
     * @param url
     * @returns {boolean}
     */
    static isValidUrl(url) {
        return /https?:\/\/www.youtube.com\/(watch\?v=|playlist\?list=)/g.test(url) ||
            /https?:\/\/youtu.be\//g.test(url);
    }

    /**
     * returns if an url is a valid youtube url for an entity
     * @param url
     * @returns {boolean}
     */
    static isValidEntityUrl(url) {
        return /https?:\/\/www.youtube.com\/(watch\?v=.+?|playlist\?list=.+?)/g.test(url) ||
            /https?:\/\/youtu.be\/.+?/g.test(url);
    }

    /**
     * Returns if an url is a valid youtube url for a playlist
     * @param url
     * @returns {boolean}
     */
    static isValidPlaylistUrl(url) {
        return /https?:\/\/www.youtube.com\/playlist\?list=.+?/g.test(url);
    }

    /**
     * Returns if an url is a valid youtube url for a video
     * @param url
     * @returns {boolean}
     */
    static isValidVideoUrl(url) {
        return /https?:\/\/www.youtube.com\/watch\?v=.+?/g.test(url) || /https?:\/\/youtu.be\/.+?/g.test(url);
    }

    /**
     * Returns the id for a youtube video stripped from the url
     * @param url
     * @returns {RegExpMatchArray}
     */
    static getPlaylistIdFromUrl(url) {
        let matches = url.match(/(?<=\?list=)[\w\-]+/);
        if (matches)
            return matches[0];
        else
            return null;
    }

    /**
     * Returns the id for a youtube video stripped from the url
     * @param url
     */
    static getVideoIdFromUrl(url) {
        let matches = url.match(/(?<=\?v=)[\w\-]+/);
        if (matches)
            return matches[0];
        else
            return null;
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