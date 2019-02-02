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
                Authorization: `Bearer ${sessionStorage.apiToken}`
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
                config
            }`;
    postQuery(query).then((res) => {
        let d = res.data;
        document.querySelector('#user-avatar').setAttribute('src', d.client.user.avatar);
        document.querySelector('#user-tag').innerText = d.client.user.tag;
        document.querySelector('#bot-config').innerText = d.config;
    })
}

function queryStatus() {
    let query = `{
                client {
                    ping
                    status
                    uptime
                    guildCount
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
        document.querySelector('#status-indicator').setAttribute('status', d.client.user.presence.status);
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
    if (!sessionStorage.apiToken || sessionStorage.apiToken.length < 0) {
        sessionStorage.apiToken = prompt('Please provide an api token: ');
    }
    queryStatic();
    setInterval(queryStatic, 360000);
    queryStatus();
    setInterval(queryStatus, 2000);
    queryLogs(50);
    setInterval(queryLogs, 5000);
}