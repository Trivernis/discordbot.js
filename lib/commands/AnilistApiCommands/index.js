const cmdLib = require('../../CommandLib'),
    anilistApi = require('../../api/AnilistApi'),
    location = './lib/commands/AnilistApiCommands';

class RichMediaInfo extends cmdLib.ExtendedRichEmbed {

    /**
     * Creates a rich embed with info for AniListApi Media.
     * @param mediaInfo
     */
    constructor(mediaInfo) {
        super(mediaInfo.title.romaji);
        this.setDescription(mediaInfo.description.replace(/<\/?.*?>/g, ''))
            .setThumbnail(mediaInfo.coverImage.large)
            .setURL(mediaInfo.siteUrl)
            .setColor(mediaInfo.coverImage.color)
            .setFooter('Provided by AniList.co');
        let fields = {
            'Genres': mediaInfo.genres.join(' '),
            'Studios': mediaInfo.studios? mediaInfo.studios.studioList.map(x => `[${x.name}](${x.siteUrl})`) : null,
            'Scoring': `**AverageScore**: ${mediaInfo.averageScore}\n**Favourites**${mediaInfo.favourites}`,
            'Episodes': mediaInfo.episodes,
            'Duration': null,
            'Season': mediaInfo.season,
            'Status': mediaInfo.status,
            'Format': mediaInfo.format
        };
        if (mediaInfo.duration)
            fields['Episode Duration'] = `${mediaInfo.duration} min`;
        if (mediaInfo.startDate.day)
            fields['Start Date'] = `${mediaInfo.startDate.day}.${mediaInfo.startDate.month}.${mediaInfo.startDate.year}`;
        if (mediaInfo.nextAiringEpisode) {
            let epInfo = mediaInfo.nextAiringEpisode;
            fields['Next Episode'] = `**Episode** ${epInfo.episode}\n**Airing at:** ${new Date(epInfo.airingAt * 1000).toUTCString()}`;
        }
        if (mediaInfo.endDate.day)
            fields['End Date'] = `${mediaInfo.endDate.day}.${mediaInfo.endDate.month}.${mediaInfo.endDate.year}`;
        this.addFields(fields);
    }
}

// -- initialize -- //

/**
 * Implementing the AniList commands module.
 */
class AniListCommandModule extends cmdLib.CommandModule {

    constructor() {
        super(cmdLib.CommandScopes.Global);
        this.templateFile = location + '/AniListCommandsTemplate.yaml';
        this.template = null;
    }

    async register(commandHandler) {
        await this._loadTemplate();
        let animeSearch = new cmdLib.Command(
            this.template.anime_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let animeData = await anilistApi.searchAnimeByName(s);
                    this._logger.silly(`Anime Query returned ${JSON.stringify(animeData)}`);
                    return new RichMediaInfo(animeData);
                } catch (err) {
                    if (err.message)
                        this._logger.verbose(err.message);
                    return this.template.anime_search.not_found;
                }
            }));

        let mangaSearch = new cmdLib.Command(
            this.template.manga_search,
            new cmdLib.Answer(async (m, k, s) => {
                try {
                    let mangaData = await anilistApi.searchMangaByName(s);
                    this._logger.silly(`Manga Query returned ${JSON.stringify(mangaData)}`);
                    return new RichMediaInfo(mangaData);
                } catch (err) {
                    if (err.message)
                        this._logger.verbose(err.message);
                    return this.template.manga_search.not_found;
                }
            })
        );

        // registering commands
        commandHandler.registerCommand(animeSearch)
            .registerCommand(mangaSearch);
    }
}

Object.assign(exports, {
    'module': AniListCommandModule
});
