const cmd = require("../lib/cmd.js"),
  mockobjects = require("./mockobjects.js"),
  servercmd = require('../commands/servercommands');

function main() {
    cmd.setLogger(mockobjects.mockLogger);
    console.log('Creating new servant instance');
    let servant = new cmd.Servant('#');
    console.log('registering all music commands...');

    for (let [key, value] of Object.entries(servercmd.music)) {
        servant.createCommand(value, () => {
            console.log(`   -   invoked ${value.name} callback`);
        });
    }

    console.log('parsing and deleting all music commands...');
    for (let [key, value] of Object.entries(servercmd.music)) {
        servant.parseCommand({
            content: '#' + value.name,
            author: {
                tag: undefined
            }
        });
        servant.removeCommand(value.name);
    }

    process.exit(0);
}

if (typeof require !== "undefined" && require.main === module) {
  process.on("unhandledRejection", (reason, p) => {
    console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    throw Error("Promise rejection");
  });

  setTimeout(() => process.exit(1), 60000);
  main();
}