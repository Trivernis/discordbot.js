/* Module definition */

/* Variable Definition */
const Discord = require('discord.js'),
    args = require('args-parser')(process.argv),
    config = require('../config.json'),
    gcmdTempl = require('../commands/globalcommands'),
    scmdTempl = require('../commands/servercommands'),
    utils = require('./utils');

let logger = require('winston'),
    globCommands = {};

/**
 * @type {Servant}
 */
class Servant {
    constructor(prefix) {
        this.commands = {};
        this.prefix = prefix;
        // show all commands (except the owner commands if the user is not an owner)
        this.createCommand(gcmdTempl.utils.help, (msg, kwargs) => {
            if (kwargs.command) {
                let cmd = kwargs.command;
                let allCommands = {...globCommands, ...this.commands};
                if (cmd.charAt(0) !== prefix)
                    cmd = this.prefix + cmd;
                if (allCommands[cmd])
                    return new Discord.RichEmbed()
                        .setTitle(`Help for ${cmd}`)
                        .addField('Usage', `\`${cmd} [${allCommands[cmd].args.join('] [')}]\``.replace('[]', ''))
                        .addField('Description', allCommands[cmd].description)
                        .addField('Permission Role', allCommands[cmd].role || 'all');
                else
                    return 'Command not found :(';

            } else {
                let allCommands = {...globCommands, ...this.commands};
                return createHelpEmbed(allCommands, msg, prefix);
            }
        });

        // show all roles that are used by commands
        this.createCommand(scmdTempl.utils.roles, () => {
            let roles = [];
            Object.values(globCommands).concat(Object.values(this.commands)).sort().forEach((value) => {
                roles.push(value.role || 'all');
            });
            return `**Roles**\n${[...new Set(roles)].join('\n')}`;
        });
    }

    /**
     * Creates a command entry in the private commands dict
     * @param template
     * @param call
     */
    createCommand(template, call) {
        if (!template.name) {
            logger.debug(`Name of command template is null or undef. Failed creating command.`);
            return;
        }
        this.commands[this.prefix + template.name] = {
            'args': template.args || [],
            'description': template.description,
            'callback': call,
            'role': template.permission,
            'category': template.category || 'Other'
        };
        logger.debug(`Created server command: ${this.prefix + template.name}, args: ${template.args}`);
    }

    /**
     * Removes a command
     * @param command
     * @deprecated Why would you want to remove a command?
     */
    removeCommand(command) {
        delete this.commands[command];
    }

    /**
     * Processes the command
     * @param msg
     * @param globResult
     * @param content
     * @param returnFunction Boolean if the return value should be a function.
     * @param fallback
     * @returns {*}
     */
    processCommand(msg, globResult, content, returnFunction, fallback) {
        let command = (content.match(/^.\w+/) || [])[0];
        if (!command || !this.commands[command])
            if (fallback && !globResult) {
                command = fallback;
                content = `${fallback} ${content}`;
            } else {
                return globResult;
            }
        let cmd = this.commands[command];
        if (!checkPermission(msg, cmd.role))
            return 'No Permission';
        logger.debug(`Permission <${cmd.role || 'all'}> granted for command ${command} for user <${msg.author.tag}>`);
        let argvars = content.match(/(?<= )\S+/g) || [];
        let kwargs = {};
        let nLength = Math.min(cmd.args.length, argvars.length);
        for (let i = 0; i < nLength; i++)
            kwargs[cmd.args[i]] = argvars[i];

        let argv = argvars.slice(nLength);
        logger.debug(`Executing callback for command: ${command}, kwargs: ${kwargs}, argv: ${argv}`);
        try {
            let locResult = returnFunction ? () => cmd.callback(msg, kwargs, argv) : cmd.callback(msg, kwargs, argv);
            return locResult || globResult;
        } catch (err) {
            logger.error(err.message);
            return `The command \`${command}\`  has thrown an error.`;
        }
    }

    /**
     * Parses the message and executes the command callback for the found command entry in the commands dict
     * @param msg
     * @returns {*}
     */
    parseCommand(msg) {
        let globResult = parseGlobalCommand(msg);
        logger.debug(`Global command result is ${globResult}`);
        let content = msg.content;
        let commands = content.split(/(?<!\\);/).map(x => x.replace(/^ +/, ''));
        if (commands.length === 1) {
            return this.processCommand(msg, globResult, content);
        } else if (commands.length < (config.maxCmdSequenceLength || 5)) {
            let answers = [];
            let previousCommand = (commands[0].match(/^.\w+/) || [])[0];
            for (let i = 0; i < commands.length; i++) {
                answers.push(this.processCommand(msg, globResult[i], commands[i],
                    true, previousCommand)); // return function to avoid "race conditions"
                let commandMatch = (commands[i].match(/^.\w+/) || [])[0];
                previousCommand = this.commands[commandMatch] ? commandMatch : previousCommand;
            }

            return answers;
        } else {
            return 'This command sequence is too long!';
        }
    }

}

/**
 * Getting the logger
 * @param {Object} newLogger
 */
function setModuleLogger(newLogger) {
    logger = newLogger;
}

/**
 * Creates a global command that can be executed in every channel.
 * @param prefix
 * @param template
 * @param call
 */
function createGlobalCommand(prefix, template, call) {
    if (!template.name) {
        logger.debug(`Name of command template is null or undef. Failed to create command.`);
        return;
    }
    globCommands[prefix + template.name] = {
        'args': template.args || [],
        'description': template.description,
        'callback': call,
        'role': template.permission,
        'name': template.name,
        'category': template.category || 'Other'
    };
    logger.debug(`Created global command: ${prefix + template.name}, args: ${template.args}`);
}


/**
 * Parses a message for a global command
 * @param msg
 * @returns {boolean|*}
 */
exports.parseMessage = function (msg) {
    return parseGlobalCommand(msg);
};

/**
 * Initializes the module by creating a help command
 */
function initModule(prefix) {
    logger.verbose("Creating help command...");
    createGlobalCommand((prefix || config.prefix), gcmdTempl.utils.help, (msg, kwargs) => {
        if (kwargs.command) {
            let cmd = kwargs.command;
            if (cmd.charAt(0) !== prefix)
                cmd = prefix + cmd;
            if (globCommands[cmd])
                return new Discord.RichEmbed()
                    .setTitle(`Help for ${cmd}`)
                    .addField('Usage', `\`${cmd} [${globCommands[cmd].args.join('] [')}]\``.replace('[]', ''))
                    .addField('Description', globCommands[cmd].description)
                    .addField('Permission Role', globCommands[cmd].role || 'all');

        } else {
            return createHelpEmbed(globCommands, msg, prefix);
        }
    });
}

/**
 * Processes commands for command series.
 * @param cmd
 * @param msg
 * @param content
 * @param returnFunction
 * @returns {function(): *}
 */
function processCommand(cmd, msg, content, returnFunction) {
    let argvars = content.match(/(?<= )\S+/g) || [];
    let kwargs = {};
    let nLength = Math.min(cmd.args.length, argvars.length);
    for (let i = 0; i < nLength; i++)
        kwargs[cmd.args[i]] = argvars[i];
    let argv = argvars.slice(nLength);
    logger.debug(`Executing callback for command: ${cmd.name}, kwargs: ${JSON.stringify(kwargs)}, argv: ${argv}`);
    return returnFunction ? () => cmd.callback(msg, kwargs, argv) : cmd.callback(msg, kwargs, argv);
}

/**
 * Parses the message by calling the assigned function for the command with arguments
 * @param msg
 */
function parseGlobalCommand(msg) {
    let content = msg.content;
    let commands = content.split(/(?<!\\);/).map(x => x.replace(/^ +/, ''));
    if (commands.length === 1) {
        let command = (content.match(/^.\w+/) || [])[0];
        if (!command || !globCommands[command])
            return false;
        let cmd = globCommands[command];
        if (!checkPermission(msg, cmd.role))
            return false;
        logger.debug(`Permission <${cmd.role}> granted for command ${command} for user <${msg.author.tag}>`);
        return processCommand(cmd, msg, content);
    } else if (commands.length < (config.maxCmdSequenceLength || 5)) {
        let answers = [];
        let previousCommand = '';
        for (let commandPart of commands) {
            let command = (commandPart.match(/^.\w+/) || [])[0] || previousCommand;
            previousCommand = globCommands[command] ? command : previousCommand;
            if (!commandPart || !globCommands[command]) {
                commandPart = `${previousCommand} ${commandPart}`;
                command = previousCommand;
            }
            if (command && globCommands[command]) {
                let cmd = globCommands[command];
                if (checkPermission(msg, cmd.role)) {
                    logger.debug(`Permission <${cmd.role}> granted for command ${command} for user <${msg.author.tag}>`);
                    answers.push(processCommand(cmd, msg, commandPart,
                        true));  // return an function to avoid "race conditions"
                } else {
                    answers.push(false);
                }
            } else {
                answers.push(false);
            }
        }
        return answers;
    } else {
        return 'This command sequence is too long!';
    }
}

/**
 * Creates a rich embed that contains help for all commands in the commands object
 * @param commands {Object}
 * @param msg {module:discord.js.Message}
 * @param prefix {String}
 * @returns {module:discord.js.RichEmbed}
 */
function createHelpEmbed(commands, msg, prefix) {
    let helpEmbed = new Discord.RichEmbed()
        .setTitle('Commands')
        .setDescription('Create a sequence of commands with `;` (semicolon).')
        .setTimestamp();
    let categories = [];
    let catCommands = {};
    Object.entries(commands).sort().forEach(([key, value]) => {
        if (value.role !== 'owner' || checkPermission(msg, 'owner'))
            if (!categories.includes(value.category)) {
                categories.push(value.category);
                catCommands[value.category] = `\`${key}\` \t`;
            } else {
                catCommands[value.category] += `\`${key}\` \t`;
            }

    });
    for (let cat of categories)
        helpEmbed.addField(cat, catCommands[cat]);

    helpEmbed.setFooter(prefix + 'help [command] for more info to each command');
    return helpEmbed;
}

/**
 * @param msg
 * @param rolePerm {String}
 * @returns {boolean}
 */
function checkPermission(msg, rolePerm) {
    if (!rolePerm || ['all', 'any', 'everyone'].includes(rolePerm))
        return true;
    if (msg.author.tag === args.owner || config.owners.includes(msg.author.tag))
        return true;
    else if (msg.member && rolePerm && rolePerm !== 'owner' && msg.member.roles
        .some(role => (role.name.toLowerCase() === rolePerm.toLowerCase() || role.name.toLowerCase() === 'botcommander')))
        return true;

    return false;
}

/**
 * Registers the bot's utility commands
 * @param prefix
 * @param bot - the instance of the bot that called
 */
function registerUtilityCommands(prefix, bot) {
    // responde with the commands args
    createGlobalCommand(prefix, gcmdTempl.utils.say, (msg, argv, args) => {
        return args.join(' ');
    });

    // adds a presence that will be saved in the presence file and added to the rotation
    createGlobalCommand(prefix, gcmdTempl.utils.addpresence, async (msg, argv, args) => {
        let p = args.join(' ');
        this.presences.push(p);
        await bot.maindb.run('INSERT INTO presences (text) VALUES (?)', [p]);
        return `Added Presence \`${p}\``;
    });

    // shuts down the bot after destroying the client
    createGlobalCommand(prefix, gcmdTempl.utils.shutdown, async (msg) => {
        try {
            await msg.reply('Shutting down...');
            logger.debug('Destroying client...');
        } catch (err) {
            logger.error(err.message);
            logger.debug(err.stack);
        }
        try {
            await bot.client.destroy();
            logger.debug('Exiting server...');
        } catch (err) {
            logger.error(err.message);
            logger.debug(err.stack);
        }
        try {
            await bot.webServer.stop();
            logger.debug(`Exiting Process...`);
            process.exit(0);
        } catch (err) {
            logger.error(err.message);
            logger.debug(err.stack);
        }
    });

    // forces a presence rotation
    createGlobalCommand(prefix, gcmdTempl.utils.rotate, () => {
        try {
            bot.client.clearInterval(this.rotator);
            bot.rotatePresence();
            bot.rotator = this.client.setInterval(() => this.rotatePresence(), config.presence_duration);
        } catch (error) {
            logger.warn(error.message);
        }
    });

    createGlobalCommand(prefix, gcmdTempl.utils.createUser, (msg, argv) => {
        return new Promise((resolve, reject) => {
            if (msg.guild) {
                resolve("It's not save here! Try again via PM.");
            } else if (argv.username && argv.scope) {
                logger.debug(`Creating user entry ${argv.username}, scope: ${argv.scope}`);

                bot.webServer.createUser(argv.username, argv.password, argv.scope, false).then((token) => {
                    resolve(`Created entry
                            username: ${argv.username},
                            scope: ${argv.scope},
                            token: ${token}
                        `);
                }).catch((err) => reject(err.message));
            }
        });
    });

    createGlobalCommand(prefix, gcmdTempl.utils.bugreport, () => {
        return new Discord.RichEmbed()
            .setTitle('Where to report a bug?')
            .setDescription(gcmdTempl.utils.bugreport.response.bug_report);
    });
}

/**
 * Registers the bot's info commands
 * @param prefix {String}
 * @param bot {Object}
 */
function registerInfoCommands(prefix, bot) {
    // ping command that returns the ping attribute of the client
    createGlobalCommand(prefix, gcmdTempl.info.ping, () => {
        return `Current average ping: \`${bot.client.ping} ms\``;
    });

    // returns the time the bot is running
    createGlobalCommand(prefix, gcmdTempl.info.uptime, () => {
        let uptime = utils.getSplitDuration(bot.client.uptime);
        return new Discord.RichEmbed().setDescription(`
            **${uptime.days}** days
            **${uptime.hours}** hours
            **${uptime.minutes}** minutes
            **${uptime.seconds}** seconds
            **${uptime.milliseconds}** milliseconds
        `).setTitle('Uptime');
    });

    // returns the number of guilds, the bot has joined
    createGlobalCommand(prefix, gcmdTempl.info.guilds, () => {
        return `Number of guilds: \`${bot.client.guilds.size}\``;
    });

    // returns information about the bot
    createGlobalCommand(prefix, gcmdTempl.info.about, () => {
        return new Discord.RichEmbed()
            .setTitle('About')
            .setDescription(gcmdTempl.info.about.response.about_creator)
            .addField('Icon', gcmdTempl.info.about.response.about_icon);
    });
}

/**
 * Registers all commands that use the anilist api.
 * @param prefix {String}
 */
function registerAnilistApiCommands(prefix) {
    const anilistApi = require('./api/AnilistApi');

    // returns the anime found for the name
    createGlobalCommand(prefix, gcmdTempl.api.AniList.animeSearch, async (msg, kwargs, args) => {
        try {
            let animeData = await anilistApi.searchAnimeByName(args.join(' '));
            if (animeData) {
                let response = new Discord.RichEmbed()
                    .setTitle(animeData.title.romaji)
                    .setDescription(animeData.description.replace(/<\/?.*?>/g, ''))
                    .setThumbnail(animeData.coverImage.large)
                    .setURL(animeData.siteUrl)
                    .setColor(animeData.coverImage.color)
                    .addField('Genres', animeData.genres.join(', '))
                    .setFooter('Provided by anilist.co')
                    .setTimestamp();
                if (animeData.studios.studioList.length > 0)
                    response.addField(animeData.studios.studioList.length === 1 ? 'Studio' : 'Studios', animeData.studios.studioList.map(x => `[${x.name}](${x.siteUrl})`));
                response.addField('Scoring', `**Average Score:** ${animeData.averageScore}
                **Favourites:** ${animeData.favourites}`);

                if (animeData.episodes)
                    response.addField('Episodes', animeData.episodes);
                response.addField('Season', animeData.season);

                if (animeData.startDate.day)
                    response.addField('Start Date', `
                ${animeData.startDate.day}.${animeData.startDate.month}.${animeData.startDate.year}`);

                if (animeData.nextAiringEpisode)
                    response.addField('Next Episode', `**Episode** ${animeData.nextAiringEpisode.episode}
                **Airing at:** ${new Date(animeData.nextAiringEpisode.airingAt * 1000).toUTCString()}`);

                if (animeData.endDate.day)
                    response.addField('End Date', `
                ${animeData.endDate.day}.${animeData.endDate.month}.${animeData.endDate.year}`);
                return response;
            } else {
                return gcmdTempl.api.AniList.animeSearch.response.not_found;
            }
        } catch (err) {
            if (err.message) {
                logger.warn(err.message);
                logger.debug(err.stack);
            } else {
                logger.debug(JSON.stringify(err));
            }
            return gcmdTempl.api.AniList.animeSearch.response.not_found;
        }
    });

    createGlobalCommand(prefix, gcmdTempl.api.AniList.mangaSearch, async (msg, kwargs, args) => {
        try {
            let mangaData = await anilistApi.searchMangaByName(args.join(' '));
            if (mangaData) {
                let response = new Discord.RichEmbed()
                    .setTitle(mangaData.title.romaji)
                    .setThumbnail(mangaData.coverImage.large)
                    .setDescription(mangaData.description.replace(/<\/?.*?>/g, ''))
                    .setURL(mangaData.siteUrl)
                    .setFooter('Provided by anilist.co')
                    .setTimestamp();
                if (mangaData.endDate.day)
                    response.addField('End Date', `
                    ${mangaData.endDate.day}.${mangaData.endDate.month}.${mangaData.endDate.year}`);
                return response;
            } else {
                return gcmdTempl.api.AniList.mangaSearch.response.not_found;
            }
        } catch (err) {
            if (err.message) {
                logger.warn(err.message);
                logger.debug(err.stack);
            } else {
                logger.debug(JSON.stringify(err));
            }
            return gcmdTempl.api.AniList.mangaSearch.response.not_found;
        }
    });
}

// -- exports -- //

Object.assign(exports, {
    init: initModule,
    Servant: Servant,
    registerAnilistApiCommands: registerAnilistApiCommands,
    registerInfoCommands: registerInfoCommands,
    registerUtilityCommands: registerUtilityCommands,
    setLogger: setModuleLogger,
    createGlobalCommand: createGlobalCommand
});
