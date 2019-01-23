exports.mockDispatcher = {
    pause: () => console.log('Dispatcher.pause();'),
    resume: () => console.log('Dispatcher.resume();'),
    setVolume: (perc) => console.log(`Dispatcher.setVolume(${perc});`),
    on: (event, callback) => console.log(`Dispatcher.on(${event}, ${callback});`),
    end: () => console.log('Dispatcher.end();')
};

exports.mockConnection = {
    channel: {
        members: {
            size: 10
        },
        leave: () => console.log('Connection.leave();')
    },
    status: 0,
    playFile: (fname) => {
        console.log(`Connection.playFile(${fname});`);
        return exports.mockDispatcher;
    },
    playStream: (stream, opts) => {
        console.log(`Connection.playStream(ytdl, ${opts};`);
        return exports.mockDispatcher;
    },
    disconnect: () => console.log('Connection.disconnect();')
};

exports.mockVoicechannel = {
    name: 'mockVoicechannel',
    join: () => {
        console.log('Voicechannel.join();');
        return new Promise((rs, rj) => rs(exports.mockConnection));
    },
    members: {
        size: 10
    },
    leave: () => console.log('leave();')
};