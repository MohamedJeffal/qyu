'use strict;'

const EventEmitter = require('events')
const StatusManager = require('./status_manager')

function JobConsumer(
  rateLimit,
  emitDoneEvent,
  emitErrorEvent,
  emitDrainEvent,
  emitStatsEvent,
  statsInterval
) {
  this.maxConcurrentJobs = rateLimit || 1
  this.runningJobsCount = 0

  this.statsInterval = statsInterval || 2000
  this.statsEventIntervalClearToken = null

  this.statusManager = new StatusManager()

  this.bufferedJobsQueue = []

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

    this.executionEventsEmitter.emit('pulled', producerEventEmitter, {
      jobs: pulledJobs,
      remainingJobCount: this.bufferedJobsQueue.length
    })
  })

  this.executionEventsEmitter.on('pulled', (producerEventEmitter, { jobs, remainingJobCount }) => {
    if (jobs.length === 0 && remainingJobCount === 0 && this.runningJobsCount === 0) {
      emitDrainEvent()
    }

    if (jobs.length > 0) {
      this.executionEventsEmitter.emit('doJob', producerEventEmitter, jobs)
    }
  })

  this.executionEventsEmitter.on('doJob', (producerEventEmitter, jobs) => {
    this.runningJobsCount += jobs.length

    for (job of jobs) {
      job
        .fn()
        .then(result => {
          this.executionEventsEmitter.emit('jobSuccess', job.id, result, producerEventEmitter)
        })
        .catch(err =>
          this.executionEventsEmitter.emit('jobFailed', job.id, err, producerEventEmitter)
        )
    }
  })

  this.executionEventsEmitter.on('jobSuccess', (jobId, result, producerEventEmitter) => {
    this.runningJobsCount--
    this.processedJobs++

    emitDoneEvent(jobId, result)
    this.executionEventsEmitter.emit('pull', producerEventEmitter)
  })

  this.executionEventsEmitter.on('jobFailed', (jobId, error, producerEventEmitter) => {
    this.runningJobsCount--
    this.processedJobs++

    emitErrorEvent(jobId, error)
    this.executionEventsEmitter.emit('pull', producerEventEmitter)
  })

  this.executionEventsEmitter.on('start', resolve => {
    this.start(resolve)
  })

  this.executionEventsEmitter.on('pause', ({ jobs }, resolve) => {
    this.pause(jobs, resolve)
  })

  this.executionEventsEmitter.on('stop', () => {
    this.stop()
  })

  this.startStatsInterval(emitStatsEvent)

  return this
}

JobConsumer.prototype.startStatsInterval = function(emitStatsEvent) {
  this.statsEventIntervalClearToken = setInterval(() => {
    emitStatsEvent(this.processedJobs)
    this.processedJobs = 0
  }, this.statsInterval)
}

JobConsumer.prototype.stopStatsInterval = function() {
  clearInterval(this.statsEventIntervalClearToken)
  this.statsEventIntervalClearToken = null
}

JobConsumer.prototype.stop = function(resolve) {
  this.statusManager.clear()
  this.bufferedJobsQueue = []
  this.processedJobs = 0

  this.stopStatsInterval()
}

JobConsumer.prototype.start = function(resolve) {
  this.statusManager.pushStatus('START', resolve)
}

JobConsumer.prototype.pause = function(jobs, resolve) {
  this.bufferedJobsQueue = jobs

  this.statusManager.pushStatus('PAUSE', resolve)
}

module.exports = JobConsumer
