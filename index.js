// Qyu entry point
const axios = require('axios')
const Qyu = require('./lib')

const q = Qyu()

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function toto() {
    await wait(10000);
    return axios.get('https://jsonplaceholder.typicode.com/posts').then(result => result.data.length)
}

function tata() {
    return axios.get('https://jsonplaceholder.typicode.com/comments').then(result => result.data.length)
}

q.push(toto)
q.push(tata)
q.start()
