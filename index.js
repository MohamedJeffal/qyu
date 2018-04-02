// Qyu entry point
const axios = require('axios')
const qyu = require('./lib')

const q = qyu({
    rateLimit: 5,
    statsInterval: 1000
})

q.on('done', ({jobId, jobResult}) => {
    console.log(`Success: ${jobId}, ${jobResult}`)
})

q.on('error', ({jobId, error}) => {
    console.log(`Failed: ${jobId}, `, error)
})

q.on('stats', ({nbJobsPerSecond}) => {
    console.log(`${nbJobsPerSecond} jobs/s processed`)
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

async function tutu() {
    await wait(6000)
    return Promise.reject(new Error('This is veryyyyy bad'))
}

q.push({job: titi, priority: 3})
q.push({job: tata})
q.push({job: tata})
q.start()
q.push({job: tata})
q.push({job: tata})
q.push({job: tata})
q.push({job: tata})
q.pause()
q.push({job: tata})
q.push({job: tutu})
q.push({job: tata})
q.push({job: toto})
q.start()
// q.stop()