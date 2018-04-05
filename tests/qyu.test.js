'use strict;'

const axios = require('axios')
const qyu = require('../index')

test('General playground', () => {
  const q = qyu({
    rateLimit: 5,
    statsInterval: 500
  })

  q.on('done', ({ jobId, jobResult }) => {
    console.log(`Success: ${jobId}, ${jobResult}`)
  })

  q.on('error', ({ jobId, error }) => {
    console.log(`Failed: ${jobId}, `, error)
  })

  q.on('stats', ({ nbJobsPerInterval }) => {
    console.log(`${nbJobsPerInterval} jobs/s processed`)
  })

  q.on('drain', () => {
    q.stop().then(() => console.log('mwaaaahahahahahahahahaahha'))
  })

  function wait(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  async function toto() {
    await wait(3000)
    return axios
      .get('https://jsonplaceholder.typicode.com/posts')
      .then(result => result.data.length)
  }

  async function titi() {
    await wait(5000)
    return axios
      .get('https://jsonplaceholder.typicode.com/posts')
      .then(result => result.data.length)
  }

  function tata() {
    return axios
      .get('https://jsonplaceholder.typicode.com/comments')
      .then(result => result.data.length)
  }

  async function tutu() {
    await wait(6000)
    return Promise.reject(new Error('This is veryyyyy bad'))
  }

  //q.start().then(data => console.log('start: ', data))
  q.push({ job: titi, priority: 3 })
  q.push({ job: tata })
  q.push({ job: tata })
  q.start().then(data => console.log('start: ', data))
  q.push({ job: tata })
  q.push({ job: tata })
  q.push({ job: tata })
  q.push({ job: tata })
  q.pause().then(data => console.log('pause: ', data))
  q.push({ job: tata })
  q.push({ job: tutu })
  q.push({ job: tata })
  q.push({ job: toto })
  // q.pause().then(data => console.log('pause: ', data))
  q.start().then(data => console.log('start: ', data))
  //q.pause().then(data => console.log('pause: ', data))
  // q.stop()
})
