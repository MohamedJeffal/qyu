'use strict;'

const util = require('util')
const EventEmitter = require('events')

const JobProducerFacade = require('./producer/facade')
const JobConsumerFacade = require('./consumer/facade')

/**
 * Class abstracting over the component of an in-memory async job queue, which provides:
 *   - Methods to interact with the job queue: push, start, pause, clear.
 *   - An event interface with the following events:
 *       - done: Job success
 *       - error: Job failure
 *       - stats: Number of jobs processed within the defined interval
 *       - drain: Signals that both producer and consumer have no jobs
 */
module.exports = class Qyu extends EventEmitter {
  /**
   * @typedef {Object} QyuInputData
   * @param {number} rateLimit - Max number of concurrent jobs running (default = 5)
   * @param {number} statsInterval - An interval in ms to emit emitStatsEvent (default = 500)
   */

  /**
   * Initialize the event interface, and the producer / consumer facades.
   * @param {QyuInputData} - Qyu initialization info
   */
  constructor({ rateLimit, statsInterval } = {}) {
    super()

    this.emitDoneEvent = (jobId, jobResult) => {
      this.emit('done', { jobId, jobResult })
    }

    this.emitErrorEvent = (jobId, error) => {
      this.emit('error', { jobId, error })
    }

    this.emitStatsEvent = nbJobs => {
      this.emit('stats', { nbJobsPerInterval: nbJobs })
    }

    this.emitDrainEvent = () => {
      this.emit('drain')
    }

    this.producerFacade = new JobProducerFacade()

    this.consumerFacade = new JobConsumerFacade(
      rateLimit,
      this.emitDoneEvent,
      this.emitErrorEvent,
      this.emitDrainEvent,
      this.emitStatsEvent,
      statsInterval
    )
  }

  /**
   * @typedef {Object} InputJobData
   * @property {AsyncJob|null} job - An asynchronous function to be executed
   * @property {number} priority - The job execution priority
   */

  /**
   * Push a job and its execution priority to be executed
   * @param {InputJobData} - Client input job data to be executed
   * @returns {void}
   */
  push(jobData) {
    if (jobData) {
      this.producerFacade.emitEvent(
        'push',
        jobData,
        this.consumerFacade.eventEmitter
      )
    }
  }

  /**
   * Start / Resume the execution of jobs
   * @returns {Promise<void>} Return a promise fullfilled once job execution has begun
   */
  start() {
    return new Promise(resolve => {
      this.consumerFacade.eventEmitter.emit('start', resolve)
      this.consumerFacade.eventEmitter.emit(
        'pull',
        this.producerFacade.eventEmitter
      )
    })
  }

  /**
   * Pause the execution of jobs:
   *  - Wait until current running jobs have been executed.
   *  - Allow no more jobs to be executed while paused.
   * @returns {Promise<void>} Return a promise fullfilled once all current jobs have finished
   * & job execution has stopped.
   */
  pause() {
    return new Promise(resolve => {
      this.producerFacade.emitEvent(
        'pause',
        this.consumerFacade.eventEmitter,
        resolve
      )
    })
  }

  /**
   * Clear all components of the producer / consumer
   * @returns {Promise<void>} Return a promise fullfilled once all components have been cleared
   */
  clear() {
    return new Promise(resolve => {
      this.producerFacade.emitEvent(
        'clear',
        this.consumerFacade.eventEmitter,
        resolve
      )
    })
  }
}
