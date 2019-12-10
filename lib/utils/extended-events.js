const logging = require('../utils/logging'),
    EventEmitter = require('events');

/**
 * Extends the event emitter with some useful features.
 */
class ExtendedEventEmitter extends EventEmitter {

    /**
     * Constructor.
     * @param [name] {String}
     */
    constructor(name) {
        super();
        this._logger = new logging.Logger(`${name}-${this.constructor.name}`);
        this._registerDefault();
    }

    /**
     * Registeres the error event to the logger so it won't crash the bot.
     * @private
     */
    _registerDefault() {
        this.on('error', (err) => {
            this._logger.error(err.message);
            this._logger.debug(err.stack);
        });
    }

    /**
     * Adds an object of events with listeners to the bot.
     * @param eventListenerObject
     * @returns {ExtendedEventEmitter}
     */
    addListeners(eventListenerObject) {
        for (let [event, listener] of Object.entries(eventListenerObject))
            this.on(event, listener);
        return this;
    }

    /**
     * Returns all registered events.
     * @returns {*|Array<string | symbol>|string[]}
     */
    get events() {
        return this.eventNames();
    }

    /**
     * Wrapper around getMaxListeners function
     * @returns {*|number}
     */
    get maxListeners() {
        return this.getMaxListeners();
    }

    /**
     * Wrapper around setMaxListeners function.
     * @param n
     * @returns {this | this | Cluster | *}
     */
    set maxListeners(n) {
        return this.setMaxListeners(n);
    }

    /**
     * Returns if the emitter has additional listeners apart from the error listener.
     */
    get hasListeners() {
        return this.events.count > 1;
    }
}

Object.assign(exports, {
    ExtendedEventEmitter: ExtendedEventEmitter,
});
