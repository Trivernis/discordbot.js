const cmdLib = require('../../../CommandLib'),
    yaml = require('js-yaml'),
    fsx = require('fs-extra'),
    templateFile = 'AniListCommandsTemplate.yaml';

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
            'Studios': mediaInfo.studios.studioList.map(x => `[${x.name}](${x.siteUrl})`),
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

let template = null;

async function init() {
    let templateString = fsx.readFile(templateFile, {encoding: 'utf-8'});
    template = yaml.safeLoad(templateString);
}

// -- exports -- //

Object.assign(exports, {
    init: init
});
