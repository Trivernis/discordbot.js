const cmdLib = require('../../CommandLib'),
    utils = require('../../utils'),
    location = './lib/commands/InfoCommands';

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
        this.templateFile = location + '/InfoCommandsTemplate.yaml';
        this._client = opts.client;
        this._messageHandler = opts.messageHandler;
    }

    _createHelpEmbed(commands, msg, prefix) {
        let helpEmbed = new cmdLib.ExtendedRichEmbed('Commands')
            .setDescription('Create a sequence of commands with `;` and `&&`.');
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
        return helpEmbed;
    }

    async register(commandHandler) {
        await this._loadTemplate();

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
                    return commandInstance.help;
                } else {
                    let commandObj = {...globH.commands, ...scopeH.commands};
                    return this._createHelpEmbed(commandObj, m, globH.prefix);
                }
            })
        );

        // register commands
        commandHandler
            .registerCommand(about)
            .registerCommand(ping)
            .registerCommand(uptime)
            .registerCommand(guilds)
            .registerCommand(help);
    }
}

Object.assign(exports, {
    'module': InfoCommandModule
});
