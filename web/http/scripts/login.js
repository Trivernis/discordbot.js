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
        document.write(res);
    });
}
