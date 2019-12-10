const cmdLib = require('../../lib/command'),
    anilistApi = require('../../lib/api/AniListApi');

/**
 * The AniList commands are all commands that interact with the anilist api.
 */

/**
 * Returns a string for a name.
 * @param nameNode {String} The AniList name node in format {first, last, native}
 */
function getNameString(nameNode) {
    let name = '';
    if (nameNode.first)
        name = nameNode.first;
    if (nameNode.last)
        name += ' ' + nameNode.last;
    if (name.length === 0)
        name = nameNode.native;
    return name;
}

class RichMediaInfo extends cmdLib.ExtendedRichEmbed {

    /**
     * Creates a rich embed with info for AniListApi Media.
     * @param mediaInfo
     */
    constructor(mediaInfo) {
        super(mediaInfo.title.romaji);
        this.setThumbnail(mediaInfo.coverImage.large || mediaInfo.coverImage.medium)
            .setURL(mediaInfo.siteUrl)
            .setColor(mediaInfo.coverImage.color)
            .setFooter('Powered by AniList.co');
        if (mediaInfo.description)
            this.setDescription(mediaInfo.description
                .replace(/<\/?.*?>/g, '')
                .replace(/~!.*?!~/g, '')
                .replace(/\n\n\n/g, ''));
        let fields = {
            'Genres': mediaInfo.genres? mediaInfo.genres.join(' ') : null,
            'Studios': mediaInfo.studios? mediaInfo.studios.studioList.map(x => `[${x.name}](${x.siteUrl})`) : null,
            'Scoring': mediaInfo.averageScore? `**AverageScore**: ${mediaInfo.averageScore}\n**Favourites:** ${mediaInfo.favourites}`: null,
            'Episodes': mediaInfo.episodes,
            'Volumes': mediaInfo.volumes,
            'Chapters': mediaInfo.chapters,
            'Duration': null,
            'Season': mediaInfo.season,
            'Status': mediaInfo.status,
            'Format': mediaInfo.format
        };
        if (mediaInfo.duration)
            fields['Episode Duration'] = `${mediaInfo.duration} min`;
        if (mediaInfo.startDate && mediaInfo.startDate.day)
            fields['Start Date'] = `${mediaInfo.startDate.day}.${mediaInfo.startDate.month}.${mediaInfo.startDate.year}`;
        if (mediaInfo.nextAiringEpisode) {
            let epInfo = mediaInfo.nextAiringEpisode;
            fields['Next Episode'] = `**Episode** ${epInfo.episode}\n**Airing at:** ${new Date(epInfo.airingAt * 1000).toUTCString()}`;
        }
        if (mediaInfo.endDate && mediaInfo.endDate.day)
            fields['End Date'] = `${mediaInfo.endDate.day}.${mediaInfo.endDate.month}.${mediaInfo.endDate.year}`;
        this.addStaffInfo(mediaInfo);
        this.addFields(fields);
    }

    addStaffInfo(mediaInfo) {
        let fields = {};
        if (mediaInfo.staff && mediaInfo.staff.edges) {
            let staffContent = mediaInfo.staff.edges.map((x) => {
                let url = x.node.siteUrl;
                let name = getNameString(x.node.name);
                return `**${x.role}:** [${name}](${url})`;
            });
            let staffFieldValue = staffContent.join('\n');
            if (staffFieldValue.length > 1024) {
                let staffValues = [];
                let currentValue = '';

                for (let staffLine of staffContent) {
                    let concatValue = currentValue + '\n' + staffLine;
                    if (concatValue.length > 1024) {
                        staffValues.push(currentValue);
                        currentValue = staffLine;
                    } else {
                        currentValue = concatValue;
                    }
                }
                staffValues.push(currentValue);
                for (let i = 0; i < staffValues.length; i++)
                    fields[`Staff part ${i + 1}`] = staffValues[i];
            } else {
                fields['Staff'] = staffFieldValue;
            }
        }
        this.addFields(fields);
    }
}

class RichStaffInfo extends cmdLib.ExtendedRichEmbed {

    /**
     * A Rich Embed with informatin about an AniList staff member.
     * @param staffInfo
     */
    constructor(staffInfo) {
        super(getNameString(staffInfo.name));
        this.setThumbnail(staffInfo.image.large || staffInfo.image.medium)
            .setURL(staffInfo.siteUrl);
        let fields = {
            'Language': staffInfo.language
        };
        if (staffInfo.staffMedia && staffInfo.staffMedia.edges)
            fields['Staff Media Roles (first 10)'] = staffInfo.staffMedia.edges.map(x => {
                let node = x.node;
                let title = node.title.romaji;
                let url = node.siteUrl;
                return `[**${title}**](${url}): ${x.staffRole}`;
            }).join('\n');
        if (staffInfo.characters && staffInfo.characters.nodes)
            fields['Staff Character Roles (first 10)'] = staffInfo.characters.nodes.map(x => {
                let name = getNameString(x.name);
                let url = x.siteUrl;
                return `[${name}](${url})`;
            }).join('\n');


        this.addFields(fields);
    }
}

class RichCharacterInfo extends cmdLib.ExtendedRichEmbed {

    /**
     * A RichEmbed with information about an AniList character.
     * @param characterInfo {Object}
     */
    constructor(characterInfo) {
        super(getNameString(characterInfo.name));
        this.setURL(characterInfo.siteUrl)
            .setThumbnail(characterInfo.image.large || characterInfo.image.medium);
        if (characterInfo.description)
            this.setDescription(characterInfo.description
                .replace(/<\/?.*?>/g, '')
                .replace(/~!.*?!~/g, '')
                .replace(/\n\n\n/g, ''));
        if (characterInfo.media && characterInfo.media.edges)
            this.addField(
                'Media Appeareance',
                characterInfo.media.edges.map(x => {
                    let media = x.node;
                    let informationString = `**[${media.title.romaji}](${media.siteUrl})**: ${x.characterRole}`;
                    if (x.voiceActors && x.voiceActors.length > 0)
                        informationString += ` voice by ${x.voiceActors.map(y => {
                            return `[${getNameString(y.name)}](${y.siteUrl})`;
                        }).join(', ')}`;
                    return informationString;
                }).join('\n')
            );
    }
}

// -- initialize -- //

/**
 * Implementing the AniList commands module.
 */
class AniListCommandModule extends cmdLib.CommandModule {

    constructor() {
        super(cmdLib.CommandScopes.Global);
        this._templateDir = __dirname;
        this.template = null;
    }

    async register(commandHandler) {
        await this._loadTemplate();

        let animeSearch = new cmdLib.Command(
            this.template.anime_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let animeData = {};
                    if (/^\d+$/.test(s))
                        animeData = await anilistApi.getAnimeById(s, false, true);
                    else
                        animeData = await anilistApi.searchAnimeByName(s, false, true);
                    this._logger.silly(`Anime Query returned ${JSON.stringify(animeData)}`);
                    return new RichMediaInfo(animeData);
                } catch (err) {
                    if (err.message) {
                        this._logger.verbose(err.message);
                        this._logger.silly(err.stack);
                    } else if (err.errors) {
                        this._logger.silly(`Graphql Errors ${JSON.stringify(err.errors)}`);
                    }
                    return this.template.anime_search.response.not_found;
                }
            })
        );

        let animeStaffSearch = new cmdLib.Command(
            this.template.anime_staff_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let animeData = {};
                    if (/^\d+$/.test(s))
                        animeData = await anilistApi.getAnimeById(s, true, false);
                    else
                        animeData = await anilistApi.searchAnimeByName(s, true, false);
                    this._logger.silly(`Anime Query returned ${JSON.stringify(animeData)}`);
                    return new RichMediaInfo(animeData);
                } catch (err) {
                    if (err.message) {
                        this._logger.verbose(err.message);
                        this._logger.silly(err.stack);
                    } else if (err.errors) {
                        this._logger.silly(`Graphql Errors ${JSON.stringify(err.errors)}`);
                    }
                    return this.template.anime_staff_search.response.not_found;
                }
            })
        );

        let mangaSearch = new cmdLib.Command(
            this.template.manga_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let mangaData = {};
                    if (/^\d+$/.test(s))
                        mangaData = await anilistApi.getMangaById(s, true, true);
                    else
                        mangaData= await anilistApi.searchMangaByName(s, true, true);
                    this._logger.silly(`Manga Query returned ${JSON.stringify(mangaData)}`);
                    return new RichMediaInfo(mangaData);
                } catch (err) {
                    if (err.message) {
                        this._logger.verbose(err.message);
                        this._logger.silly(err.stack);
                    } else if (err.errors) {
                        this._logger.silly(`Graphql Errors ${JSON.stringify(err.errors)}`);
                    }
                    return this.template.manga_search.response.not_found;
                }
            })
        );

        let staffSearch = new cmdLib.Command(
            this.template.staff_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let staffData = {};
                    if (/^\d+$/.test(s))
                        staffData = await anilistApi.getStaffById(s);
                    else
                        staffData = await anilistApi.searchStaffByName(s);
                    this._logger.silly(`Staff Query returned ${JSON.stringify(staffData)}`);
                    return new RichStaffInfo(staffData);
                } catch (err) {
                    if (err.message) {
                        this._logger.verbose(err.message);
                        this._logger.silly(err.stack);
                    } else if (err.errors) {
                        this._logger.silly(`Graphql Errors ${JSON.stringify(err.errors)}`);
                    }
                    return this.template.staff_search.response.not_found;
                }
            })
        );

        let characterSearch = new cmdLib.Command(
            this.template.character_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let characterData = {};
                    if (/^\d+$/.test(s))
                        characterData = await anilistApi.getCharacterById(s);
                    else
                        characterData = await anilistApi.searchCharacterByName(s);
                    this._logger.silly(`Character Query returned ${JSON.stringify(characterData)}`);
                    return new RichCharacterInfo(characterData);
                } catch (err) {
                    if (err.message) {
                        this._logger.verbose(err.message);
                        this._logger.silly(err.stack);
                    } else if (err.errors) {
                        this._logger.silly(`Graphql Errors ${JSON.stringify(err.errors)}`);
                    }
                    return this.template.character_search.response.not_found;
                }
            })
        );

        // registering commands
        commandHandler
            .registerCommand(animeSearch)
            .registerCommand(mangaSearch)
            .registerCommand(staffSearch)
            .registerCommand(animeStaffSearch)
            .registerCommand(characterSearch);
    }
}

Object.assign(exports, {
    'module': AniListCommandModule
});
