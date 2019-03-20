const graphql = require('graphql');

let pageInfoType = new graphql.GraphQLObjectType({
    name: 'PageInfo',
    fields: {
        total: {
            type: graphql.assertNonNullType(graphql.GraphQLInt),
            description: 'total number of pages'
        },
        perPage: {
            type: graphql.assertNonNullType(graphql.GraphQLInt),
            description: 'number of entries per page'
        },
        currentPage: {
            type: graphql.assertNonNullType(graphql.GraphQLInt),
            description: 'current page'
        },
        lastPage: {
            type: graphql.assertNonNullType(graphql.GraphQLInt),
            description: 'last page'
        },
        hasNextPage: {
            type: graphql.assertNonNullType(graphql.GraphQLBoolean),
            description: 'does the connection have a next page'
        }
    }
});

let mediaEntryType = new graphql.GraphQLObjectType({

    name: 'MediaEntry',
    fields: {
        id: {
            type: graphql.GraphQLID,
            description: 'id of the media entry'
        },
        url: {
            type: graphql.GraphQLString,
            description: 'url to the YouTube video'
        },
        name: {
            type: graphql.GraphQLString,
            description: 'title of the YouTube video'
        },
        thumbnail: {
            type: graphql.GraphQLString,
            description: 'thumbnail of the YouTube video'
        }
    }
});

let mediaEntryEdgeType = new graphql.GraphQLObjectType({
    name: 'MediaEntryEdge',
    fields: {
        id: {
            type: graphql.GraphQLID,
            description: 'the connection id'
        },
        position: {
            type: graphql.GraphQLInt,
            description: 'position in the queue'
        },
        node: {
            type: mediaEntryType,
            description: 'the media entry node'
        }
    }
});

let mediaEntryConnectionType = new graphql.GraphQLObjectType({
    name: 'MediaEntryConnection',
    fields: {
        edges: {
            type: graphql.GraphQLList(mediaEntryEdgeType)
        },
        nodes: {
            type: graphql.GraphQLList(mediaEntryType)
        },
        pageInfo: {
            type: graphql.assertNonNullType(pageInfoType),
            description: 'pagination information'
        }
    }
});

let musicPlayerType = new graphql.GraphQLObjectType({

    name: 'MusicPlayer',
    fields: {
        queue: {
            type: new graphql.GraphQLList(mediaEntryConnectionType),
            description: 'media entries in the music queue'
        },
        queueCount: {
            type: graphql.GraphQLInt,
            description: 'number of media entries in the queue'
        },
        songStartTime: {
            type: graphql.GraphQLString
        },
        playing: {
            type: graphql.GraphQLBoolean
        },
        volume: {
            type: graphql.GraphQLFloat
        },
        repeat: {
            type: graphql.GraphQLBoolean
        },
        currentSong: {
            type: mediaEntryType
        },
        quality: {
            type: graphql.GraphQLString
        },
        voiceChannel: {
            type: graphql.GraphQLString
        },
        connected: {
            type: graphql.GraphQLBoolean
        },
        paused: {
            type: graphql.GraphQLBoolean
        }
    }
});

let presenceType = new graphql.GraphQLObjectType({

    name: 'Presence',
    fields: {
        game: {
            type: graphql.GraphQLString
        },
        status: {
            type: graphql.GraphQLString
        }
    }
});

let userType = new graphql.GraphQLObjectType({

    name: 'User',
    fields: {
        id: {
            type: graphql.GraphQLID
        },
        discordId: {
            type: graphql.GraphQLID
        },
        name: {
            type: graphql.GraphQLString
        },
        avatar: {
            type: graphql.GraphQLString
        },
        bot: {
            type: graphql.GraphQLBoolean
        },
        tag: {
            type: graphql.GraphQLString
        },
        presence: {
            type: presenceType
        }
    }
});

let guildMemberType = new graphql.GraphQLObjectType({
   name: 'GuildMember',
   fields: {
       id: {
           type: graphql.assertNonNullType(graphql.GraphQLID),
           description: 'id of the guild member'
       },
       discordId: {
           type: graphql.GraphQLID
       },
       user: {
           type: userType,
           description: 'the user instance of the guild member'
       },
       nickname: {
           type: graphql.GraphQLString,
           description: 'the nickname of the guild member'
       },
       roles: {
           type: graphql.GraphQLList(roleType),
           description: 'the roles of the guild member'
       },
       highestRole: {
           type: roleType,
           description: 'the highest role of the guild member'
       }
   }
});

let userRoleEdgeType = new graphql.GraphQLObjectType({
    name: 'userRoleEdge',
    fields: {
        id: {
            type: graphql.GraphQLID,
            description: 'the connection id'
        },
        node: {
            type: guildMemberType,
            description: 'guild member edge of the role'
        },
        isHighest: {
            type: graphql.GraphQLBoolean,
            description: 'is the role the highest of the guild member'
        }
    }
});

let userRoleConnectionType = new graphql.GraphQLObjectType({
    name: 'UserRoleConnection',
    fields: {
        edges: {
            type: graphql.GraphQLList(userRoleEdgeType)
        },
        nodes: {
            type: graphql.GraphQLList(userType)
        },
        pageInfoType: {
            type: graphql.assertNonNullType(pageInfoType),
            description: 'pagination information'
        }
    }
});

let roleType = new graphql.GraphQLObjectType({

    name: 'Role',
    fields: {
        id: {
            type: graphql.GraphQLID
        },
        discordId: {
            type: graphql.GraphQLID
        },
        name: {
            type: graphql.GraphQLString
        },
        color: {
            type: graphql.GraphQLString
        },
        members: {
            type: userRoleConnectionType
        }
    }
});

let userGuildConnectionType = new graphql.GraphQLObjectType({
    name: 'UserGuildConnection',
    fields: {
        edges: {
            type: graphql.GraphQLList(guildMemberType)
        },
        nodes: {
            type: graphql.GraphQLList(userType)
        },
        pageInfoType: {
            type: graphql.assertNonNullType(pageInfoType),
            description: 'pagination information'
        }
    }
});

let guildType = new graphql.GraphQLObjectType({

    name: 'Guild',
    fields: {
        id: {
            type: graphql.GraphQLID
        },
        discordId: {
            type: graphql.GraphQLID
        },
        name: {
            type: graphql.GraphQLString
        },
        owner: {
            type: guildMemberType
        },
        members: {
            type: userGuildConnectionType
        },
        memberCount: {
            type: graphql.GraphQLInt
        },
        roles: {
            type: graphql.GraphQLList(roleType),
            description: 'the roles of the guild'
        },
        icon: {
            type: graphql.GraphQLString
        }
    }
});

let guildEdgeType = new graphql.GraphQLObjectType({
    name: 'GuildEdge',
    fields: {
        id: {
            type: graphql.GraphQLID,
            description: 'id of the connection'
        },
        node: {
            type: guildType
        },
        musicPlayer: {
            type: musicPlayerType,
            description: 'guilds music player'
        },
        savedMedia: {
            type: mediaEntryConnectionType,
            description: 'saved media entries'
        }
    }
});

let guildConnectionType = new graphql.GraphQLObjectType({
    name: 'GuildConnection',
    edges: {
        type: guildEdgeType
    },
    nodes: {
        type: graphql.GraphQLList(guildType)
    },
    pageInfo: {
        type: pageInfoType,
        description: 'pagination information'
    }
});

let clientType = new graphql.GraphQLObjectType({
    name: 'Client',
    fields: {
        guilds: {
            type: [guildType]
        },
        guildCount: {
            type: graphql.GraphQLInt
        },
        voiceConnectionCount: {
            type: graphql.GraphQLInt
        },
        user: {
            type: userType
        },
        ping: {
            type: graphql.GraphQLFloat
        },
        status: {
            type: graphql.GraphQLInt
        },
        uptime: {
            type: graphql.GraphQLInt
        }
    }
});

let logLevelEnum = new graphql.GraphQLEnumType({
    name: 'LogLevel',
    description: 'log levels of log entries',
    values: {
        SILLY: {
            value: 'silly'
        },
        DEBUG: {
            value: 'debug'
        },
        VERBOSE: {
            value: 'verbose'
        },
        INFO: {
            value: 'info'
        },
        WARN: {
            value: 'warn'
        },
        ERROR: {
            value: 'error'
        }
    }
});

let logEntryType = new graphql.GraphQLObjectType({
    name: 'LogEntry',
    fields: {
        id: {
            type: graphql.assertNonNullType(graphql.GraphQLID),
            description: 'id of the log entry'
        },
        message: {
            type: graphql.GraphQLString,
            description: 'log entry content'
        },
        level: {
            type: logLevelEnum,
            description: 'log level of the log entry'
        },
        timestamp: {
            type: graphql.GraphQLString,
            description: 'timestamp of the log entry'
        },
        module: {
            type: graphql.GraphQLString,
            description: 'module that logged the entry'
        }
    }
});

const queryType = new graphql.GraphQLObjectType({

    name: 'Query',
    fields: {
        client: {
            type: clientType,
            description: 'client instance of the bot'
        },
        presences: {
            type: graphql.assertNonNullType(graphql.GraphQLList(presenceType)),
            description: 'presences of the bot'
        },
        prefix: {
            type: graphql.GraphQLString,
            description: 'prefix of the bot'
        },
        logs: {
            type: graphql.GraphQLList(logEntryType),
            description: 'log entries of the bot'
        }
    }
});

Object.assign(exports, {
    queryType: queryType
});
