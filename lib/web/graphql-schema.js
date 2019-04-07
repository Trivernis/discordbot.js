const graphql = require('graphql'),
    md5 = require('js-md5'),
    fs = require('fs');

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

class BotGraphql {
    constructor(bot) {
        this.schema = graphql.buildSchema(fs.readFileSync('.lib/web/schema.graphqls', 'utf-8'));
        this.root = {
            Query: new Query(bot)
        };
    }
}

/**
 * Easyer managing of page info
 */
class PageInfo {
    /**
     * constructor.
     * @param total         {Number}    - the total number of entries
     * @param perPage       {Number}    - the number of entries per page
     * @param currentPage   {Number}    - the current page's index
     * @param lastPage      {Number}    - the index of the last page
     * @param hasNext       {Boolean}   - is there a next page?
     */
    constructor(total, perPage, currentPage, lastPage, hasNext) {
        this.total = total;
        this.perPage = perPage;
        this.currentPage = currentPage;
        this.lastPage = lastPage;
        this.hasNext = hasNext;
    }
}

/**
 * Generic edge
 */
class Edge {
    /**
     * contructor.
     * @param node          {Object}    - the node belonging to the edge
     * @param [edgeProps]   {Object}    - additional properties of the edge
     */
    constructor(node, edgeProps) {
        this.node = node;
        Object.assign(this, edgeProps);
    }
}

/**
 * Generic connection
 */
class Connection {
    /**
     * constructor.
     * @param edges         {Array<Edge>}   - the edges of the connection
     * @param pageInfo      {PageInfo}      - page info for the connection
     */
    constructor(edges, pageInfo) {
        this.edges = edges;
        this.nodes = this.edges.map(x => x.node);
        this.pageInfo = pageInfo;
    }
}

/**
 * Manages pagination
 */
class Paginator {
    /**
     * constructor.
     * @param edges         {Array<Object>} - the edges for the pages
     * @param perPage       {Number}        - the number of entries per page
     */
    constructor(edges, perPage) {
        this._entries = edges;
        this.perPage = perPage;
    }

    /**
     * Get the specific page
     * @param page          {Number}        - the page's number
     * @param [perPage]     {Number}        - the number of entries per page
     * @returns {Connection}
     */
    getPage(page, perPage) {
        perPage = perPage || this.perPage;
        let startIndex = (page - 1) * perPage;
        let endIndex = startIndex + perPage;
        let lastPage = Math.ceil(this._entries.length / perPage);
        return new Connection(
            this._entries.slice(startIndex, endIndex) || [],
            new PageInfo(this._entries.length, perPage, page, lastPage, page !== lastPage)
        );
    }

    /**
     * Updates the entries of the Paginator.
     * @param entries
     */
    updateEntries(entries) {
        this._entries = entries;
    }
}

class User {
    constructor(user) {

    }
}

class GuildMember {
    constructor(guildMember) {

    }
}

class MusicPlayer {
    constructor(guildHandler) {

    }
}

class Guild {
    constructor(guild) {
        this._guild = guild;
        this.name = guild.name;
        this.discordId = guild.id;
        this.id = this.discordId + generateID(['guild', this.discordId, this.name]);
        this.owner = new GuildMember(guild.owner);
        this.icon = guild.iconURL;

        this.memberPaginator = new Paginator();
        this.rolePaginator = new Paginator();
    }
}

class Client {
    constructor(bot) {
        this._bot = bot;
        this._client = bot.client;
        this.guildPaginator = new Paginator(this._getGuildEdges(), 10);
        this.user = new User(this._client.user);
    }

    _getGuildEdges() {
        return Array.from(this._client.guilds.values()).map(x => new Edge(
            new Guild(x),
            {
                musicPlayer: new MusicPlayer(this._bot.getGuildHandler(x)),
                savedMedia: (args) => new Paginator(
                    this._bot.getGuildHandler(x).db.getMediaEntries().map(x => new Edge(x)),
                    10
                ).getPage(args.page || 1, args.perPage)
            }
        ));
    }

    guilds(args) {
        if (args.id) {
            let guild = Array.from(this._client.guilds.values()).find(x => x.id === args.id);
            let gh = this._bot.getGuildHandler(guild);
            let edge = new Edge(
                new Guild(guild),
                {
                    musicPlayer: new MusicPlayer(gh),
                    savedMedia: (args) => new Paginator(
                        gh.db.getMediaEntries().map(x => new Edge(x)),
                        10
                    ).getPage(args.page || 1, args.perPage)
                }
            );
            return new Connection(
                [edge],
                new PageInfo(1, 1, 1, 1, false)
            );
        } else {
            let page = args.page || 1;
            return this.guildPaginator.getPage(page, args.perPage);
        }
    }

    get voiceConnectionCount() {
        return this._client.voiceConnections.size;
    }

    get ping() {
        return this._client.ping;
    }

    get status() {
        return this._client.status;
    }

    get uptime() {
        return this._client.uptime;
    }

}

class Query {
    constructor(bot) {
        this._bot = bot;
        this.client = new Client(bot);
    }
}
