const express = require('express'),
    graphqlHTTP = require('express-graphql'),
    {buildSchema} = require('graphql'),
    compression = require('compression'),
    md5 = require('js-md5'),
    cors = require('cors'),
    fs = require('fs'),
    compileSass = require('express-compile-sass'),
    config = require('../config.json'),
    utils = require('../lib/utils');

let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
};

exports.WebServer = class {
    constructor(port, schema, root, referenceObjects) {
        this.app = express();
        this.server = null;
        this.port = port;
        this.schema = buildSchema(fs.readFileSync('./web/graphql/schema.graphql', 'utf-8'));
        this.root = {};
        if (referenceObjects)
            this.setReferenceObjects(referenceObjects);
    }

    /**
     * Starting the api webserver
     */
    start() {
        this.app.use(cors());
        if (config.webservice.useBearers) {
            this.app.use('/graphql', (req, res, next) => this.authenticateUser(req, res, next));
        }
        this.app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false
                } else {
                    return compression.filter(req, res);
                }
            }
        }));
        this.app.use('/graphql', graphqlHTTP({
            schema: this.schema,
            rootValue: this.root,
            graphiql: config.webservice.graphiql || false
        }));
        this.app.use(compileSass({
            root: './web/http/'
        }));
        this.app.use('/', express.static('./web/http/'));
        this.server = this.app.listen(this.port);
    }

    /**
     * Stopping the webserver
     * @returns {Promise<any>}
     */
    stop() {
        return new Promise((resolve) => {
            if (this.server)
                this.server.close(resolve);
            else
                resolve();
        })
    }

    /**
     * Generates a token for a given username
     * @param username
     * @param scope
     * @returns {Promise<any>}
     */
    generateToken(username, scope) {
        return new Promise((resolve, reject) => {
            let token = generateID(['TOKEN', username, (new Date()).getMilliseconds()]);
            this.maindb.run('INSERT INTO users (username, token, scope) VALUES (?, ?, ?)',
                [username, token, scope], (err) => {
                    if (err) {
                        logger.warn(err.message);
                        reject(err);
                    } else {
                        resolve(token);
                    }
                })
        });
    }

    authenticateUser(req, res, next) {
        if (req.headers.authorization
            && req.headers.authorization.split(' ')[0] === 'Bearer') {
            let bearer = req.headers.authorization.split(' ')[1];
            this.maindb.get('SELECT * FROM users WHERE token = ?', [bearer], (err, user) => {
                if (err) {
                    logger.warn(err.message);
                    logger.debug('Unauthorized access');
                    res.status(401);
                    res.end('Unauthorized Access');
                } else {
                    if (!user) {
                        res.status(401);
                        res.end('Unauthorized Access');
                    } else {
                        req.user = user;
                        next();
                    }
                }
            });
        } else {
            logger.debug('Unauthorized access');
            res.status(401);
            res.end('Unauthorized Access');
        }
    }

    /**
     * Setting all objects that web can query
     * @param objects
     */
    setReferenceObjects(objects) {
        this.maindb = objects.maindb;
        this.maindb.run(`${utils.sql.tableExistCreate} users (
                    ${utils.sql.pkIdSerial},
                    username VARCHAR(32) UNIQUE NOT NULL,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    scope INTEGER NOT NULL DEFAULT 0
                    )`, (err) => {
            if (err) {
                logger.error(err.message);
            }
        });
        this.root = {
            client: {
                guilds: (args) => {
                    let dcGuilds = objects.client.guilds.values();
                    if (args.id) {
                        return [Array.from(dcGuilds)
                            .map((x) => new Guild(x, objects.getGuildHandler(x)))
                            .find(x => (x.id === args.id))];
                    } else {
                        try {
                            return Array.from(dcGuilds)
                                .slice(args.offset, args.offset + args.first)
                                .map((x) => new Guild(x, objects.getGuildHandler(x)));
                        } catch (err) {
                            logger.error(err.stack);
                            return null;
                        }
                    }
                },
                guildCount: () => {
                    return Array.from(objects.client.guilds.values()).length;
                },
                user: () => {
                    return new User(objects.client.user);
                },
                ping: () => {
                    return objects.client.ping;
                },
                status: () => {
                    return objects.client.status;
                },
                uptime: () => {
                    return objects.client.uptime;
                },
            },
            prefix: objects.prefix,
            presences: objects.presences,
            config: () => {
                let newConfig = JSON.parse(JSON.stringify(config));
                delete newConfig.api;
                return JSON.stringify(newConfig, null, '  ')
            },
            logs: (args) => {
                return new Promise((resolve) => {
                    let logEntries = [];
                    let lineReader = require('readline').createInterface({
                        input: require('fs').createReadStream('./.log/latest.log')
                    });
                    lineReader.on('line', (line) => {
                        logEntries.push(new LogEntry(JSON.parse(line)));
                    });
                    lineReader.on('close', () => {
                        if (args.level) {
                            logEntries = logEntries
                                .filter(x => (utils.logLevels[x.level] >= utils.logLevels[args.level]));
                        }
                        if (args.id) {
                            logEntries = [logEntries.find(x => (x.id === args.id))];
                        }
                        if (args.first) {
                            logEntries = logEntries.slice(args.offset, args.offset + args.first);
                        } else {
                            logEntries = logEntries.slice(logEntries.length - args.last);
                        }
                        resolve(logEntries);
                    })
                })
            }
        }
    }
};

/**
 * generating an unique id
 * @param valArr
 * @returns {*}
 */
function generateID(valArr) {
    let b64 = Buffer.from(valArr.map(x => {
        if (x)
            return x.toString();
        else
            return 'null';
    }).join('_')).toString('base64');
    return md5(b64);
}

class DJ {
    constructor(musicDj) {
        this.dj = musicDj;
        this.quality = musicDj.quality;
    }

    queue(args) {
        let queue = this.dj.queue.map((x) => {
            return {
                id: generateID(['Media', x.url]),
                name: x.title,
                url: x.url,
                thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(x.url)
            }
        });
        if (args.id) {
            return [queue.find(x => (x.id === args.id))];
        } else {
            return queue.slice(args.offset, args.offset + args.first);
        }
    }

    get playing() {
        return this.dj.playing;
    }

    get connected() {
        return this.dj.connected;
    }

    get queueCount() {
        return this.dj.queue.length;
    }

    get songStartTime() {
        return this.dj.disp.player.streamingData.startTime;
    }

    get volume() {
        return this.dj.volume;
    }

    get repeat() {
        return this.dj.repeat;
    }

    get currentSong() {
        let x = this.dj.current;
        return {
            id: generateID(['Media', x.url]),
            name: x.title,
            url: x.url,
            thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(x.url)
        }
    }

    get voiceChannel() {
        return this.dj.voiceChannel.name;
    }
}

class Guild {
    constructor(discordGuild, guildHandler) {
        this.id = generateID(['Guild', discordGuild.id]);
        this.discordId = discordGuild.id;
        this.name = discordGuild.name;
        this.owner = new GuildMember(discordGuild.owner);
        this.memberCount = discordGuild.memberCount;
        this.icon = discordGuild.iconURL;
        this.prMembers = Array.from(discordGuild.members.values())
            .map((x) => new GuildMember(x));
        this.prRoles = Array.from(discordGuild.roles.values())
            .map((x) => new Role(x));
        guildHandler = guildHandler || {};
        this.ready = guildHandler.ready;
        this.prSaved = null;
        this.guildHandler = guildHandler;
        this.dj = this.guildHandler.dj ? new DJ(this.guildHandler.dj) : null;
    }

    querySaved() {
        return new Promise((resolve) => {
            if (this.guildHandler.db) {
                let saved = [];
                this.guildHandler.db.all('SELECT * FROM playlists', (err, rows) => {
                    if (err) {
                        logger.error(err.message);
                        resolve(null)
                    } else {
                        for (let row of rows) {
                            saved.push({
                                id: generateID(['Media', row.url]),
                                name: row.name,
                                url: row.url,
                                thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(row.url)
                            });
                        }
                        resolve(saved);
                    }
                })
            } else {
                resolve(null);
            }
        });
    }

    saved(args) {
        return new Promise((resolve) => {
            this.querySaved().then((result) => {
                if (result) {
                    if (args.id) {
                        resolve([result.find(x => (x.id === args.id))]);
                    } else if (args.name) {
                        resolve([result.find(x => (x.name === args.name))]);
                    } else {
                        resolve(result.slice(args.offset, args.offset + args.first));
                    }
                } else {
                    resolve(null);
                }
            })

        })
    }

    roles(args) {
        if (args.id) {
            return [this.prRoles.find(x => (x.id === args.id))];
        } else {
            return this.prRoles.slice(args.offset, args.offset + args.first);
        }
    }

    members(args) {
        if (args.id) {
            return [this.prMembers.find(x => (x.id === args.id))];
        } else {
            return this.prMembers.slice(args.offset, args.offset + args.first);
        }
    }
}

class Role {
    constructor(discordRole) {
        this.id = generateID(['Role', discordRole.id]);
        this.discordId = discordRole.id;
        this.name = discordRole.name;
        this.color = discordRole.hexColor;
        this.prMembers = Array.from(discordRole.members.values)
            .map((x) => new GuildMember(x));
    }

    members(args) {
        if (args.id) {
            return [this.prMembers.find(x => (x.id === args.id))];
        } else {
            return this.prMembers.slice(args.offset, args.offset + args.first);
        }
    }
}

class GuildMember {
    constructor(discordGuildMember) {
        this.id = generateID(['GuildMember', discordGuildMember.id]);
        this.discordId = discordGuildMember.id;
        this.user = new User(discordGuildMember.user);
        this.nickname = discordGuildMember.nickname;
        this.prRoles = Array.from(discordGuildMember.roles.values())
            .map((x) => new Role(x));
        this.highestRole = new Role(discordGuildMember.highestRole);
    }

    roles(args) {
        if (args.id) {
            return [this.prRoles.find(x => (x.id === args.id))];
        } else {
            return this.prRoles.slice(args.offset, args.offset + args.first);
        }
    }
}

class User {
    constructor(discordUser) {
        this.id = generateID(['User', discordUser.id]);
        this.discordId = discordUser.id;
        this.name = discordUser.username;
        this.avatar = discordUser.avatarURL;
        this.bot = discordUser.bot;
        this.tag = discordUser.tag;
        this.tag = discordUser.tag;
        this.presence = {
            game: discordUser.presence.game? discordUser.presence.game.name : null,
            status: discordUser.presence.status
        }
    }
}

class LogEntry {
    constructor(entry) {
        this.id = generateID(['LogEntry', entry.level, entry.timestamp]);
        this.message = entry.message;
        this.timestamp = entry.timestamp;
        this.level = entry.level;
    }
}
