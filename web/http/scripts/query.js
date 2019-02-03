let latestLogs = [];

let status = {
    0: 'ready',
    1: 'connecting',
    2: 'reconnecting',
    3: 'idle',
    4: 'nearly',
    5: 'disconnected'
};

function getSplitDuration (duration) {
    let dur = duration;
    let retObj = {};
    retObj.milliseconds = dur % 1000;
    dur = Math.round(dur / 1000);
    retObj.seconds = dur % 60;
    dur = Math.round(dur / 60);
    retObj.minutes = dur % 60;
    dur = Math.round(dur / 60);
    retObj.hours = dur % 24;
    dur = Math.round(dur / 24);
    retObj.days = dur;
    return retObj;
}

function postQuery(query) {
    return new Promise((resolve) => {
        $.post({
            url: "/graphql",
            headers: {
                Authorization: `Bearer ${localStorage.apiToken}`
            },
            data: JSON.stringify({
                query: query
            }),
            contentType: "application/json"
        }).done((res) => resolve(res));
    })
}

function queryStatic() {
    let query = `{
                client {
                    user {
                        tag
                        avatar
                    }
                }
            }`;
    postQuery(query).then((res) => {
        let d = res.data;
        document.querySelector('#user-avatar').setAttribute('src', d.client.user.avatar);
        document.querySelector('#user-tag').innerText = d.client.user.tag;
    })
}

function queryGuilds() {
    let query = `{
                client {
                    guilds {
                        id
                        name
                        dj {
                            playing
                        }
                    }
                }
            }`;
    postQuery(query).then((res) => {
        for (let guild of res.data.client.guilds) {
            if ($(`option[value=${guild.id}]`).length === 0) {
                let option = document.createElement('option');
                option.setAttribute('value', guild.id);
                if (guild.dj)
                    option.innerText = guild.dj.playing? guild.name + ' 🎶' : guild.name;
                let guildSelect = document.querySelector('#guild-select');
                guildSelect.appendChild(option);
            }
        }
    });
}

function queryGuild(guildId) {
    let query = `{
                client {
                    guilds(id: "${guildId}") {
                        name
                        icon
                        memberCount
                        owner {
                            id
                            user {
                                tag
                            } 
                        }
                    }
                }
                config
            }`;
    postQuery(query).then((res) => {
        let guild = res.data.client.guilds[0];
        document.querySelector('#guild-icon').setAttribute('src', guild.icon);
        document.querySelector('#guild-name').innerText = guild.name;
        document.querySelector('#guild-owner').innerText = guild.owner.user.tag;
        document.querySelector('#guild-owner').setAttribute('owner-id', guild.owner.id);
        document.querySelector('#guild-memberCount').innerText = guild.memberCount;
        queryGuildStatus(guildId);
        let serverinfo = $('#guildinfo');
        if (serverinfo.is(':hidden'))
            serverinfo.show();
    });
}

function queryGuildStatus(guildId) {
    let query = `{
                client {
                    guilds(id: "${guildId}") {
                        dj {
                            playing
                            connected
                            repeat
                            voiceChannel
                            songStartTime
                            currentSong {
                                name
                                url
                                thumbnail                                
                            }
                            queueCount
                            queue(first: 5) {
                                id
                                name
                                url
                                thumbnail
                            }
                        }
                    }
                }
                config
            }`;
    postQuery(query).then((res) => {
        let guild = res.data.client.guilds[0];
        document.querySelector('#dj-repeat').innerText = guild.dj.repeat? 'on': 'off';
        document.querySelector('#guild-djStatus').innerText = guild.dj.connected? 'connected' : 'disconnected';
        if (guild.dj.connected) {
            $('#dj-songinfo').show();
            document.querySelector('#guild-djStatus').innerText = guild.dj.playing? 'playing' : 'connected';
            document.querySelector('#dj-voiceChannel').innerText = guild.dj.voiceChannel;
            let songinfoContainer = $('#dj-songinfo');

            if (guild.dj.playing) {
                if (songinfoContainer.is(':hidden'))
                    songinfoContainer.show();
                document.querySelector('#songinfo-container').setAttribute('href', guild.dj.currentSong.url);
                document.querySelector('#dj-songname').innerText = guild.dj.currentSong.name;
                document.querySelector('#dj-songImg').setAttribute('src', guild.dj.currentSong.thumbnail.replace('maxresdefault', 'mqdefault'));
                let songSd = getSplitDuration(Date.now() - guild.dj.songStartTime);
                document.querySelector('#dj-songCurrentTS').innerText = `${songSd.minutes}:${songSd.seconds.toString().padStart(2, '0')}`;
                document.querySelector('#dj-songCurrentTS').setAttribute('start-ts', guild.dj.songStartTime);
                document.querySelector('#dj-queueCount').innerText = guild.dj.queueCount;
                let songContainer = document.querySelector('#dj-songQueue');
                $('.songEntry').remove();
                for (let song of guild.dj.queue) {
                    let songEntry = document.createElement('a');
                    songEntry.setAttribute('href', song.url);
                    songEntry.setAttribute('class', 'songEntry');
                    songEntry.setAttribute('song-id', song.id);
                    let imageEntry = document.createElement('img');
                    imageEntry.setAttribute('src', song.thumbnail.replace('maxresdefault', 'mqdefault'));
                    songEntry.appendChild(imageEntry);
                    let nameEntry = document.createElement('a');
                    nameEntry.innerText = song.name;
                    songEntry.appendChild(nameEntry);
                    songContainer.appendChild(songEntry);
                }
                document.querySelector('#dj-queueDisplayCount').innerText = document.querySelectorAll('.songEntry').length;
            } else {
                if (songinfoContainer.is(':not(:hidden)'))
                    songinfoContainer.hide();
            }
        } else {
            $('#dj-songinfo').hide();
            document.querySelector('#dj-voiceChannel').innerText = 'None';
        }
    });
}

function queryStatus() {
    let query = `{
                client {
                    ping
                    status
                    uptime
                    guildCount
                    voiceConnectionCount
                    user {
                        presence {
                            game
                            status
                        }
                    }
                }
            }`;
    postQuery(query).then((res) => {
        let d = res.data;
        document.querySelector('#client-ping').innerText = Math.round(d.client.ping * 10)/10 + ' ms';
        document.querySelector('#client-status').innerText = status[d.client.status];

        let sd = getSplitDuration(d.client.uptime);
        document.querySelector('#client-uptime')
            .innerText = `${sd.days}d ${sd.hours}h ${sd.minutes}min ${sd.seconds}s`;

        document.querySelector('#client-guildCount').innerText = d.client.guildCount;
        document.querySelector('#client-vcCount').innerText = d.client.voiceConnectionCount;
        if (d.client.status !== 0) {
            document.querySelector('#status-indicator').setAttribute('status', 'offline');
        } else {
            document.querySelector('#status-indicator').setAttribute('status', d.client.user.presence.status);
        }
        document.querySelector('#user-game').innerText = d.client.user.presence.game;

        setTimeout(() => {
            let sd = getSplitDuration(d.client.uptime + 1000);
            document.querySelector('#client-uptime')
                .innerText = `${sd.days}d ${sd.hours}h ${sd.minutes}min ${sd.seconds}s`;
        }, 1000);
    })
}

function queryLogs(count) {
    count = count || 5;
    let query = `{
                logs(last: ${count}, level: "verbose"){
                    id
					level
					message
					timestamp
                }
            }`;
    postQuery(query).then((res) => {
        let d = res.data;
        for (let logEntry of d.logs) {
            if (!latestLogs.find((x) => x.id === logEntry.id)) {
                let entryElem = document.createElement('div');
                entryElem.setAttribute('class', 'logEntry text-left');
                entryElem.setAttribute('log-id', logEntry.id);
                entryElem.setAttribute('level', logEntry.level);
                let infoDiv = document.createElement('div');
                infoDiv.setAttribute('class', 'infodiv');
                let lvlSpan = document.createElement('span');
                lvlSpan.innerText = logEntry.level;
                lvlSpan.setAttribute('class', 'text-left');
                infoDiv.appendChild(lvlSpan);
                let tsSpan = document.createElement('span');
                tsSpan.setAttribute('timestamp', logEntry.timestamp);
                tsSpan.innerText = moment(logEntry.timestamp, 'YY-MM-DD-HH-mm-ss').format('MMM Do HH:mm:ss');
                tsSpan.setAttribute('class', 'text-right');
                infoDiv.appendChild(tsSpan);
                entryElem.appendChild(infoDiv);
                let msgSpan = document.createElement('span');
                msgSpan.innerText = logEntry.message;
                msgSpan.setAttribute('class', 'message');
                entryElem.appendChild(msgSpan);
                let logContainer = document.querySelector('#log-container');
                logContainer.insertBefore(entryElem, logContainer.firstChild);
            }
        }
        latestLogs = d.logs;
    })
}

function startUpdating() {
    if (!localStorage.apiToken || localStorage.apiToken.length < 0) {
        localStorage.apiToken = prompt('Please provide an api token: ');
    }
    queryStatic();
    setInterval(queryStatic, 3600000);
    queryStatus();
    setInterval(queryStatus, 2000);
    queryLogs(50);
    setInterval(queryLogs, 5000);
    queryGuilds();
    setInterval(queryGuilds, 60000);
    setInterval(() => {
        let gid = $('#guild-select')[0].value;
        if (gid && gid !== 'select-default')
            queryGuildStatus(gid);
    }, 5000);
    setInterval(() => {
        let gid = $('#guild-select')[0].value;
        if (gid && gid !== 'select-default')
            queryGuild(gid);
    }, 600000);
    $('#guild-select').on('change', (ev) => {
        let fch = document.querySelector('#guild-select').firstElementChild;
        if (fch.getAttribute('value') === 'select-default')
            fch.remove();
        let guildId = ev.target.value;
        queryGuild(guildId);
    });
    setInterval(() => {
        let songSd = getSplitDuration(Date.now() - $('#dj-songCurrentTS').attr('start-ts'));
        document.querySelector('#dj-songCurrentTS').innerText = `${songSd.minutes}:${songSd.seconds.toString().padStart(2, '0')}`;
    }, 500);
}
