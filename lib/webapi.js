const express = require('express'),
    graphqlHTTP = require('express-graphql'),
    {buildSchema} = require('graphql'),
    compression = require('compression'),
    md5 = require('js-md5'),
    config = require('../config.json'),
    fs = require('fs');

let logger = require('winston');

exports.setLogger = function (newLogger) {
    logger = newLogger;
};

exports.WebServer = class {
    constructor(port, schema, root) {
        this.app = express();
        this.port = port;
        this.schema = buildSchema(fs.readFileSync('./graphql/schema.graphql', 'utf-8'));
        this.root = {};
    }

    /**
     * Starting the api webserver
     */
    start() {
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
        this.app.listen(this.port);
    }

    setReferenceObjects(objects) {
        this.root = {
            client: {
                guilds: (args) => {
                    let dcGuilds = objects.client.guilds.values();
                    if (args.id) {
                        return [Array.from(dcGuilds)
                            .map((x) => new Guild(x, objects.getGuildHandler(x)))
                            .find(x => (x.id === args.id))];
                    } else {
                        return Array.from(dcGuilds)
                            .map((x) => new Guild(x, objects.getGuildHandler(x)))
                            .slice(args.offset, args.offset + args.first);
                    }
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
            config: JSON.stringify(config),
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
                        if (args.id) {
                            resolve([logEntries.find(x => (x.id === args.id))]);
                        } else if (args.first) {
                            resolve(logEntries.slice(args.offset, args.offset + args.first));
                        } else {
                            resolve(logEntries.slice(logEntries.length - args.last));
                        }
                    })
                })
            }
        }
    }
};

function generateID(valArr) {
    let b64 = Buffer.from(valArr.map(x => {
        if (x)
            return x.toString();
        else
            return 'null';
    }).join('_')).toString('base64');
    return md5(b64);
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
                                id: generateID(['Guild', 'ROW', row.id, row.name]),
                                name: row.name,
                                url: row.url
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