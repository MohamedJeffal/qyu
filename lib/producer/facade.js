'use strict;'

const EventEmitter = require('events')
const JobQueue = require('./job_queue')

module.exports = class JobProducerFacade {
  constructor(priorityQueuesCount) {
    this.standByJobsQueue = new JobQueue(priorityQueuesCount)
    this.eventEmitter = new EventEmitter()

    this.eventEmitter.on(
      'push',
      ({ job, priority }, executionEventEmitter) => {
        this.standByJobsQueue.pushJob({ job, priority })

        if (this.standByJobsQueue.currentJobCount === 1) {
          executionEventEmitter.emit('pull', this.eventEmitter)
        }
      }
    )

    this.eventEmitter.on(
      'getJobs',
      (executionEventEmitter, jobsCountToPull) => {
        const pulledJobsData = this.standByJobsQueue.pullJobs(jobsCountToPull)

        executionEventEmitter.emit(
          'pulled',
          this.eventEmitter,
          pulledJobsData
        )
      }
    )

    this.eventEmitter.on('pause', (executionEventEmitter, resolve) => {
      executionEventEmitter.emit(
        'pause',
        this.standByJobsQueue.pullAllJobs(),
        resolve
      )
    })

    this.eventEmitter.on('stop', (executionEventEmitter, resolve) => {
      this.standByJobsQueue.clear()
      executionEventEmitter.emit('stop')
      resolve()
    })
  }

  emitEvent(...args) {
    this.eventEmitter.emit(...args)
  }
}
