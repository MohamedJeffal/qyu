'use strict;'

const EventEmitter = require('events')
const StatusManager = require('./status_manager')

function JobConsumer(rateLimit, emitDoneEvent, emitErrorEvent, emitStatsEvent, statsInterval) {
  this.maxConcurrentJobs = rateLimit || 1
  this.statsInterval = statsInterval || 2000
  this.statusManager = new StatusManager()

  this.bufferedJobsQueue = []

  this.runningJobsCount = 0
  this.processedJobs = 0

  this.executionEventsEmitter = new EventEmitter()

  this.executionEventsEmitter.on('pull', producerEventEmitter => {
    const shouldPull = this.statusManager.updateStatusQueue(this.runningJobsCount)

    const countToPull = this.maxConcurrentJobs - this.runningJobsCount

    if (shouldPull && countToPull > 0) {
      if (this.bufferedJobsQueue.length > 0) {
        this.executionEventsEmitter.emit('getBufferedJobs', producerEventEmitter, countToPull)
      } else {
        producerEventEmitter.emit('getJobs', this.executionEventsEmitter, countToPull)
      }
    }
  })

  this.executionEventsEmitter.on('getBufferedJobs', (producerEventEmitter, countToPull) => {
    const pulledJobs = this.bufferedJobsQueue.splice(0, countToPull)

    this.executionEventsEmitter.emit('pulled', producerEventEmitter, pulledJobs)
  })

  this.executionEventsEmitter.on('pulled', (producerEventEmitter, pulledJobs) => {
    if (pulledJobs.length > 0) {
      this.executionEventsEmitter.emit('doJob', producerEventEmitter, pulledJobs)
    }
  })

  this.executionEventsEmitter.on('doJob', (producerEventEmitter, jobs) => {
    this.runningJobsCount += jobs.length

    jobs.map(job => {
      return job
        .fn()
        .then(result =>
          this.executionEventsEmitter.emit('jobDone', job.id, result, producerEventEmitter)
        )
        .catch(err =>
          this.executionEventsEmitter.emit('jobFailed', job.id, err, producerEventEmitter)
        )
    })
  })

  this.executionEventsEmitter.on('jobDone', (jobId, result, producerEventEmitter) => {
    this.runningJobsCount--
    this.processedJobs++

    emitDoneEvent(jobId, result)
    this.executionEventsEmitter.emit('pull', producerEventEmitter)
    // return resolver(result)
  })

  this.executionEventsEmitter.on('jobFailed', (jobId, error, producerEventEmitter) => {
    this.runningJobsCount--
    this.processedJobs++

    emitErrorEvent(jobId, error)
    this.executionEventsEmitter.emit('pull', producerEventEmitter)
    // return reject(result)
  })

  this.executionEventsEmitter.on('start', resolve => {
    this.start(resolve)
  })

  this.executionEventsEmitter.on('pause', (bufferedJobs, resolve) => {
    this.bufferedJobsQueue = bufferedJobs

    this.pause(resolve)
  })

  return this
}

/*this.statsEventIntervalId = setInterval(() => {
    emitStatsEvent(this.processedJobs)
    this.processedJobs = 0
}, this.statsInterval)*/

JobConsumer.prototype.start = function(resolve) {
  this.statusManager.pushStatus('START', resolve)
}

JobConsumer.prototype.pause = function(resolve) {
  this.statusManager.pushStatus('PAUSE', resolve)
}

// this.clearStatsEventInterval = () => clearInterval(this.statsEventIntervalId)

module.exports = JobConsumer
