const express = require('express'),
    graphqlHTTP = require('express-graphql'),
    {buildSchema} = require('graphql'),
    compression = require('compression'),
    md5 = require('js-md5'),
    sha512 = require('js-sha512'),
    logging = require('../utils/logging'),
    fs = require('fs'),
    session = require('express-session'),
    SQLiteStore = require('connect-sqlite3')(session),
    bodyParser = require('body-parser'),
    compileSass = require('express-compile-sass'),
    config = require('../../config.json'),
    utils = require('../utils');

exports.WebServer = class {
    constructor(port) {
        this.app = express();
        this.server = null;
        this.port = port;
        this.schema = buildSchema(fs.readFileSync('./web/api/graphql/schema.gql', 'utf-8'));
        this.root = {};
        this._logger = new logging.Logger(this);
    }

    /**
     * Configures express by setting properties and middleware.
     */
    configureExpress() {
        this.app.set('view engine', 'pug');
        this.app.set('trust proxy', 1);
        this.app.set('views', './web/http/');

        if (this.app.get('env') === 'devlopment')
            this.app.use(require('cors')());

        this.app.use(require('cors')());
        this.app.use(session({
            store: new SQLiteStore({dir: './data', db: 'sessions.db'}),
            secret: config.webinterface.sessionSecret,
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
        this.app.use(compileSass({
            root: './web/http/'
        }));
        this.app.post('/', async (req, res) => {
            if (!req.body.username || !req.body.password) {
                res.render('login', {msg: 'Please enter username and password.'});
            } else {
                let user = await this.maindb.get('SELECT * FROM users WHERE username = ? AND password = ?', [req.body.username, req.body.password]);
                if (!user) {
                    this._logger.debug(`User ${req.body.username} failed to authenticate`);
                    res.render('login', {msg: 'Login failed!'});
                } else {
                    req.session.user = user;
                    res.render('index');
                }
            }
        });
        this.app.use('/scripts', express.static('./web/http/scripts'));
        this.app.use((req, res, next) => {
            if (req.session.user)
                next();
             else
                res.render('login');
        });
        this.app.get('/', (req, res) => {
            res.render('index');
        });
        this.app.use('/graphql', graphqlHTTP({
            schema: this.schema,
            rootValue: this.root,
            graphiql: config.webinterface.graphiql || false
        }));
    }

    /**
     * Starting the api webserver
     */
    start() {
        this.configureExpress();
        if (config.webinterface.https && config.webinterface.https.enabled) {
            let sslKey = null;
            let sslCert = null;

            if (config.webinterface.https.keyFile)
                sslKey = fs.readFileSync(config.webinterface.https.keyFile, 'utf-8');
            if (config.webinterface.https.certFile)
                sslCert = fs.readFileSync(config.webinterface.https.certFile, 'utf-8');
            if (sslKey && sslCert) {
                this._logger.verbose('Creating https server.');
                this.server = require('https').createServer({key: sslKey, cert: sslCert}, this.app);
            } else {
                this._logger.warn('Key or certificate file not found. Fallback to http server.');
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
    async createUser(username, password, scope, pwIsHash) {
        if (!pwIsHash) password = sha512(password);
        let token = generateUUID(['TOKEN', username]);
        await this.maindb.run('INSERT INTO users (username, password, token, scope) VALUES (?, ?, ?, ?)',
            [username, password, token, scope]);
        return token;
    }

    /**
     * Setting all objects that web can query
     * @param objects
     */
    async setReferenceObjects(objects) {
        this.maindb = objects.maindb;
        await this.maindb.run(`${utils.sql.tableExistCreate} users (
                    ${utils.sql.pkIdSerial},
                    username VARCHAR(32) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    scope INTEGER NOT NULL DEFAULT 0
                    )`);
        this.root = {
            client: {
                guilds: async (args) => {
                    let dcGuilds = objects.client.guilds.values();
                    if (args.id)
                        return [(await Promise.all(Array.from(dcGuilds)
                            .map(async (x) => new Guild(x, await objects.getGuildHandler(x)))))
                            .find(x => (x.id === args.id))];
                     else
                        try {
                            return await Promise.all(Array.from(dcGuilds)
                                .slice(args.offset, args.offset + args.first)
                                .map(async (x) => new Guild(x, await objects.getGuildHandler(x))));
                        } catch (err) {
                            this._logger.error(err.stack);
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
                            if (gh.musicPlayer)
                                return gh.musicPlayer.playing;
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
 * Used for graphql attribute access to the lib/music/MusicPlayer
 */
class MusicPlayer {
    constructor(musicPlayer) {
        this.musicPlayer = musicPlayer;
        this.quality = musicPlayer.quality;
    }

    queue(args) {
        let queue = this.musicPlayer.queue.map((x) => {
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
        return this.musicPlayer.playing;
    }

    get connected() {
        return this.musicPlayer.connected;
    }

    get paused() {
        return this.musicPlayer.disp? this.musicPlayer.disp.paused : false;
    }

    get queueCount() {
        return this.musicPlayer.queue.length;
    }

    get songStartTime() {
        return this.musicPlayer.disp.player.streamingData.startTime;
    }

    get volume() {
        return this.musicPlayer.volume;
    }

    get repeat() {
        return this.musicPlayer.repeat;
    }

    get currentSong() {
        let x = this.musicPlayer.current;
        return {
            id: generateID(['Media', x.url]),
            name: x.title,
            url: x.url,
            thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(x.url)
        };
    }

    get voiceChannel() {
        return this.musicPlayer.voiceChannel.name;
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
        this.musicPlayer = this.guildHandler.musicPlayer ? new MusicPlayer(this.guildHandler.musicPlayer) : null;
    }

    async querySaved() {
        if (this.guildHandler.db) {
            let saved = [];
            let rows = await this.guildHandler.db.all('SELECT * FROM playlists');
            for (let row of rows)
                saved.push({
                    id: generateID(['Media', row.url]),
                    name: row.name,
                    url: row.url,
                    thumbnail: utils.YouTube.getVideoThumbnailUrlFromUrl(row.url)
                });
            return saved;
        }
    }

    async saved(args) {
        let result = await this.querySaved();
        if (args.id)
            return [result.find(x => (x.id === args.id))];
         else if (args.name)
            return [result.find(x => (x.name === args.name))];
         else
            return result.slice(args.offset, args.offset + args.first);
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
        this.module = entry.module || entry.m || 'DEFAULT';
    }
}
