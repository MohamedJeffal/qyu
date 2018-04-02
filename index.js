// Qyu entry point
const axios = require('axios')
const Qyu = require('./lib')

const q = Qyu({
    rateLimit: 5
})

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function toto() {
    await wait(3000);
    return axios.get('https://jsonplaceholder.typicode.com/posts').then(result => result.data.length)
}

async function titi() {
    await wait(5000);
    return axios.get('https://jsonplaceholder.typicode.com/posts').then(result => result.data.length)
}

function tata() {
    return axios.get('https://jsonplaceholder.typicode.com/comments').then(result => result.data.length)
}

q.start()
q.push(titi)
q.push(tata)
q.push(tata)
q.push(tata)
q.push(toto)
q.pause()
q.push(tata)
q.push(tata)
q.push(tata)
q.push(tata)
q.push(tata)
q.push(tata)
q.push(tata)
q.push(tata)
q.start()