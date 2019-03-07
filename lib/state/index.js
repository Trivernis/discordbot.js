const logging = require('../utils/logging');

class EventRouter {

    constructor() {
        this._logger = new logging.Logger(this);
        this.eventGroups = {};
    }

    /**
     * Fires an event of an event group with event data.
     * @param eventGroup {String}
     * @param eventName {String}
     * @param eventData {Object}
     */
    fireEvent(eventGroup, eventName, eventData) {
        if (this.eventGroups[eventGroup] instanceof EventGroup)
            this.eventGroups[eventGroup].fireEvent(eventName, eventData);
        return this;
    }

    /**
     * Adds an EventRoute to the EventRouter
     * @param group {EventGroup}
     */
    registerEventGroup(group) {
        this.eventGroups[group.name] = name;
    }

}

class EventGroup {

    /**
     * Creates a new EventGroup with the given name.
     * @param [name] {String}
     */
    constructor(name) {
        this._logger = new logging.Logger(this);
        this.name = name || this.constructor.name;
        this.events = {};
    }

    fireEvent(eventName, eventData) {
        if (this.events[eventName] instanceof Event)
            this.events[eventName].fire(eventData);
        return this;
    }

    /**
     * Registeres an Event to the EventGroup
     * @param event {Event}
     */
    registerEvent(event) {
        this.events[event.name] = event;
    }
}

class Event {

    /**
     * Creates a new Event with the given name.
     * @param name
     */
    constructor(name) {
        this._logger = new logging.Logger(this);
        this.name = name;
        this.handlers = [];
    }

    /**
     * Adds an event handler to the Event
     * @param handler {Function}
     */
    addHandler(handler) {
        this.handlers.push(handler);
        return this;
    }

    /**
     * Fires the event with the given data.
     * @param data {Object}
     */
    fire(data) {
        for (let handler in this.handlers)
            try {
                handler(data);
            } catch (err) {
                this._logger.verbose(err.message);
                this._logger.silly(err.stack);
            }
    }
}

Object.assign(exports, {
    EventRouter: EventRouter,
    EventGroup: EventGroup,
    Event: Event
});
