const cmdLib = require('../../lib/command');

/**
 * This command module includes utility commands for the server.
 */
class ServerUtilityCommandModule extends cmdLib.CommandModule {

    /**
     * @param opts {Object} properties:
     *     getGuildHandler - a function to get the guild handler for the guild
     *     messagehandler - the MessageHandler instance
     *     config - the config object
     */
    constructor(opts) {
        super(cmdLib.CommandScopes.Guild);
        this._templateDir = __dirname;
        this._messageHandler = opts.messageHandler;
        this._getGuildHandler = opts.getGuildHandler;
        this._config = opts.config;
    }

    /**
     * Serializes a command sequence to string.
     * @param sqArray
     * @returns {*}
     * @private
     */
    _serializeCmdSequence(sqArray) {
        this._logger.debug(sqArray);
        return sqArray.map((x) => x.join(' && ')).join('; ');
    }

    /**
     * Registers the utility commands.
     * @param commandHandler
     */
    async register(commandHandler) {
        await this._loadTemplate();

        let saveCmd = new cmdLib.Command(
            this.template.save_cmd,
            new cmdLib.Answer(async (m, k, s) => {
                let gh = await this._getGuildHandler(m.guild);
                let sequenceString = s
                    .replace(new RegExp(`^${k.name}\\s`), '')
                    .replace(/\\&/g, '&')
                    .replace(/\\;/g, ';');
                let innerStrings = sequenceString.match(/'.+?'/g) || [];

                for (let innerString of innerStrings)
                    sequenceString.replace(innerString, innerString
                        .replace(/&/g, '\\&'))
                        .replace(/;/g, '\\;');
                sequenceString = sequenceString
                    .replace(/"/g, '')
                    .replace(/'/g, '"');
                let sequence = this._messageHandler.parseSyntaxString(sequenceString);
                let execCommand = this._config.prefix + this.template.execute.name;
                let maxSqPar = this._config.commandSettings.maxSequenceParallel;
                let maxSqSer = this._config.commandSettings.maxSequenceSerial;

                if (sequenceString.includes(execCommand)) {
                    return this.template.save_cmd.response.no_recursion;
                } else if (sequence.length > maxSqPar) {
                    return this.template.save_cmd.response.sequence_too_many_parallel;
                } else if (sequence.find(x => x.length > maxSqSer)) {
                    return this.template.save_cmd.response.sequence_too_many_serial;
                } else {
                    let sql = gh.db.sql;
                    let row = await gh.db.get(sql.select('commands', false, [sql.count('*')],
                        sql.where('name', '=', sql.parameter(1))), [k.name]);
                    if (!row || Number(row.count) === 0)
                        await gh.db.run(sql.insert('commands', {name: sql.parameter(1), command: sql.parameter(2)}),
                            [k.name, JSON.stringify(sequence)]);
                    else
                        await gh.db.run(sql.update('commands', {command: sql.parameter(1)}, sql.where('name', '=', sql.parameter(2))),
                            [JSON.stringify(sequence), k.name]);
                }
            })
        );

        let deleteCmd = new cmdLib.Command(
            this.template.delete_cmd,
            new cmdLib.Answer(async (m, k) => {
                let gh = await this._getGuildHandler(m.guild);
                await gh.db.run(gh.db.sql.delete('commands', gh.db.sql.where('name', '=', gh.db.sql.parameter(1)), ), [k.name]);
                return `Deleted command ${k.name}`;
            })
        );

        let savedCmd = new cmdLib.Command(
            this.template.saved_cmd,
            new cmdLib.Answer(async (m) => {
                let gh = await this._getGuildHandler(m.guild);
                let response = new cmdLib.ExtendedRichEmbed('Saved Commands')
                    .setFooter(`Execute a saved entry with ${this._config.prefix}execute [Entryname]`);
                let rows = await gh.db.all(gh.db.sql.select('commands', ['name', 'command']));
                if (rows.length === 0)
                    return this.template.saved_cmd.response.no_commands;
                else
                    for (let row of rows)
                        response.addField(row.name, '`' + this._serializeCmdSequence(JSON.parse(row.command)) + '`');
                return response;
            })
        );

        let execute = new cmdLib.Command(
            this.template.execute,
            new cmdLib.Answer(async (m, k) => {
                let gh = await this._getGuildHandler(m.guild);
                let row = await gh.db.get(gh.db.sql.select('commands',false, ['command'],
                    gh.db.sql.where('name', '=', gh.db.sql.parameter(1))), [k.name]);
                if (row)
                    await this._messageHandler
                        .executeCommandSequence(JSON.parse(row.command), m);
                else
                    return this.template.execute.response.not_found;

            })
        );

        // register commands
        commandHandler
            .registerCommand(saveCmd)
            .registerCommand(deleteCmd)
            .registerCommand(savedCmd)
            .registerCommand(execute);
    }
}

Object.assign(exports, {
    'module': ServerUtilityCommandModule
});
