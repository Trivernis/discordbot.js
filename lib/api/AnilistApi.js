const fetch = require('node-fetch'),
    fsx = require('fs-extra'),
    queryPath = './lib/graphql/AnilistApi',
    alApiEndpoint = 'https://graphql.anilist.co';

/**
 * Return a graphql query read from a file from a configured path.
 * @param name
 * @returns {Promise<String>}
 */
async function getGraphqlQuery(name) {
    return await fsx.readFile(`${queryPath}/${name}.gql`, {encoding: 'utf-8'});
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
                query: await getGraphqlQuery(queryName),
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
 * @param id
 * @returns {Promise<JSON>}
 */
exports.getAnimeById = async function(id) {
    let data = await postGraphqlQuery('AnimeById', {id: id});
    if (data.Media)
        return data.Media;
    else
        return null;
};

/**
 * Get a manga by id.
 * @param id
 * @returns {Promise<JSON>}
 */
exports.getMangaById = async function(id) {
    let data = await postGraphqlQuery('MangaById', {id: id});
    if (data.Media)
        return data.Media;
    else
        return null;
};

/**
 * Search for a media entry by name and return it.
 * @param name
 * @returns {Promise<JSON>}
 */
exports.searchMediaByName = async function(name) {
    let data = await postGraphqlQuery('MediaSearchByName', {name: name});
    if (data.Media)
        return data.Media;
    else
        return null;
};

/**
 * Search for an anime by name and get it by id.
 * @param name
 * @returns {Promise<*>}
 */
exports.searchAnimeByName = async function(name) {
    let data = await postGraphqlQuery('MediaSearchByName', {name: name, type: 'ANIME'});
    if (data && data.Media && data.Media.id)
        return await exports.getAnimeById(data.Media.id);
    else
        return null;
};

/**
 * Search for a manga by name and get it by id.
 * @param name
 * @returns {Promise<*>}
 */
exports.searchMangaByName = async function(name) {
    let data = await postGraphqlQuery('MediaSearchByName', {name: name, type: 'MANGA'});
    if (data && data.Media && data.Media.id)
        return await exports.getMangaById(data.Media.id);
    else
        return null;
};
