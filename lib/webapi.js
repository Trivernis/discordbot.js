const express = require('express'),
    graphqlHTTP = require('express-graphql'),
    {buildSchema} = require('graphql'),
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

    start() {
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
                guilds: ({count}) => {
                    let dcGuilds = objects.client.guilds.values();
                    return Array.from(dcGuilds).map((x) => new Guild(x)).slice(0, count);
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
                }
            }
        }
    }
};

class Guild {
    constructor(discordGuild) {
        this.id = discordGuild.id;
        this.name = discordGuild.name;
        this.owner = new GuildMember(discordGuild.owner);
        this.memberCount = discordGuild.memberCount;
        this.icon = discordGuild.iconURL;
        this.members = Array.from(discordGuild.members.values())
            .map((x) => new GuildMember(x));
        this.roles = Array.from(discordGuild.roles.values())
            .map((x) => new Role(x));
    }
}

class Role {
    constructor(discordRole) {
        this.id = discordRole.id;
        this.name = discordRole.name;
        this.color = discordRole.hexColor;
        this.members = Array.from(discordRole.members.values)
            .map((x) => new GuildMember(x));
    }
}

class GuildMember {
    constructor(discordGuildMember) {
        this.id = discordGuildMember.id;
        this.user = new User(discordGuildMember.user);
        this.nickname = discordGuildMember.nickname;
        this.roles = Array.from(discordGuildMember.roles.values())
            .map((x) => new Role(x));
        this.highestRole = new Role(discordGuildMember.highestRole);
    }
}

class User {
    constructor(discordUser) {
        this.id = discordUser.id;
        this.name = discordUser.username;
        this.avatar = discordUser.avatarURL;
        this.bot = discordUser.bot;
        this.tag = discordUser.tag;
        this.tag = discordUser.tag;
    }
}