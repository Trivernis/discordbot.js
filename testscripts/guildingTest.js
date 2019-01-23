const guilding = require("../lib/guilding.js")
    music = require("../lib/music.js"),
    mockobjects = require("./mockobjects.js"),
    servercmd = require("../commands/servercommands");

function main() {
    guilding.setLogger(mockobjects.mockLogger);
    music.setLogger(mockobjects.mockLogger);
    console.log('Creating guildHandler instance');
    let guildHandler = new guilding.GuildHandler('TEST', '#');
    guildHandler.dj = new music.DJ(mockobjects.mockVoicechannel);

    setTimeout(() => {
        for (let [key, value] of Object.entries(servercmd.music)) {
            guildHandler.handleMessage({
                content: '#' + value.name + ' arg1 arg2 arg3 arg4',
                author: {
                    tag: undefined,
                    id: 0,
                    createdTimestamp: new Date(),
                    username: 'TEST'
                },
                member: {
                    voiceChannel: mockobjects.mockVoicechannel
                },
                channel: mockobjects.mockChannel,
                reply: mockobjects.mockChannel.send
            });
        }

        guildHandler.destroy();
        process.exit(0);
    }, 1000);
}

if (typeof require !== "undefined" && require.main === module) {
    process.on("unhandledRejection", (reason, p) => {
        console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
        throw Error("Promise rejection");
    });

    setTimeout(() => process.exit(1), 60000);
    main();
}