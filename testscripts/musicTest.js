const music = require('../lib/music.js'),
    mockclasses = require('./mockobjects.js');

function main() {
    let dj = new music.DJ(mockclasses.mockVoicechannel)
    music.setLogger({
        error: () => {},
        warn: () => {},
        info: () => {},
        verbose: () => {},
        debug: () => {}
    });
    dj.connect().then(() => {
        console.log('connected', dj.connected);
        dj.playFile('test');
        dj.playYouTube('https://www.youtube.com/watch?v=TEST');
        dj.setVolume(1);
        dj.pause();
        dj.resume();
        dj.skip();
        dj.stop();
        dj.shuffle();
        console.log(dj.playlist);
        console.log(dj.song);
        dj.clear();
        process.exit(0);
    });
}

// Executing the main function
if (typeof require !== 'undefined' && require.main === module) {
    process.on('unhandledRejection', (reason, p) => {
        console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
        throw Error('Promise rejection');
    });

    setTimeout(() => process.exit(1), 60000);
    main();
}