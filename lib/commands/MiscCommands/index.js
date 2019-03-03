/* template index.js. Doesn't implement actual commands */
const cmdLib = require('../../CommandLib');

/**
 * Several commands that are that special that they can't be included in any other module.
 */

/**
 * Async delay
 * @param seconds {Number}
 */
function delay(seconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

class MiscCommandModule extends cmdLib.CommandModule {

    constructor() {
        super(cmdLib.CommandScopes.Global);
        this._templateDir = __dirname;
    }

    /**
     * Defines and registers commands to the commandHandler.
     * @param commandHandler {CommandHandler}
     */
    async register(commandHandler) {
        await this._loadTemplate();

        let sayCommand = new cmdLib.Command(
            this.template.say,
            new cmdLib.Answer((m, k, s) => {
                return s.replace(/^"|"$/g, '');
            })
        );

        let delayCommand = new cmdLib.Command(
            this.template.delay,
            new cmdLib.Answer(async (m, k)  => {
                this._logger.silly(`Delaying for ${k.seconds} seconds`);
                await delay(k.seconds);
            })
        );

        let chooseCommand = new cmdLib.Command(
            this.template.choose,
            new cmdLib.Answer(async (m, k, s) => {
                let options = s.split(',').map(x => {
                    if (x) {
                        let strippedValue = x.replace(/^\s+|\s+$/, '');
                        if (strippedValue.length === 0)
                            return null;
                        else
                            return strippedValue;
                    } else {
                        return null;
                    }
                }).filter(x => x);
                if (options.length === 0) {
                    return this.template.choose.response.no_options;
                } else {
                    this._logger.silly(`Choosing from ${options.join(', ')}`);
                    let item = options[Math.floor(Math.random() * options.length)];
                    return `I've chosen ${item.replace(/^"|"$|^\s+|\s+$/g, '')}`;
                }
            })
        );

        /* Register commands to handler */
        commandHandler
            .registerCommand(sayCommand)
            .registerCommand(delayCommand)
            .registerCommand(chooseCommand);
    }
}


Object.assign(exports, {
    module: MiscCommandModule
});
