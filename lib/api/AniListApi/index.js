const fetch = require('node-fetch'),
    fsx = require('fs-extra'),
    yaml = require('js-yaml'),
    queryPath = __dirname + '/graphql',
    alApiEndpoint = 'https://graphql.anilist.co';

async function getFragments() {
    let fragments = await fsx.readFile(`${queryPath}/Fragments.yaml`, {encoding: 'utf-8'});
    return yaml.safeLoad(fragments);
}

/**
 * Return a graphql query read from a file from a configured path.
 * @param name
 * @returns {Promise<String>}
 */
async function getGraphqlQuery(name) {
    let query = await fsx.readFile(`${queryPath}/${name}.gql`, {encoding: 'utf-8'});
    let fragments = await getFragments();
    for (let [key, value] of Object.entries(fragments))
        if (query.includes(`...${key}`))
            query += '\n' + value;
    return query;
}

/**
 * Post a query read from a file to the configured graphql endpoint and return the data.
 * @param queryName
 * @param queryVariables
 * @returns {Promise<JSON>}
 */
function postGraphqlQuery(queryName, queryVariables) {
    return new Promise(async (resolve, reject) => {
        fetch(alApiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query: (await getGraphqlQuery(queryName)),
                variables: queryVariables
            })
        }).then(async (response) => {
            let json = await response.json();
            return response.ok ? json: Promise.reject(json);
        }).then((data) => resolve(data.data)).catch((err) => reject(err));
    });
}

/**
 * Get an anime by id.
 * @param id {Number}
 * @param withStaff {Boolean} Include Staff information?
 * @param withMetadata {Boolean} Include Metadata?
 * @returns {Promise<JSON>}
 */
async function getAnimeById(id, withStaff, withMoreData) {
    let data = await postGraphqlQuery('AnimeQuery',
        {id: id, withStaff: withStaff, withMoreData: withMoreData});
    if (data && data.Media)
        return data.Media;
    else
        return null;
}

/**
 * Get a manga by id.
 * @param id {Number}
 * @param withStaff {Boolean} Include Staff information?
 * @param withMoreData {Boolean} Include Metadata?
 * @returns {Promise<JSON>}
 */
async function getMangaById(id, withStaff, withMoreData) {
    let data = await postGraphqlQuery('MangaQuery',
        {id: id, withStaff: withStaff, withMoreData: withMoreData});
    if (data && data.Media)
        return data.Media;
    else
        return null;
}

/**
 * Returns a staff member by id.
 * @param id {Number}
 * @returns {Promise<*>}
 */
async function getStaffById(id) {
    let data = await postGraphqlQuery('StaffQuery', {id: id});
    if (data && data.Staff)
        return data.Staff;
    else
        return null;
}

/**
 * Returns a character by id.
 * @param id {Number}
 * @returns {Promise<*>}
 */
async function getCharacterById(id) {
    let data = await postGraphqlQuery('CharacterQuery', {id: id});
    if (data && data.Character)
        return data.Character;
    else
        return null;
}

/**
 * Search for an anime by name and get it by id.
 * @param name {String}
 * @param withStaff {Boolean} Include Staff information?
 * @param withMoreData {Boolean} Include Metadata?
 * @returns {Promise<*>}
 */
async function searchAnimeByName(name, withStaff, withMoreData) {
    let data = await postGraphqlQuery('AnimeQuery',
        {name: name, withStaff: withStaff, withMoreData: withMoreData});
    if (data && data.Media)
        return data.Media;
    else
        return null;
}

/**
 * Search for a manga by name and get it by id.
 * @param name {String}
 * @param withStaff {Boolean} Include Staff information?
 * @param withMoreData {Boolean} Include Metadata?
 * @returns {Promise<*>}
 */
async function searchMangaByName(name, withStaff, withMoreData) {
    let data = await postGraphqlQuery('MangaQuery',
        {name: name, withStaff: withStaff, withMoreData: withMoreData});
    if (data && data.Media)
        return data.Media;
    else
        return null;
}

/**
 * Search for a staff member by name and get information.
 * @param name {String} The name of the staff member
 * @returns {Promise<*>}
 */
async function searchStaffByName(name) {
    let data = await postGraphqlQuery('StaffQuery', {name: name});
    if (data && data.Staff)
        return data.Staff;
    else
        return null;
}

/**
 * Seach for a character by name and get information.
 * @param name {String} Character Name
 * @returns {Promise<*>}
 */
async function searchCharacterByName(name) {
    let data = await postGraphqlQuery('CharacterQuery', {name: name});
    if (data && data.Character)
        return data.Character;
    else
        return null;
}

// exports
Object.assign(exports, {
    getAnimeById: getAnimeById,
    getMangaById: getMangaById,
    getStaffById: getStaffById,
    getCharacterById: getCharacterById,
    searchAnimeByName: searchAnimeByName,
    searchMangaByName: searchMangaByName,
    searchStaffByName: searchStaffByName,
    searchCharacterByName: searchCharacterByName
});
