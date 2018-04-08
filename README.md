# 🐍 `qyu`
An in-memory asynchronous job queue implemented for Node.js.

# Usage

```js
const qyu = require('qyu');

const statsInterval = 500

const q = qyu({
  rateLimit: 5, // maximum number of jobs being processed at the same time
  statsInterval // When stat event is sent, in ms
})

q.on('done', ({ jobId, jobResult }) => {
  console.log(`Job ${jobId} Success:, ${jobResult}`)
})

q.on('error', ({ jobId, error }) => {
  console.log(`Job ${jobId} Failed:, `, error)
})

q.on('stats', ({ nbJobsPerInterval }) => {
  console.log(`${nbJobsPerInterval} jobs / ${statsInterval} ms processed`)
})

q.on('drain', () => {
  console.log('No more jobs to do')
})

q.push(job, { // job is a function returning a promise to indicate when the job is done
  priority: 1, // from 1 to 10, 1 being the highest priority
})

q.pause() // returns a promise resolved when `q` has paused (no jobs being processed)
q.start() // returns a promise resolved when `q` has started (first time) or unpaused
q.clear() // returns a promise resolve when `q` has been reset

// example job:
async function job() {
  await wait(30);
  return {Hello: 'world!'} // That's the `jobResult`
}

function wait(ms) {
  return new Promise(resolve) {
    setTimeout(resolve, ms)
  }
}
```