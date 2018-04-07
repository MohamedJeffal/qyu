'use strict;'

const StatusManager = require('./status_manager')

class JobConsumerWorker {
  constructor(
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
    this.processedJobs = 0

    this.statusManager = new StatusManager()

    this.bufferedJobsQueue = []

    // Handle this in an object
    this.emitDoneEvent = emitDoneEvent
    this.emitErrorEvent = emitErrorEvent
    this.emitDrainEvent = emitDrainEvent
    this.emitStatsEvent = emitStatsEvent
  }

  start(resolve) {
    this.statusManager.pushStatus('START', resolve)

    if (this.statsEventIntervalClearToken === null) {
      this.startStatsInterval()
    }
  }

  pause(jobs, resolve) {
    this.bufferedJobsQueue = jobs

    this.statusManager.pushStatus('PAUSE', resolve)
  }

  stop(resolve) {
    this.statusManager.clear()
    this.bufferedJobsQueue = []
    this.processedJobs = 0

    this.stopStatsInterval()
  }

  startStatsInterval(emitStatsEvent) {
    this.statsEventIntervalClearToken = setInterval(() => {
      this.emitStatsEvent(this.processedJobs)
      this.processedJobs = 0
    }, this.statsInterval)
  }

  stopStatsInterval() {
    clearInterval(this.statsEventIntervalClearToken)
    this.statsEventIntervalClearToken = null
  }

  pull(getJobsEvent, pullEvent) {
    const shouldPull = this.statusManager.updateStatusQueue(
      this.runningJobsCount
    )

    const countToPull = this.maxConcurrentJobs - this.runningJobsCount

    if (shouldPull && countToPull > 0) {
      if (this.bufferedJobsQueue.length > 0) {
        this.onPulled(pullEvent, this.getBufferedJobs(countToPull))
      } else {
        getJobsEvent(countToPull)
      }
    }
  }

  onPulled(pullEvent, { jobs, remainingJobCount }) {
    if (
      jobs.length === 0 &&
      remainingJobCount === 0 &&
      this.runningJobsCount === 0
    ) {
      this.emitDrainEvent()
    }

    if (jobs.length > 0) {
      this.executeJobs(jobs, pullEvent)
    }
  }

  getBufferedJobs(countToPull) {
    const pulledJobs = this.bufferedJobsQueue.splice(0, countToPull)

    return {
      jobs: pulledJobs,
      remainingJobCount: this.bufferedJobsQueue.length
    }
  }

  executeJobs(jobs, pullEvent) {
    this.runningJobsCount += jobs.length

    for (const job of jobs) {
      this.executeJob(job, this.jobSuccess, this.jobFailed).then(() =>
        pullEvent()
      )
    }
  }

  executeJob(job, successHandler, failureHandler) {
    return job
      .fn()
      .then(result => {
        this.updateOnJobDone()
        this.emitDoneEvent(job.id, result)
      })
      .catch(error => {
        this.updateOnJobDone()
        this.emitErrorEvent(job.id, error)
      })
  }

  updateOnJobDone() {
    this.runningJobsCount--
    this.processedJobs++
  }
}

module.exports = JobConsumerWorker
