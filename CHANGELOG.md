# Changelog
All notable changes to the discord bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Fixed
- bug where the bot counts itself when calculating needed votes to skip/stop music
- bug on the `ExtendedRichEmbed` where `addField` and `setDescription` throws an error when the value is null or undefined
- bug on `AnilistApiCommands` where the `RichCharacterInfo` uses a nonexistent function of the `ExtendedRichEmbed`
- bug on`AnilistApi` where the `.gql` files couldn't be found.
- Typo in changelog
- bug on `~np` message that causes the player to crash

### Changed
- name of MiscCommands module from `TemplateCommandModule` to `MiscCommandModule`
- moved everything in `lib` to subfolders with the same name as the files and renamed the files to `index.js`
- renamed libfolders to lowercase and removed the lib suffix
- moved commands outside of `lib`
- switched from opusscript to node-opus for voice
- all hard coded sql statements to generic sql generation
- MusicPlayer to extend the default EventEmitter
- MessageHandler to accept instances of Response and redirect events to it
- switched to `ytdl-core-discord` for youtube audio playback

### Added
- Utility classes for generic SQL Statements
- logging of unrejected promises
- database class for database abstraction (lib/database)
- config entry for `database` with supported values `postgresql` or `sqlite`
- config entry for `databaseConnection` for postgresql (`user`, `host`, `password`, `database`, `port`)
- table `settings` to each guild to store guild specific settings
- table `messages` to main database where messages are stored for statistical analysis and bug handling
- ExtendedEventEmitter class in lib/utils/extended-events.js
- Response object that allows the registration of events for messages
- Handling of error event for every VoiceConnection

### Removed
- `~volume` command because volume can't be controlled anymore
- volume functions and properties from the MusicPlayer

## [0.11.0-beta] - 2019-03-03
### Changed
- template Files to name `template.yaml`
- loading template file form CommandModule property `templateFile` to loading the `template.yaml` file from the `_templateDir` property (still supporting loading form templateFile)
- ExtendedRichEmbed checks if fields are empty again after replacing values

### Added
- `.template` to commands as a template for a command module with help comments
- *METADATA* property to `template.yaml` files that is used as an anchor for shared command metadata (like `category`)
- `CommandModule` **Misc** with command that are not really fitting into any other module
- option to query this CHANGELOG with `_changes [version]` and `_versions` in the `CommandModule` **Info**

### Removed
- `ExtendedRichEmbed.addNonemptyField` because the overide of `.addField` does the same

## [0.10.1]-beta - 2019-03-03
### Changed
- Bugfix on RichEmbed not returning itself on addField and setDescription because of method overide
- AniList CommandModule bug fix on `~alCharacter` not returning voice actor names

## [0.10.0-beta] - 2019-03-03
### Added
- AniList api commands powered by [AniList.co](https://www.anilist.co)
- MessageHandler - handles all incoming messages, parses the syntax, executes the syntax and handles rate limits
- CommandHandler - handles all single commands, checks command Permission and executes the command
- Command - represents a single command with the necessary metadata and answer instance
- Answer - represents a commands answer with own syntax parsing (can be overwritten)
- CommandModule - represents a single module of a command with the initialization and registring of command to the command handler. Each module owns an instance of the logger
- ExtendedRichEmbed - extends the functinality of the default discord.js RichEmbed with auto cropping of too long field values, functions to add an Object with fields that are not empty and automatic timestamp addition

### Changed
- Command Syntax now orients more on linux/unix style with `&&` and `;`
- GuildHandler now doesn't handle commands anymore
- the default logger is now a wrapper around the winston.js logger that loggs the current module's name
- all commands are now defined in the lib/commands folder with a folder for each command that contains a `index.js` and a `CommandTemplate.yaml`.
- Rate Limits now only affect commands
- Music commands `~skip` and `~stop` now are votable when the user doesn't have the role *dj* or *botcommander*
- renamed the lib/music to lib/MusicLib and the DJ class to MusicHandler class
- renamed the lib/weblib to lib/WebLib
- changed graphql schema to fit the new internal names
- changed interface to fit the new graphql schema
- changed module export definition to `Object.assign(exports, {...})` at the end of the module file
- added section `commandSettings` to config.js file
- added module information to webinterface log

### Removed
- removed lib/cmd because all functionalities are now adapted to the MessageHandler and CommadnHandlers
