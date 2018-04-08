'use strict;'

const axios = require('axios')
const qyu = require('../index')

const statsInterval = 500

const q = qyu({
  rateLimit: 5,
  statsInterval
})

q.on('done', ({ jobId, jobResult }) => {
  console.log(`Success: ${jobId}, ${jobResult}`)
})

q.on('error', ({ jobId, error }) => {
  console.log(`Failed: ${jobId}, `, error)
})

q.on('stats', ({ nbJobsPerInterval }) => {
  console.log(`${nbJobsPerInterval} jobs/${statsInterval}ms processed`)
})

q.on('drain', () => {
  console.log('Job drain')
})

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function resolvePostsAfter3s() {
  await wait(3000)
  return axios
    .get('https://jsonplaceholder.typicode.com/posts')
    .then(result => result.data.length)
}

async function resolvePostsAfter5s() {
  await wait(5000)
  return axios
    .get('https://jsonplaceholder.typicode.com/posts')
    .then(result => result.data.length)
}

function resolveComments() {
  return axios
    .get('https://jsonplaceholder.typicode.com/comments')
    .then(result => result.data.length)
}

async function rejectAfter6s() {
  await wait(6000)
  return Promise.reject(new Error('This is veryyyyy bad'))
}

q.push({ job: resolvePostsAfter5s, priority: 3 })
q.push({ job: resolveComments })
q.push({ job: resolveComments })
q.start().then(() => console.log('start done'))
q.push({ job: resolveComments })
q.push({ job: resolveComments })
q.push({ job: resolveComments })
q.push({ job: resolveComments })
q.pause().then(() => console.log('pause done'))
q.push({ job: resolveComments })
q.push({ job: rejectAfter6s })
q.push({ job: resolveComments })
q.push({ job: resolvePostsAfter3s })
q.start().then(data => console.log('start done'))
q.pause().then(() => {
  console.log('final pause done')
  q.clear()
})
