'use strict;'

const EventEmitter = require('events')
const JobQueue = require('./job_queue')

/**
 * Class representing the interface interacted with when working with a producer worker (job queue),
 * through events.
 */
module.exports = class JobProducerFacade {
  /**
   * Initialize the facade, its internal worker and event interface
   * @param {number|null} priorityQueuesCount - Number of priority queues handled (> 0).
   */
  constructor(priorityQueuesCount) {
    // Internal job queue
    this.standByJobsQueue = new JobQueue(priorityQueuesCount)

    this.eventEmitter = new EventEmitter()

    // Called when the client pushes a job
    this.eventEmitter.on(
      'push',
      ({ job, priority } = {}, executionEventEmitter) => {
        const jobId = this.standByJobsQueue.pushJob({ job, priority })

        if (jobId && this.standByJobsQueue.currentJobCount === 1) {
          executionEventEmitter.emit('pull', this.eventEmitter)
        }
      }
    )

    // Called when the consumer wants to pull jobs
    this.eventEmitter.on(
      'getJobs',
      (executionEventEmitter, jobsCountToPull) => {
        const pulledJobsData = this.standByJobsQueue.pullJobs(jobsCountToPull)

        executionEventEmitter.emit('pulled', this.eventEmitter, pulledJobsData)
      }
    )

    this.eventEmitter.on('pause', (executionEventEmitter, resolve) => {
      executionEventEmitter.emit(
        'pause',
        this.standByJobsQueue.pullAllJobs(),
        resolve
      )
    })

    this.eventEmitter.on('clear', (executionEventEmitter, resolve) => {
      this.standByJobsQueue.clear()
      executionEventEmitter.emit('clear')
      resolve()
    })
  }

  /**
   * Internal event emitter helper
   * @param {Array<any>} args - Args passed to the emit() method
   * @returns {void}
   */
  emitEvent(...args) {
    this.eventEmitter.emit(...args)
  }
}
