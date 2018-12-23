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