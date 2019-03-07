const cmdLib = require('../../lib/command'),
    fsx = require('fs-extra'),
    utils = require('../../lib/utils');

/**
 * Info commands provide information about the bot. These informations are
 * not process specific but access the discord _client instance of the bot.
 */

class InfoCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties:
     *     client - the instance of the discord client.
     *     messageHandler - the instance of the Message Handler
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.Global);
        this._templateDir = __dirname;
        this._client = opts.client;
        this._messageHandler = opts.messageHandler;
    }

    _createHelpEmbed(commands, msg, prefix, embedColor = 0xfff) {
        let helpEmbed = new cmdLib.ExtendedRichEmbed('Commands')
            .setDescription('Create a sequence of commands with `;` and `&&`.')
            .setColor(embedColor);
        let categories = [];
        let catCommands = {};
        Object.entries(commands).sort().forEach(([key, value]) => {
            if (!categories.includes(value.category)) {
                categories.push(value.category);
                catCommands[value.category] = `\`${prefix}${key}\` \t`;
            } else {
                catCommands[value.category] += `\`${prefix}${key}\` \t`;
            }
        });
        for (let cat of categories)
            helpEmbed.addField(cat, catCommands[cat]);

        helpEmbed.setFooter(prefix + 'help [command] for more info to each command');
        this._logger.silly('Created help embed');
        return helpEmbed;
    }

    async _loadChangelog() {
        try {
            let changelog = (await fsx.readFile('CHANGELOG.md', {encoding: 'utf-8'})).replace(/\r\n/g, '\n');
            let entries = changelog.split(/\n## /);
            let changes = {};
            let latestVersion = null;
            this._logger.debug(`Found ${entries.length} changelog entries`);
            for (let entry of entries) {
                let title = '';
                let version = '';
                let date = '';
                let titleMatch = entry.match(/^.*?\n/g);

                if (titleMatch && titleMatch.length > 0)
                    title = titleMatch[0].replace(/\n/, '');
                let versionMatch = title.match(/\[.*?]/);

                if (versionMatch && versionMatch.length > 0)
                    version = versionMatch[0].replace(/^\[|]$/g, '');
                if (!latestVersion && version && version.length > 0)
                    latestVersion = version;
                let dateMatch = title.match(/\d{4}-\d{2}-\d{2}/);

                if (version && version.length > 0) {
                    changes[version] = {
                        date: date,
                        title: title,
                        segments: {}
                    };
                    if (dateMatch && dateMatch.length > 0)
                        date = dateMatch[0];
                    let segments = entry.replace(title.replace(/\n/, ''), '').split(/\n### /);
                    for (let segment of segments) {
                        let segmentTitle = '';
                        let titleMatch = segment.match(/^.*?\n/);
                        if (titleMatch && titleMatch.length > 0)
                            segmentTitle = titleMatch[0].replace(/\n/, '');
                        changes[version].segments[segmentTitle] = segment.replace(segmentTitle, '');
                    }
                }
            }
            changes.latest = changes[latestVersion];
            this._changes = changes;
        } catch (err) {
            this._logger.warn(err.message);
            this._logger.debug(err.stack);
        }
    }

    async register(commandHandler) {
        await this._loadTemplate();
        await this._loadChangelog();

        let about = new cmdLib.Command(
            this.template.about,
            new cmdLib.Answer(() => {
                return new cmdLib.ExtendedRichEmbed('About')
                    .setDescription(this.template.about.response.about_creator)
                    .addField('Icon', this.template.about.response.about_icon);
            })
        );

        let ping = new cmdLib.Command(
            this.template.ping,
            new cmdLib.Answer(() => {
                return `Current average ping: \`${this._client.ping} ms\``;
            })
        );

        let uptime = new cmdLib.Command(
            this.template.uptime,
            new cmdLib.Answer(() => {
                let uptime = utils.getSplitDuration(this._client.uptime);
                return new cmdLib.ExtendedRichEmbed('Uptime').setDescription(`
                    **${uptime.days}** days
                    **${uptime.hours}** hours
                    **${uptime.minutes}** minutes
                    **${uptime.seconds}** seconds
                    **${uptime.milliseconds}** milliseconds
                `).setTitle('Uptime');
            })
        );

        let guilds = new cmdLib.Command(
            this.template.guilds,
            new cmdLib.Answer(() => {
                return `Number of guilds: \`${this._client.guilds.size}\``;
            })
        );

        let help = new cmdLib.Command(
            this.template.help,
            new cmdLib.Answer((m, k) => {
                let globH = this._messageHandler.globalCmdHandler;
                let scopeH = this._messageHandler.getScopeHandler(m);
                if (k.command) {
                    k.command = k.command.replace(globH.prefix, '');
                    let commandInstance = globH.commands[k.command] || scopeH.commands[k.command];
                    return commandInstance.help.setColor(this.template.help.embed_color);
                } else {
                    let commandObj = {...globH.commands, ...scopeH.commands};
                    return this._createHelpEmbed(commandObj, m, globH.prefix, this.template.help.embed_color);
                }
            })
        );

        let changes = new cmdLib.Command(
            this.template.changes,
            new cmdLib.Answer((m, k) => {
                try {
                    if (!k.version)
                        return new cmdLib.ExtendedRichEmbed(this._changes.latest.title)
                            .addFields(this._changes.latest.segments)
                            .setColor(this.template.changes.embed_color)
                            .attachFile('CHANGELOG.md');
                    else
                        return new cmdLib.ExtendedRichEmbed(this._changes[k.version].title)
                            .addFields(this._changes[k.version].segments)
                            .setColor(this.template.changes.embed_color)
                            .attachFile('CHANGELOG.md');
                } catch (err) {
                    this._logger.verbose(err.message);
                    this._logger.silly(err.stack);
                    return this.template.changes.response.not_found;
                }
            })
        );

        let versions = new cmdLib.Command(
            this.template.versions,
            new cmdLib.Answer(() => {
                try {
                    return new cmdLib.ExtendedRichEmbed('CHANGELOG.md Versions')
                        .setDescription(Object.keys(this._changes).join('\n'))
                        .setColor(this.template.versions.embed_color);
                } catch (err) {
                    this._logger.verbose(err.message);
                    this._logger.silly(err.stack);
                    return this.template.versions.response.not_found;
                }
            })
        );

        // register commands
        commandHandler
            .registerCommand(about)
            .registerCommand(ping)
            .registerCommand(uptime)
            .registerCommand(guilds)
            .registerCommand(help)
            .registerCommand(changes)
            .registerCommand(versions);
    }
}

Object.assign(exports, {
    'module': InfoCommandModule
});
