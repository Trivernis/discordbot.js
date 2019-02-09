/* eslint-disable */

function login() {
    let username = document.querySelector('#username').value;
    let password = sha512(document.querySelector('#password').value);
    $.post({
        url: "/",
        data: JSON.stringify({
            username: username,
            password: password
        }),
        contentType: "application/json"
    }).done((res) => {
        window.location.reload();
    });
}

function handleSubmit(e) {
    if (!e)
        e = window.event;
    if (e.which === 13) {
        login();
    }
}

window.addEventListener('keydown', handleSubmit, false);
