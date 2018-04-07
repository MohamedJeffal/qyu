'use strict;'

const EventEmitter = require('events')
const generateJobId = require('./utils/generate_job_id')
const JobQueue = require('./job_queue')

module.exports = class JobProducer {
  constructor(priorityQueuesCount) {
    this.standByJobsQueue = new JobQueue(priorityQueuesCount)
    this.standbyEventsEmitter = new EventEmitter()

    this.standbyEventsEmitter.on(
      'push',
      ({ job, priority }, executionEventEmitter) => {
        this.standByJobsQueue.pushJob({ job, priority })

        if (this.standByJobsQueue.currentJobCount === 1) {
          executionEventEmitter.emit('pull', this.standbyEventsEmitter)
        }
      }
    )

    this.standbyEventsEmitter.on(
      'getJobs',
      (executionEventEmitter, jobsCountToPull) => {
        const pulledJobsData = this.standByJobsQueue.pullJobs(jobsCountToPull)

        executionEventEmitter.emit(
          'pulled',
          this.standbyEventsEmitter,
          pulledJobsData
        )
      }
    )

    this.standbyEventsEmitter.on('pause', (executionEventEmitter, resolve) => {
      executionEventEmitter.emit(
        'pause',
        this.standByJobsQueue.pullAllJobs(),
        resolve
      )
    })

    this.standbyEventsEmitter.on('stop', (executionEventEmitter, resolve) => {
      this.standByJobsQueue.clear()
      executionEventEmitter.emit('stop')
      resolve()
    })
  }
}
