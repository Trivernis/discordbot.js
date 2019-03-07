let stateLib = require("index.js");

class DiscordGuildEvents extends EventGroup {

    constructor(client) {
        super();
        this._registerClientEvents(client);
    }

    /**
     * Registeres the client events to the EventGroup
     * @param client {Discord.Client}
     * @private
     */
    _registerClientEvents(client) {
        this.registerEvent(new stateLib.Event('clientUserGuildSettingsUpdate'))
            .registerEvent(new stateLib.Event('clientUserSettingsUpdate'))
            .registerEvent(new stateLib.Event('emojiCreate'))
            .registerEvent(new stateLib.Event('emojiDelete'))
            .registerEvent(new stateLib.Event('emojiUpdate'))
            .registerEvent(new stateLib.Event('guildBanAdd'))
            .registerEvent(new stateLib.Event('guildBanRemove'))
            .registerEvent(new stateLib.Event('guildCreate'))
            .registerEvent(new stateLib.Event('guildDelete'))
            .registerEvent(new stateLib.Event('guildMemberAdd'))
            .registerEvent(new stateLib.Event('guildMemberAvailable'))
            .registerEvent(new stateLib.Event('guildMemberRemove'))
            .registerEvent(new stateLib.Event('guildMemberChunk'))
            .registerEvent(new stateLib.Event('guildMemberSpeaking'))
            .registerEvent(new stateLib.Event('guildMemberUpdate'))
            .registerEvent(new stateLib.Event('guildUnavailable'))
            .registerEvent(new stateLib.Event('guildUpdate'))
            .registerEvent(new stateLib.Event('presenceUpdate'))
            .registerEvent(new stateLib.Event('roleCreate'))
            .registerEvent(new stateLib.Event('roleDelete'))
            .registerEvent(new stateLib.Event('roleUpdate'))
            .registerEvent(new stateLib.Event('userNoteUpdate'))
            .registerEvent(new stateLib.Event('userUpdate'))
            .registerEvent(new stateLib.Event('voiceStateUpdate'));

        client.on('clientUserGuildSettingsUpdate', (...o) => this.events.clientUserGuildSettingsUpdate.fire(o));
        client.on('clientUserSettingsUpdate', (...o) => this.events.clientUserSettingsUpdate.fire(o));
        client.on('emojiCreate', (...o) => this.events.emojiCreate.fire(o));
        client.on('emojiDelete', (...o) => this.events.emojiDelete.fire(o));
        client.on('emojiUpdate', (...o) => this.events.emojiUpdate.fire(o));
        client.on('guildBanAdd', (...o) => this.events.guildBanAdd.fire(o));
        client.on('guildBanRemove', (...o) => this.events.guildBanRemove.fire(o));
        client.on('guildCreate', (...o) => this.events.guildCreate.fire(o));
        client.on('guildDelete', (...o) => this.events.guildDelete.fire(o));
        client.on('guildMemberAdd', (...o) => this.events.guildMemberAdd.fire(o));
        client.on('guildMemberAvailable', (...o) => this.events.guildMemberAvailable.fire(o));
        client.on('guildMemberRemove', (...o) => this.events.guildMemberRemove.fire(o));
        client.on('guildMemberChunk', (...o) => this.events.guildMemberChunk.fire(o));
        client.on('guildMemberSpeaking', (...o) => this.events.guildMemberSpeaking.fire(o));
        client.on('guildMemberUpdate', (...o) => this.events.guildMemberUpdate.fire(o));
        client.on('guildUnavailable', (...o) => this.events.guildUnavailable.fire(o));
        client.on('guildUpdate', (...o) => this.events.guildUpdate.fire(o));
        client.on('presenceUpdate', (...o) => this.events.presenceUpdate.fire(o));
        client.on('roleCreate', (...o) => this.events.roleCreate.fire(o));
        client.on('roleDelete', (...o) => this.events.roleDelete.fire(o));
        client.on('roleUpdate', (...o) => this.events.roleUpdate.fire(o));
        client.on('userNoteUpdate', (...o) => this.events.userNoteUpdate.fire(o));
        client.on('userUpdate', (...o) => this.events.userUpdate.fire(o));
        client.on('voiceStateUpdate', (...o) => this.events.voiceStateUpdate.fire(o));


    }
}

class DiscordMessageEvents extends stateLib.EventGroup {

    constructor(client) {
        super();
        this._registerMessageEvents(client);
    }

    /**
     * Registeres all client message events
     * @param client {Discord.Client}
     * @private
     */
    _registerMessageEvents(client) {
        this.registerEvent(new stateLib.Event('messageDelete'))
            .registerEvent(new stateLib.Event('messageDeleteBulk'))
            .registerEvent(new stateLib.Event('messageReactionAdd'))
            .registerEvent(new stateLib.Event('messageReactionRemove'))
            .registerEvent(new stateLib.Event('messageReactionRemoveAll'))
            .registerEvent(new stateLib.Event('messageUpdate'))
            .registerEvent(new stateLib.Event('message'));

        client.on('messageDelete', (...o) => this.events.messageDelete.fire(o));
        client.on('messageDeleteBulk', (...o) => this.events.messageDeleteBulk.fire(o));
        client.on('messageReactionAdd', (...o) => this.events.messageReactionAdd.fire(o));
        client.on('messageReactionRemove', (...o) => this.events.messageReactionRemove.fire(o));
        client.on('messageReactionRemoveAll', (...o) => this.events.messageReactionRemoveAll.fire(o));
        client.on('messageUpdate', (...o) => this.events.messageUpdate.fire(o));
        client.on('message', (...o) => this.events.message.fire(o));
    }
}

class DiscordChannelEvents extends stateLib.EventGroup {

    constructor(client) {
        super();
        this._registerChannelEvents(client);
    }

    /**
     * Registers all events for discord channels.
     * @param client {Discord.Client}
     * @private
     */
    _registerChannelEvents(client) {
        this.registerEvent(new stateLib.Event('channelCreate'))
            .registerEvent(new stateLib.Event('channelDelete'))
            .registerEvent(new stateLib.Event('channelPinsUpdate'))
            .registerEvent(new stateLib.Event('channelUpdate'))
            .registerEvent(new stateLib.Event('typingStart'))
            .registerEvent(new stateLib.Event('typingStop'));

        client.on('channelCreate', (...o) => this.events.channelCreate.fire(o));
        client.on('channelDelete', (...o) => this.events.channelDelete.fire(o));
        client.on('channelPinsUpdate', (...o) => this.events.channelPinsUpdate.fire(o));
        client.on('channelUpdate', (...o) => this.events.channelUpdate.fire(o));
        client.on('typingStart', (...o) => this.events.typingStart.fire(o));
        client.on('typingStop', (...o) => this.events.typingStop.fire(o));
    }

}

class DiscordClientEvents extends stateLib.EventGroup {

    constructor(client) {
        super();
        this._registerClientEvents(client);
    }

    /**
     * Registers Discord client events
     * @param client {Discord.Client}
     * @private
     */
    _registerClientEvents(client) {
        this.registerEvent(new stateLib.Event('debug'))
            .registerEvent(new stateLib.Event('warn'))
            .registerEvent(new stateLib.Event('error'))
            .registerEvent(new stateLib.Event('ready'))
            .registerEvent(new stateLib.Event('resume'))
            .registerEvent(new stateLib.Event('disconnect'))
            .registerEvent(new stateLib.Event('reconnecting'))
            .registerEvent(new stateLib.Event('rateLimit'));

        client.on('debug', (...o) => this.events.debug.fire(o));
        client.on('warn', (...o) => this.events.warn.fire(o));
        client.on('error', (...o) => this.events.error.fire(o));
        client.on('ready', (...o) => this.events.ready.fire(o));
        client.on('resume', (...o) => this.events.resume.fire(o));
        client.on('disconnect', (...o) => this.events.disconnect.fire(o));
        client.on('reconnecting', (...o) => this.events.reconnecting.fire(o));
        client.on('rateLimit', (...o) => this.events.rateLimit.fire(o));
        client.on('presenceUpdate', (...o) => this.events.presenceUpdate.fire(o));
    }
}
