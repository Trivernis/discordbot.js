const express = require('express'),
    graphqlHTTP = require('express-graphql'),
    {buildSchema} = require('graphql'),
    compression = require('compression'),
    md5 = require('js-md5'),
    sha512 = require('js-sha512'),
    fs = require('fs'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
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

    configureExpress() {
        this.app.set('view engine', 'pug');
        this.app.set('trust proxy', 1);
        this.app.set('views', './web/http/');

        if (this.app.get('env') === 'devlopment')
            this.app.use(require('cors')());

        this.app.use(require('cors')());
        this.app.use(session({
            secret: config.webservice.sessionSecret,
            resave: false,
            saveUninitialized: true,
            cookie: {secure: 'auto'},
            genid: () => generateUUID('Session')
        }));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({extended: true}));

        this.app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression'])
                    return false;
                 else
                    return compression.filter(req, res);

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
        this.app.post('/', (req, res) => {
            if (!req.body.username || !req.body.password)
                res.render('login', {msg: 'Please enter username and password.'});
            else
                this.maindb.get('SELECT * FROM users WHERE username = ? AND password = ?', [req.body.username, req.body.password], (err, user) => {
                    if (err || !user) {
                        if (err)
                            logger.warn(err.message);
                        logger.debug(`User ${req.body.username} failed to authenticate`);
                        res.render('login', {msg: 'Login failed!'});
                    } else {
                        req.session.user = user;
                        res.render('index');
                    }
                });
        });
        this.app.use('/scripts', express.static('./web/http/scripts'));
        this.app.use((req, res, next) => {
            if (req.session.user)
                next();
             else
                res.render('login');
        }, (req, res) => {
            res.render('index');
        });
    }

    /**
     * Starting the api webserver
     */
    start() {
        this.configureExpress();
        if (config.webservice.https && config.webservice.https.enabled) {
            let sslKey = null;
            let sslCert = null;

            if (config.webservice.https.keyFile)
                sslKey = fs.readFileSync(config.webservice.https.keyFile, 'utf-8');
            if (config.webservice.https.certFile)
                sslCert = fs.readFileSync(config.webservice.https.certFile, 'utf-8');
            if (sslKey && sslCert) {
                logger.verbose('Creating https server.');
                this.server = require('https').createServer({key: sslKey, cert: sslCert}, this.app);
            } else {
                logger.warn('Key or certificate file not found. Fallback to http server.');
                this.server = require('http').createServer(this.app);
            }
        } else {
            this.server = require('http').createServer(this.app);
        }
        this.server.listen(this.port);
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
        });
    }

    /**
     * Generates a token for a given username
     * @param username
     * @param scope
     * @param password
     * @param pwIsHash Is the password already a hash string?
     * @returns {Promise<any>}
     */
    createUser(username, password, scope, pwIsHash) {
        if (!pwIsHash) password = sha512(password);
        return new Promise((resolve, reject) => {
            let token = generateUUID(['TOKEN', username]);
            this.maindb.run('INSERT INTO users (username, password, token, scope) VALUES (?, ?, ?, ?)',
                [username, password, token, scope], (err) => {
                    if (err) {
                        logger.warn(err.message);
                        reject(err);
                    } else {
                        resolve(token);
                    }
                });
        });
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
                    password VARCHAR(255) NOT NULL,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    scope INTEGER NOT NULL DEFAULT 0
                    )`, (err) => {
            if (err)
                logger.error(err.message);

        });
        this.root = {
            client: {
                guilds: (args) => {
                    let dcGuilds = objects.client.guilds.values();
                    if (args.id)
                        return [Array.from(dcGuilds)
                            .map((x) => new Guild(x, objects.getGuildHandler(x)))
                            .find(x => (x.id === args.id))];
                     else
                        try {
                            return Array.from(dcGuilds)
                                .slice(args.offset, args.offset + args.first)
                                .map((x) => new Guild(x, objects.getGuildHandler(x)));
                        } catch (err) {
                            logger.error(err.stack);
                            return null;
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
                voiceConnectionCount: () => {
                    let dcGuilds = Array.from(objects.client.guilds.values());
                    return dcGuilds.filter((x) => {
                        let gh = objects.guildHandlers[x.id];
                        if (gh)
                            if (gh.dj)
                                return gh.dj.playing;
                            else
                                return false;
                         else
                            return false;

                    }).length;
                }
            },
            prefix: objects.prefix,
            presences: objects.presences,
            config: () => {
                let newConfig = JSON.parse(JSON.stringify(config));
                delete newConfig.api;
                return JSON.stringify(newConfig, null, '  ');
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
                        if (args.level)
                            logEntries = logEntries
                                .filter(x => (utils.logLevels[x.level] >= utils.logLevels[args.level]));

                        if (args.id)
                            logEntries = [logEntries.find(x => (x.id === args.id))];

                        if (args.first)
                            logEntries = logEntries.slice(args.offset, args.offset + args.first);
                         else
                            logEntries = logEntries.slice(logEntries.length - args.last);

                        resolve(logEntries);
                    });
                });
            }
        };
    }
};

/**
 * generating an id
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

/**
 * generating an unique id
 * @param input
 * @returns {*}
 */
function generateUUID(input) {
    return generateID([input, (new Date()).getMilliseconds()]) + Date.now();
}

/**
 * Used for graphql attribute access to the lib/music/DJ
 */
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
            };
        });
        if (args.id)
            return [queue.find(x => (x.id === args.id))];
         else
            return queue.slice(args.offset, args.offset + args.first);

    }

    get playing() {
        return this.dj.playing;
    }

    get connected() {
        return this.dj.connected;
    }

    get paused() {
        return this.dj.disp? this.dj.disp.paused : false;
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
        };
    }

    get voiceChannel() {
        return this.dj.voiceChannel.name;
    }
}

/**
 * Used for graphql access to the discord.js Guild and lib/guilding/GuildHandler
 */
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
                        resolve(null);
                    } else {
                        for (let row of rows)
                            saved.push({
                                id: generateID(['Media', row.url]),
                                name: row.name,
                                url: row.url,
                                thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(row.url)
                            });

                        resolve(saved);
                    }
                });
            } else {
                resolve(null);
            }
        });
    }

    saved(args) {
        return new Promise((resolve) => {
            this.querySaved().then((result) => {
                if (result)
                    if (args.id) {
                        resolve([result.find(x => (x.id === args.id))]);
                    } else if (args.name) {
                        resolve([result.find(x => (x.name === args.name))]);
                    } else {
                        resolve(result.slice(args.offset, args.offset + args.first));
                    }
                 else
                    resolve(null);

            });

        });
    }

    roles(args) {
        if (args.id)
            return [this.prRoles.find(x => (x.id === args.id))];
         else
            return this.prRoles.slice(args.offset, args.offset + args.first);

    }

    members(args) {
        if (args.id)
            return [this.prMembers.find(x => (x.id === args.id))];
         else
            return this.prMembers.slice(args.offset, args.offset + args.first);

    }
}

/**
 * Used for graphql access to the discord.js Role
 */
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
        if (args.id)
            return [this.prMembers.find(x => (x.id === args.id))];
         else
            return this.prMembers.slice(args.offset, args.offset + args.first);

    }
}

/**
 * Used for graphql access to the discord.js GuildMember
 */
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
        if (args.id)
            return [this.prRoles.find(x => (x.id === args.id))];
         else
            return this.prRoles.slice(args.offset, args.offset + args.first);

    }
}

/**
 * Used for graphql access to the discord.js User
 */
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
        };
    }
}

/**
 * Used for graphql access to log entries
 */
class LogEntry {
    constructor(entry) {
        this.id = generateID(['LogEntry', entry.level, entry.timestamp]);
        this.message = entry.message;
        this.timestamp = entry.timestamp;
        this.level = entry.level;
    }
}
