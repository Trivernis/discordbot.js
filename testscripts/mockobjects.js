exports.mockDispatcher = {
    pause: () => console.log('pause();'),
    resume: () => console.log('resume();'),
    setVolume: (perc) => console.log(`setVolume(${perc});`),
    on: (event, callback) => console.log(`on(${event}, ${callback});`),
    end: () => console.log('end();')
};

exports.mockConnection = {
    channel: {
        members: {
            size: 10
        },
        leave: () => console.log('leave();')
    },
    status: 0,
    playFile: (fname) => {
        console.log(`playFile(${fname});`);
        return exports.mockDispatcher;
    },
    playStream: (stream, opts) => {
        console.log(`playStream(ytdl, ${opts};`);
        return exports.mockDispatcher;
    },
    disconnect: () => console.log('disconnect();')
};

exports.mockVoicechannel = {
    name: 'mockVoicechannel',
    join: () => {
        console.log('join();');
        return new Promise((rs, rj) => rs(exports.mockConnection));
    },
    members: {
        size: 10
    },
    leave: () => console.log('leave();')
};