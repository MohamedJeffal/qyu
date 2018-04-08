'use strict;'

const qyu = require('../')

const commentsData = require('./sampleData/comments.json')
const postsData = require('./sampleData/posts.json')

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function resolvePostsAfter3s() {
  await wait(3000)
  return Promise.resolve(postsData).then(result => result.length)
}

function resolveComments() {
  return Promise.resolve(commentsData).then(result => result.length)
}

async function rejectAfter1s() {
  await wait(1000)
  return Promise.reject(new Error('This is veryyyyy bad'))
}

describe('General module behaviour', () => {
  jest.setTimeout(10000)

  const q = qyu({
    rateLimit: 5
  })

  afterEach(() => {
    q.clear()
  })

  test('With a concurrecy limit at 5, only 5 jobs should be executed before pausing', () => {
    let totalNumberOfProcessedJobs = 0
    q.on('done', ({ jobId, jobResult }) => {
      totalNumberOfProcessedJobs++
    })

    q.on('error', ({ jobId, error }) => {
      totalNumberOfProcessedJobs++
    })

    q.push({ job: resolvePostsAfter3s, priority: 3 })
    q.push({ job: resolveComments })
    q.push({ job: resolveComments })
    q.push({ job: rejectAfter1s })
    q.push({ job: resolveComments })
    q.push({ job: resolveComments })
    q.push({ job: resolveComments })
    q.push({ job: resolveComments })
    q.start()

    return q.pause().then(() => {
      expect(totalNumberOfProcessedJobs).toBe(5)
    })
  })

  test('Jobs should be executed in order of priority', () => {
    const rejectAfterMs = (message, timeoutInMs = 1000) => () => {
      wait(timeoutInMs)
      return Promise.reject(message)
    }

    let totalNumberOfProcessedJobs = 0
    const jobsResult = []

    q.on('error', ({ jobId, error }) => {
      totalNumberOfProcessedJobs++
      jobsResult.push(error)
    })

    q.push({ job: rejectAfterMs('First Message'), priority: 3 })
    q.push({ job: rejectAfterMs('Second Message') })
    q.push({ job: rejectAfterMs('Third Message'), priority: 2 })
    q.push({ job: rejectAfterMs('Fourth Message'), priority: 1 })
    q.push({ job: rejectAfterMs('Fifth Message'), priority: 1 })
    q.push({ job: rejectAfterMs('Sixth Message') })
    q.push({ job: rejectAfterMs('Seventh Message') })
    q.push({ job: rejectAfterMs('Eight Message') })
    q.start()

    return q.pause().then(() => {
      expect(totalNumberOfProcessedJobs).toBe(8)
      expect(jobsResult).toEqual([
        'Fourth Message',
        'Fifth Message',
        'Third Message',
        'First Message',
        'Second Message',
        'Sixth Message',
        'Seventh Message',
        'Eight Message'
      ])
    })
  })
})
