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
  "api": {
    "botToken": "YOUR DISCORD BOT TOKEN",   
    "youTubeApiKey": "YOUR YOUTUBE API KEY"
  },
  "owners": [
    "DISCORD NAME"  // specify a list of bot owners that can use the owner commands
  ],
  "music": {
    "timeout": 300000
  }
}
```

If the keys are missing from the config file, the bot exits. This behaviour can be deactivated by setting the `-i` commandline flag.

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
- [ ] ...transform into a cow

Presences
---

You can add presences to the bot either by owner command `addpresence` or by providing a presences.txt file in the data directory. Each line represents a presence. <p style='color: f00'> When all lines are loaded by the bot, the file gets deleted.</p>

Ideas
---
- command replies saved in file (server specific file and global file)
- reddit api
- anilist api
- othercoolstuff api