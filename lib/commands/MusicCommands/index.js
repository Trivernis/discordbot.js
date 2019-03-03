const cmdLib = require('../../CommandLib'),
    utils = require('../../utils'),
    config = require('../../../config');

function checkPermission(msg, rolePerm) {
    if (!rolePerm || ['all', 'any', 'everyone'].includes(rolePerm))
        return true;
    if (config.owners.includes(msg.author.tag))
        return true;
    else if (msg.member && rolePerm && rolePerm !== 'owner' && msg.member.roles
        .some(role => (role.name.toLowerCase() === rolePerm.toLowerCase() ||
            role.name.toLowerCase() === 'botcommander')))
        return true;
    return false;
}

/**
 * Music commands provide commands to control the bots music functions.
 * These commands are for server music functionalities.
 */
class MusicCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties:
     *     getGuildHandler - a function to get the guild handler for a guild.
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.Guild);
        this._templateDir = __dirname;
        this._getGuildHandler = opts.getGuildHandler;
    }

    /**
     * Connects to a voice-channel if not connected and plays the url
     * @param gh {guilding.GuildHandler}
     * @param vc {Discord.VoiceChannel}
     * @param url {String} The url to the YouTube media
     * @param next {Boolean} Should the song be played next
     * @returns {Promise<void>}
     * @private
     */
    async _connectAndPlay(gh, vc, url, next) {
        if (!gh.musicPlayer.connected) {
            await gh.musicPlayer.connect(vc);
            await gh.musicPlayer.playYouTube(url, next);
        } else {
            await gh.musicPlayer.playYouTube(url, next);
        }
    }

    /**
     * The play function for the music commands play and playnext
     * @param m {Discord.Message}
     * @param k {Object} kwargs
     * @param s {String} argsString
     * @param t {Object} template
     * @param n {Boolean} play next
     * @returns {Promise<*>}
     * @private
     */
    async _playFunction(m, k, s, t, n) {
        let gh = await this._getGuildHandler(m.guild);
        let vc = gh.musicPlayer.voiceChannel || m.member.voiceChannel;
        let url = k['url'];
        if (!vc)
            return t.response.no_voicechannel;
        if (!url)
            return t.response.no_url;
        if (!utils.YouTube.isValidEntityUrl(url)) {
            url = s;
            let row = await gh.db.get('SELECT url FROM playlists WHERE name = ?', [url]);
            if (!row) {
                this._logger.debug('Got invalid url for play command.');
                return t.response.url_invalid;
            } else {
                await this._connectAndPlay(gh, vc, row.url, n);
                return t.response.success;
            }
        } else {
            await this._connectAndPlay(gh, vc, url, n);
            return t.response.success;
        }
    }

    async register(commandHandler) {
        await this._loadTemplate();

        let play = new cmdLib.Command(
            this.template.play,
            new cmdLib.Answer(async (m, k, s) => {
                return await this._playFunction(m, k, s, this.template.play, false);
            })
        );

        let playNext = new cmdLib.Command(
            this.template.play_next,
            new cmdLib.Answer(async (m, k, s) => {
                return await this._playFunction(m, k, s, this.template.play_next, true);
            })
        );

        let join = new cmdLib.Command(
            this.template.join,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                if (m.member.voiceChannel)
                    await gh.musicPlayer.connect(m.member.voiceChannel);
                else
                    return this.template.join.response.no_voicechannel;
            })
        );

        let stop = new cmdLib.Command(
            this.template.stop,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                let vc = gh.musicPlayer.voiceChannel || m.member.voiceChannel;
                if (gh.musicPlayer.connected && vc) {
                    let votes = gh.updateCommandVote(stop.name, m.author.tag);
                    let neededVotes = Math.ceil(vc.members.size/2);

                    if (neededVotes <= votes.count || checkPermission(m, 'dj')) {
                        this._logger.debug(`Vote passed. ${votes.count} out of ${neededVotes} for stop or permission granted`);
                        gh.musicPlayer.stop();
                        gh.resetCommandVote(stop.name);
                        return this.template.stop.success;
                    } else {
                        this._logger.silly(`Vote count increased. ${votes.count} out of ${neededVotes} for stop`);
                        return `${votes.count} out of ${neededVotes} needed voted to stop.`;
                    }
                } else {
                    return this.template.stop.not_playing;
                }
            })
        );

        let pause = new cmdLib.Command(
            this.template.pause,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                if (gh.musicPlayer.playing) {
                    gh.musicPlayer.pause();
                    return this.template.pause.response.success;
                } else {
                    return this.template.pause.response.not_playing;
                }
            })
        );

        let resume = new cmdLib.Command(
            this.template.resume,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                if (gh.musicPlayer.playing) {
                    gh.musicPlayer.resume();
                    return this.template.resume.response.success;
                } else {
                    return this.template.resume.response.not_playing;
                }
            })
        );

        let skip = new cmdLib.Command(
            this.template.skip,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                let vc = gh.musicPlayer.voiceChannel || m.member.voiceChannel;
                if (gh.musicPlayer.playing && vc) {
                    let votes = gh.updateCommandVote(skip.name, m.author.tag);
                    let neededVotes = Math.ceil(vc.members.size/2);

                    if (neededVotes <= votes.count || checkPermission(m, 'dj')) {
                        this._logger.debug(`Vote passed. ${votes.count} out of ${neededVotes} for skip or permission granted`);
                        gh.musicPlayer.skip();
                        gh.resetCommandVote(skip.name);
                        return this.template.skip.response.success;
                    } else {
                        this._logger.silly(`Vote count increased. ${votes.count} out of ${neededVotes} for skip`);
                        return `${votes.count} out of ${neededVotes} needed voted to skip.`;
                    }
                } else {
                    return this.template.skip.response.not_playing;
                }
            })
        );

        let clear = new cmdLib.Command(
            this.template.clear,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                gh.musicPlayer.clear();
                return this.template.clear.response.success;
            })
        );

        let mediaQueue = new cmdLib.Command(
            this.template.media_queue,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                this._logger.debug(`Found ${gh.musicPlayer.queue.length} songs.`);
                let description = '';

                for (let i = 0; i < Math.min(gh.musicPlayer.queue.length, 9); i++) {
                    let entry = gh.musicPlayer.queue[i];
                    description += `[${entry.title}](${entry.url})\n`;
                }
                return new cmdLib.ExtendedRichEmbed(`${gh.musicPlayer.queue.length} songs in queue`)
                    .setDescription(description);
            })
        );

        let mediaCurrent = new cmdLib.Command(
            this.template.media_current,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                let song = gh.musicPlayer.song;
                if (song)
                    return new cmdLib.ExtendedRichEmbed('Now playing:')
                        .setDescription(`[${song.title}](${song.url})`)
                        .setImage(utils.YouTube.getVideoThumbnailUrlFromUrl(song.url))
                        .setColor(0x00aaff);
                else
                    return this.template.media_current.response.not_playing;
            })
        );

        let shuffle = new cmdLib.Command(
            this.template.shuffle,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                gh.musicPlayer.shuffle();
                return this.template.shuffle.response.success;
            })
        );

        let toggleRepeat = new cmdLib.Command(
            this.template.toggle_repeat,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                gh.musicPlayer.repeat = !gh.musicPlayer.repeat;
                return gh.musicPlayer.repeat?
                    this.template.toggle_repeat.response.repeat_true :
                    this.template.toggle_repeat.response.repeat_false;
            })
        );

        let saveMedia = new cmdLib.Command(
            this.template.save_media,
            new cmdLib.Answer(async (m, k, s) => {
                let gh = await this._getGuildHandler(m.guild);
                let saveName = s.replace(k.url + ' ', '');
                let row = await gh.db
                    .get('SELECT COUNT(*) count FROM playlists WHERE name = ?', [saveName]);
                if (!row || row.count === 0)
                    await gh.db.run('INSERT INTO playlists (name, url) VALUES (?, ?)',
                            [saveName, k.url]);
                else
                    await gh.db.run('UPDATE playlists SET url = ? WHERE name = ?',
                        [k.url, saveName]);
                return `Saved song/playlist as ${saveName}`;
            })
        );

        let deleteMedia = new cmdLib.Command(
            this.template.delete_media,
            new cmdLib.Answer(async (m, k, s) => {
                let gh = await this._getGuildHandler(m.guild);
                if (!s) {
                    return this.template.delete_media.response.no_name;
                } else {
                    await gh.db.run('DELETE FROM playlists WHERE name = ?', [s]);
                    return `Deleted ${s} from saved media`;
                }
            })
        );

        let savedMedia = new cmdLib.Command(
            this.template.saved_media,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                let response = '';
                let rows = await gh.db.all('SELECT name, url FROM playlists');
                for (let row of rows)
                    response += `[${row.name}](${row.url})\n`;

                if (rows.length === 0)
                    return this.template.saved_media.response.no_saved;
                else
                    return new cmdLib.ExtendedRichEmbed('Saved Songs and Playlists')
                        .setDescription(response)
                        .setFooter(`Play a saved entry with play [Entryname]`);
            })
        );

        // register commands
        commandHandler
            .registerCommand(play)
            .registerCommand(playNext)
            .registerCommand(join)
            .registerCommand(stop)
            .registerCommand(pause)
            .registerCommand(resume)
            .registerCommand(skip)
            .registerCommand(clear)
            .registerCommand(mediaQueue)
            .registerCommand(mediaCurrent)
            .registerCommand(shuffle)
            .registerCommand(toggleRepeat)
            .registerCommand(saveMedia)
            .registerCommand(deleteMedia)
            .registerCommand(savedMedia);
    }
}

Object.assign(exports, {
    'module': MusicCommandModule
});
