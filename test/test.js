/* eslint-disable */
const mockobjects = require('./mockobjects.js'),
    sinon = require('sinon'),
    assert = require('assert'),
    rewire = require('rewire');
let Discord = require("discord.js");

mockobjects.mockLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    verbose: () => {},
    debug: () => {}
};

describe('lib/utils', function() {
    const utils = require('../lib/utils.js');

    describe('#getSplitDuration', function() {
       it('returns an object from milliseconds', function() {
           assert(utils.getSplitDuration(1000).seconds === 1);
           assert(utils.getSplitDuration(360000).minutes === 6);
           assert(utils.getSplitDuration(3600000).hours === 1);
           assert(utils.getSplitDuration(100).milliseconds === 100);
       });
    });

    describe('#getExtension', function() {
        it('returns the correct extension for a filename', function(done) {
            assert(utils.getExtension('test.txt') === '.txt');
            assert(utils.getExtension('test.tar.gz') === '.gz');
            assert(utils.getExtension('../lib/utils.js') === '.js');
            assert(utils.getExtension('.gitignore') === '.gitignore');
            done();
        });

        it('returns null if the file has no extension or is no file', function(done) {
            assert(utils.getExtension('filenameisstrange') === null);
            assert(utils.getExtension('...') === null);
            assert(utils.getExtension(Object.create({})) === null);
            assert(utils.getExtension(null) === null);
            done();
        });
    });

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
        });
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
            assert(!confVer.verifyConfig(modifiedMockLogger));
            confVer = new utils.ConfigVerifyer(testObj, ['key1', 'key1.key2', 'key7.key8.0.key9']);
            assert(!confVer.verifyConfig(modifiedMockLogger));
            done();
        });
    });
});

describe('lib/music', function() {

    const music = rewire('../lib/music');
    const Readable = require('stream').Readable;

    music.__set__("logger", mockobjects.mockLogger);
    music.__set__("yttl", (id, cb) => {
        cb(null, 'test');
    });
    music.__set__('ytdl', () => {
        let s = new Readable();
        s._read = () => {};
        s.push('chunkofdataabc');
        s.push(null);
        return s;
    });

    describe('#DJ', function () {

        it('connects to a VoiceChannel', function (done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(()=> {
                assert(dj.connected);
                done();
            });
        });

        it('listens on Repeat', function () {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.current = {'url': '', 'title': ''};
            dj.listenOnRepeat = true;

            assert(dj.repeat);
            assert(dj.queue.length > 0);
        });

        it('plays Files', function (done) {

            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playFile();
                assert(dj.playing);
                done();
            });
        });

        it('plays YouTube urls', function (done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playYouTube('http://www.youtube.com/watch?v=ABCDEFGHIJK');
                setTimeout(() => {
                    assert(dj.playing);
                    done();
                }, 100);
            });
        });

        it('gets the video name', function (done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.getVideoName('http://www.youtube.com/watch?v=ABCDEFGHIJK').then((name) => {
                assert(name === 'test');
                done();
            });
        });

        it('sets the volume', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playFile();
                dj.setVolume(100);
                assert(dj.volume === 100);
                done();
            });
        });

        it('pauses playback', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playFile();
                dj.pause();
                done();
            });
        });

        it('resumes playback', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playFile();
                dj.resume();
                done();
            });
        });

        it('stops playback', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playFile();
                assert(dj.playing);
                dj.stop();
                assert(!dj.conn && !dj.disp);
                done();
            });
        });

        it('skips songs', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.playYouTube('http://www.youtube.com/watch?v=ABCDEFGHIJK');
                dj.playYouTube('http://www.youtube.com/watch?v=ABCDEFGHIJK');
                dj.playYouTube('http://www.youtube.com/watch?v=ABCDEFGHIJK');
                dj.playYouTube('http://www.youtube.com/watch?v=ABCDEFGHIJK');
                dj.skip();
                dj.skip();
                done();
            });
        });

        it('returns a playlist', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.queue = [{
                    'title': 'title',
                    'url': 'http://www.youtube.com/watch?v=ABCDEFGHIJK'}, {
                    'title': 'title',
                    'url': 'http://www.youtube.com/watch?v=ABCDEFGHIJK'}];
                assert(dj.playlist.length > 0);
                done();
            }).catch(() => done());
        });

        it('clears the queue', function(done) {
            let dj = new music.DJ(mockobjects.mockVoicechannel);
            dj.connect().then(() => {
                dj.queue = [{
                    'title': 'title',
                    'url': 'http://www.youtube.com/watch?v=ABCDEFGHIJK'}, {
                    'title': 'title',
                    'url': 'http://www.youtube.com/watch?v=ABCDEFGHIJK'}];
                dj.clear();
                assert(dj.queue.length === 0);
                done();
            }).catch(() => done());
        });
    });
});

describe('lib/cmd', function() {
    const cmd = rewire('../lib/cmd');
    cmd.__set__("logger", mockobjects.mockLogger);

    describe('#Servant', function() {

        it('creates commands', function() {
            let servant = new cmd.Servant('');
            servant.createCommand(mockobjects.mockCommand, mockobjects.mockCommand.textReply);
            assert(servant.commands['test']);
            servant.createCommand(mockobjects.mockCommand, mockobjects.mockCommand.promiseReply);
            assert(servant.commands['test']);
            servant.createCommand(mockobjects.mockCommand, mockobjects.mockCommand.richEmbedReply);
            assert(servant.commands['test']);
        });

        it('removes commands', function() {
            let servant = new cmd.Servant('');
            servant.createCommand(mockobjects.mockCommand, mockobjects.mockCommand.textReply);
            assert(servant.commands['test']);
            servant.removeCommand('test');
            assert(!servant.commands['test']);
        });

        it('parses commands', function() {
            let spy = sinon.spy();
            let servant = new cmd.Servant('');
            servant.createCommand(mockobjects.mockCommand, spy);
            assert(servant.commands['test']);
            assert(!spy.called);
            servant.parseCommand({
                content: 'test',
                author: {
                    tag: undefined
                }
            });
            assert(spy.called);
        });
    });
});

describe('lib/guilding', function() {
    const guilding = rewire('../lib/guilding');
    const servercommands = require('../commands/servercommands');
    const utils = require('../lib/utils');
    guilding.__set__("sqlite3", null);
    guilding.__set__("utils", {
        dirExistence: (file, callback) => {
        },
        sql: utils.sql,
        YouTube: utils.YouTube
    });
    guilding.setLogger(mockobjects.mockLogger);

    describe('#GuildHandler', function() {

        it('initializes', function() {
            let gh = new guilding.GuildHandler('test', '');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.createTables();
            gh.registerMusicCommands();
            gh.ready = true;
            assert(gh.ready);
        });

        it('destroyes itself', function() {
            let gh = new guilding.GuildHandler('test', '');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.createTables();
            gh.registerMusicCommands();
            gh.ready = true;
            gh.destroy();
            assert(!gh.dj.conn);
        });

        it('answers messages', function() {
            let gh = new guilding.GuildHandler('test', '');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.createTables();
            gh.registerMusicCommands();
            gh.ready = true;
            let msgSpy = sinon.spy();
            gh.answerMessage({
                content: 'test',
                author: {
                    tag: undefined
                },
                reply: msgSpy,
                channel: {
                    send: msgSpy
                }
            }, 'Answer');
            assert(msgSpy.called);
        });

        it('handles messages', function() {
            let gh = new guilding.GuildHandler('test', '~');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.ready = true;
            let cbSpy = sinon.spy();
            gh.servant.createCommand(mockobjects.mockCommand, cbSpy);
            assert(gh.servant.commands['~test']);
            gh.handleMessage({
                content: '~test',
                author: {
                    tag: undefined
                }});
            assert(cbSpy.called);
        });

        it('connects and plays', function(done) {
            const music = rewire('../lib/music');
            const Readable = require('stream').Readable;

            music.__set__("logger", mockobjects.mockLogger);
            music.__set__("yttl", (id, cb) => {
                cb(null, 'test');
            });
            music.__set__('ytdl', () => {
                let s = new Readable();
                s._read = () => {};
                s.push('chunkofdataabc');
                s.push(null);
                return s;
            });
            let gh = new guilding.GuildHandler('test', '~');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.ready = true;
            gh.dj = new music.DJ(mockobjects.mockVoicechannel);
            gh.connectAndPlay(mockobjects.mockVoicechannel, 'test', false).then(() => {
                done();
            });
        });

        it('handles all servercommands', function() {
            let gh = new guilding.GuildHandler('test', '~');
            gh.db = new mockobjects.MockDatabase('', ()=>{});
            gh.registerMusicCommands();
            gh.ready = true;
            let msgSpy = sinon.spy();
            let msg = {
                content: 'test',
                author: {
                    tag: undefined
                },
                reply: msgSpy,
                channel: {
                    send: msgSpy
                }
            };

            for (let category of Object.keys(servercommands))
                for (let command of Object.keys(servercommands[category])) {
                    msg.content = '~' + command;
                    gh.handleMessage(msg);
                }


            assert(msgSpy.called);
        });
    });
});
