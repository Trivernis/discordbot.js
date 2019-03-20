const graphql = require('graphql'),
    fs = require('fs');

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
     * @param edgeProps     {Object}    - additional properties of the edge
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

class MusicPlayer {
    constructor(guildHandler) {

    }
}

class Guild {
    constructor(guild) {

    }
}

class Client {
    constructor(bot) {
        this._bot = bot;
        this._client = bot.client;
        this.guildPaginator = new Paginator()
    }

    _getGuildEdges() {
        let guildHandlerPaginator = Array.from(this._client.guilds.values()).map(x => new Edge(

        ));
        return Array.from(this._client.guilds.values()).map(x => new Edge(
            new Guild(x),
            {
                musicPlayer: new MusicPlayer(this._bot.getGuildHandler(x)),
                new Connection(
                    bot.getGuildHandler(x).savedMedia
                )
            }
        ));
    }
}

class Query {
    constructor(bot) {
        this._bot = bot;
        this.client = new Client(bot);
    }
}
