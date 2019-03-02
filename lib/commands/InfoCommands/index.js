const cmdLib = require('../../CommandLib'),
    utils = require('../../utils'),
    location = './lib/commands/InfoCommands';

/**
 * Info commands provide information about the bot. These informations are
 * not process specific but access the discord client instance of the bot.
 */

class InfoCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties:
     *     client - the instance of the discord client.
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.Global);
        this.templateFile = location + '/InfoCommandsTemplate.yaml';
        this.client = opts.client;
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
                return `Current average ping: \`${this.client.ping} ms\``;
            })
        );

        let uptime = new cmdLib.Command(
            this.template.uptime,
            new cmdLib.Answer(() => {
                let uptime = utils.getSplitDuration(this.client.uptime);
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
                return `Number of guilds: \`${this.client.guilds.size}\``;
            })
        );

        // register commands
        commandHandler.registerCommand(about);
        commandHandler.registerCommand(ping);
        commandHandler.registerCommand(uptime);
        commandHandler.registerCommand(guilds);
    }
}

Object.assign(exports, {
    'module': InfoCommandModule
});
