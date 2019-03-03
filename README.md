discordbot [![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0) [![CircleCI](https://circleci.com/gh/Trivernis/discordbot.js.svg?style=shield)](https://circleci.com/gh/Trivernis/discordbot.js) [![CodeFactor](https://www.codefactor.io/repository/github/trivernis/discordbot.js/badge)](https://www.codefactor.io/repository/github/trivernis/discordbot.js) 
===

A bot that does the discord thing.

`node bot.node [--token=<DiscordBotToken>] [--ytapi=<GoogleApiKey>] [--owner=<DiscordTag>] [--prefix=<Char>] [--game=<String>] [-i=<Boolen>]`

The arguments are optional because the token and youtube-api-key that the bot needs to run can also be defined in the config.json in the bot's directory:
```json5
// config.json
{
  "prefix": "_",
  "presence": "STRING",   // this will be shown when no presences are set in data/presences.txt
  "presence_duration": 300000,  // how long does the bot have one presence
  "maxCmdSequenceLength": 10, // the maximum number of commands a sequence is allowed to have
  "rateLimitCount": 5,  // the number of messages a user is allowed to send in rateLimitTime seconds
  "rateLimitTime": 10, // the time in which a user is allowed to send rateLimitCount messages (in seconds)
  "api": {
    "botToken": "YOUR DISCORD BOT TOKEN",   
    "youTubeApiKey": "YOUR YOUTUBE API KEY"
  },
  "owners": [
    "DISCORD NAME"  // specify a list of bot owners that can use the owner commands
  ],
  "music": {
    "timeout": 300000,   // exit timeout after noone is left in the voicechannel
    "livePuffer": 20000, // the preloaded video length (see ytdl-core module)
  },
  "webservice": {     // optional
    "enabled": true,  // enable the server
    "port": 8080,     // set the port
    "graphiql": false, // switch the graphiql interface on/off,
    "sessionSecret": "PROVIDE A SECURE SECRET",
    "https": {
      "enabled": true, //enable https
      "keyFile": "PATH TO YOUR SSL KEY FILE",
      "certFile": "PATH TO YOUR SSL CERTIFICATE FILE"
    }
  }
}
```

If the keys are missing from the config file, the bot exits. This behaviour can be deactivated by setting the `-i` commandline flag.
You need to create a user to access the webinterface. Use `~createUser [name] [password] [scope]` to create one (Only works via PM).
Please provide a **SECURE** `sessionSecred`.
To enable https you need a certificate and key file. Those can be generated with openssl.

Keys
---

You can get the API-Keys here:

[Discord Bot Token](https://discordapp.com/developers)

[YouTube API Key](https://console.developers.google.com)

Features
---

At the moment the bot can...
- [x] ...play music (YouTube videos and playlists)
- [x] ...save songs/playlists with a given name
- [x] ...log stuff in a database
- [x] ...execute multiple commands as a sequence
- [x] ...save command sequences with a given name
- [x] ...query AniList
- [ ] ...transform into a cow

Presences
---

You can add presences to the bot either by owner command `addpresence` or by providing a presences.txt file in the data directory. Each line represents a presence. <p style='color: f00'> When all lines are loaded by the bot, the file gets deleted.</p>

Command Sequences
---

A command sequence is a single message with several commands seperated by a semicolon.
 In a sequence the command can be ommitted if it is the same as the previous one.
 That means you can add several videos to the queue and shuffle it afterwards with the sequence
 `~play [video1] && ~play [video2]; ~play [video3] && ~shuffle`.
 
 A command sequence can be saved with `~savecmd [commandname] [sequence]`. 
 In this case the semicolon must be escaped with a backslash so it won't get interpreted as a seperate command. You can also escape sequences with `~play "whatever &&; you want"` (doublequotes). Command sequences with `&&` are executed in serial while command sequences with `;` are executed in parallel.
 A saved command can be executed with `~execute [commandname]`.

References
---

You can test a running version of the bot. [Invite bot server](https://discordapp.com/oauth2/authorize?client_id=374703138575351809&scope=bot&permissions=1983380544)

Ideas
---
- command replies saved in file (server specific file and global file)
- reddit api
- othercoolstuff api
