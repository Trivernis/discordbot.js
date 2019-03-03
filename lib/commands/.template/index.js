/* template index.js. Doesn't implement actual commands */
const cmdLib = require('../../CommandLib');     // required for command objects

/**
 * A description what the command module includes and why. Doesn't need to list commands but explains
 * category of the defined commands aswell as the scope.
 */

class TemplateCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties: --- define the properties the opts object needs aswell as the type
     *     bot - the instance of the bot
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.Global); // call constructor of superclass with the scope of the module
        this._templateDir = __dirname;      // define the current directory as directory for the template.yaml file

        this._bot = opts.bot;               // define opts attributes as private properties of the module class
    }

    /**
     * Defines and registers commands to the commandHandler.
     * @param commandHandler {CommandHandler}
     */
    async register(commandHandler) {
        await this._loadTemplate();         // loads the template file to the property this.template.

        let templateCommand = new cmdLib.Command(   // create a new instance of Command
            this.template.template_command,         // pass the template to the constructor
            new cmdLib.Answer(() => {               // pass a new instance of Answer to the constructor
                /* Command Logic */
                return this.template.response.not_implemented;  // this command just returns the answer not_implemented
            })
        );

        // register the commands on the commandHandler
        commandHandler.registerCommand(templateCommand);        // register the command to the handler
    }
}

// set the export properties
Object.assign(exports, {
    module: TemplateCommandModule // Export the commandModule as module property. This is the default.
});
