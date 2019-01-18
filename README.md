discordbot
===

A bot that does the discord thing.

`node bot.js [--token=<DiscordBotToken>] [--ytapi=<GoogleApiKey>] [--owner=<DiscordTag>] [--prefix=<Char>] [--game=<String>]`

The arguments are optional because the token and youtube-api-key that the bot needs to run can also be defined in the config.json in the bot's directory:
```json5
// config.json
{
  "prefix": "_",
  "token": "DISCORD BOT TOKEN",
  "ytapikey": "YOUTUBE API KEY",
  "presence": "THE DEFAULT GAME IF NO presences.txt IS FOUND IN ./data/",
  "presence_duration": 300000,
  "owners": [
    "SPECIFY A LIST OF BOT-OWNERS"
  ],
  "music": {
    "timeout": 300000
  }
}
```

Features
---

At the moment the bot can...
- [x] ...play music (YouTube videos and playlists)
- [x] ...save songs/playlists with a given name
- [x] ...log stuff in a database
- [ ] ...transform into a cow

Ideas
---
- command replies saved in file (server specific file and global file)
- reddit api
- anilist api
- othercoolstuff api