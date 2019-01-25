const mockobjects = require('./mockobjects.js'),
    sinon = require('sinon');
let Discord = require("discord.js"),
    assert = require('assert'),
    config = require('../config.json');

describe('lib/utils', function() {
    const utils = require('../lib/utils.js');

    describe('#YouTube', function() {

        it('returns if an url is valid', function(done) {
            assert(utils.YouTube.isValidUrl('https://www.youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidUrl('https://youtube.com/playlist?list=PL-ID'));
            assert(utils.YouTube.isValidUrl('https://youtube.com/watch?v='));
            assert(utils.YouTube.isValidUrl('https://www.youtube.com/playlist?list='));
            assert(utils.YouTube.isValidUrl('https://youtu.be/VIDID'));
            assert(utils.YouTube.isValidUrl('https://youtu.be/'));
            assert(utils.YouTube.isValidUrl('http://youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidUrl('http://youtube.com/playlist?list=PL-ID'));
            assert(utils.YouTube.isValidUrl('http://youtube.com/watch?v='));
            assert(utils.YouTube.isValidUrl('http://youtube.com/playlist?list='));
            assert(!utils.YouTube.isValidUrl('https://github.com'));
            assert(!utils.YouTube.isValidUrl('notevenanurl'));
            done();
        });

        it('returns if an url is a valid entity url', function(done) {
            assert(utils.YouTube.isValidEntityUrl('https://youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidEntityUrl('https://youtube.com/playlist?list=PL-ID'));
            assert(utils.YouTube.isValidEntityUrl('https://youtu.be/VIDID'));
            assert(utils.YouTube.isValidEntityUrl('http://www.youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidEntityUrl('http://youtube.com/playlist?list=PL-ID'));
            assert(!utils.YouTube.isValidEntityUrl('https://youtube.com/watch?v='));
            assert(!utils.YouTube.isValidEntityUrl('https://youtube.com/playlist?list='));
            assert(!utils.YouTube.isValidEntityUrl('https://youtu.be/'));
            assert(!utils.YouTube.isValidEntityUrl('https://github.com'));
            assert(!utils.YouTube.isValidEntityUrl('notevenanurl'));
            done();
        });

        it('returns if an url is a valid playlist url', function(done) {
            assert(!utils.YouTube.isValidPlaylistUrl('https://youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidPlaylistUrl('https://youtube.com/playlist?list=PL-ID'));
            assert(!utils.YouTube.isValidPlaylistUrl('https://youtu.be/VIDID'));
            assert(!utils.YouTube.isValidPlaylistUrl('http://www.youtube.com/watch?v=VID-ID'));
            assert(utils.YouTube.isValidPlaylistUrl('http://youtube.com/playlist?list=PL-ID'));
            assert(!utils.YouTube.isValidPlaylistUrl('http://youtube.com/playlist?list='));
            assert(!utils.YouTube.isValidPlaylistUrl('https://github.com'));
            assert(!utils.YouTube.isValidPlaylistUrl('notevenanurl'));
            done();
        });

        it('returns if an url is a valid video url', function(done) {
            assert(utils.YouTube.isValidVideoUrl('https://youtube.com/watch?v=VID-ID'));
            assert(!utils.YouTube.isValidVideoUrl('https://youtube.com/playlist?list=PL-ID'));
            assert(utils.YouTube.isValidVideoUrl('https://youtu.be/VIDID'));
            assert(utils.YouTube.isValidVideoUrl('http://www.youtube.com/watch?v=VID-ID'));
            assert(!utils.YouTube.isValidVideoUrl('http://youtube.com/playlist?list=PL-ID'));
            assert(!utils.YouTube.isValidVideoUrl('https://youtube.com/watch?v='));
            assert(!utils.YouTube.isValidVideoUrl('https://youtu.be/'));
            assert(!utils.YouTube.isValidVideoUrl('https://github.com'));
            assert(!utils.YouTube.isValidVideoUrl('notevenanurl'));
            done();
        });

        it('returns the id for a playlist url', function(done) {
            let getPlId = utils.YouTube.getPlaylistIdFromUrl;
            assert('PL-ID' === getPlId('https://youtube.com/playlist?list=PL-ID'));
            assert('PL-ID' === getPlId('http://youtube.com/playlist?list=PL-ID'));
            assert('PL-ID' === getPlId('https://www.youtube.com/playlist?list=PL-ID'));
            assert('PL-ID' === getPlId('https://www.youtube.com/playlist?list=PL-ID'));
            assert(null === getPlId('https://www.youtube.com/playlist?list='));
            done();
        });

        it('returns the id for a video url', function(done) {
            let getVidId = utils.YouTube.getVideoIdFromUrl;
            assert('VID-ID' === getVidId('https://youtube.com/watch?v=VID-ID'));
            assert('VID-ID' === getVidId('http://youtube.com/watch?v=VID-ID'));
            assert('VID-ID' === getVidId('https://www.youtube.com/watch?v=VID-ID'));
            assert('VID-ID' === getVidId('https://youtu.be/VID-ID'));
            assert(null === getVidId('https://www.faketube.com/watch?v=VID-ID'));
            assert(null === getVidId('tu.be/VID-ID'));
            assert(null === getVidId('https://youtube.com/watch?v='));
            assert(null === getVidId('https://youtu.be/'));
            done();
        });

        it('returns the video url for an id', function(done) {
            let getVid4Id = utils.YouTube.getVideoUrlFromId;
            assert('https://www.youtube.com/watch?v=VID-ID', getVid4Id('VID-ID'));
            assert('https://www.youtube.com/watch?v=12345567885432', getVid4Id('12345567885432'));
            done();
        });

        it('returns the thumbnail url for a video url', function(done) {
            let getVid4Id = utils.YouTube.getVideoUrlFromId;
            let getTh4Id = utils.YouTube.getVideoThumbnailUrlFromUrl;
            assert('https://i3.ytimg.com/vi/VIDID/maxresdefault.jpg', getTh4Id(getVid4Id('VIDID')));
            assert('https://i3.ytimg.com/vi/1234/maxresdefault.jpg', getTh4Id(getVid4Id('1234')));
            done();
        })
    });

    describe('#ConfigVerifyer', function() {
        it('verifies correct configs', function(done) {
            const testObj = {
                'key1': {
                    'key2': 'value2',
                    'key3': 'value3'
                },
                'key4': [],
                'key5': false,
                'key6': 'a longer string',
                'key7': {
                    'key8': [{
                        'key9': 'okay...'
                    }]
                }
            };
            let confVer = new utils.ConfigVerifyer(testObj, ['key1', 'key1.key3']);
            assert(confVer.verifyConfig(mockobjects.mockLogger));
            confVer = new utils.ConfigVerifyer(testObj, ['key1', 'key1.key2', 'key7.key8.0.key9']);
            assert(confVer.verifyConfig(mockobjects.mockLogger));
            confVer = new utils.ConfigVerifyer(testObj, ['key4', 'key1.key2', 'key5', 'key7']);
            assert(confVer.verifyConfig(mockobjects.mockLogger));
            done();
        });

        it('rejects invalid configs', function(done) {
            const testObj = {
            };
            let modifiedMockLogger = mockobjects.mockLogger;
            modifiedMockLogger.error = (msg) => {};
            let confVer = new utils.ConfigVerifyer(testObj, ['key1', 'key1.key3']);
            assert(!confVer.verifyConfig(mockobjects.mockLogger));
            confVer = new utils.ConfigVerifyer(testObj, ['key1', 'key1.key2', 'key7.key8.0.key9']);
            assert(!confVer.verifyConfig(mockobjects.mockLogger));
            done();
        })
    });
});

// TODO: Repair and activate later
describe('The dj class', function *() {
    const music = require('../lib/music');
    let ytdl = require("ytdl-core");
    let yttl = require('get-youtube-title');
    let ypi = require('youtube-playlist-info');

    let ytdlMock = sinon.mock(ytdl);
    let yttlMock = sinon.mock(yttl);
    let ypiMock = sinon.mock(ypi);

    it('connects to a VoiceChannel', function () {
        let dj = new music.DJ(mockobjects.mockVoicechannel);
        dj.connect();

        console.log(dj.connected);

        assert(dj.connected);
    });

    it('listens on Repeat', function() {
        let dj = new music.DJ(mockobjects.mockVoicechannel);
        dj.current = {'url': '', 'title': ''};
        dj.listenOnRepeat = true;

        assert(dj.repeat);
        assert(dj.queue.length > 0);
    });

    it('plays Files', function () {

        let dj = new music.DJ(mockobjects.mockVoicechannel);
        dj.connect();
        dj.playFile();

        assert(dj.playing);
    });

    it('plays YouTube urls', function () {

        let dj = new music.DJ(mockobjects.mockVoicechannel);
        dj.playYouTube('http://www.youtube.com/watch?v=abc');

        assert(dj.playing);
    });
});