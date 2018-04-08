'use strict;'

const util = require('util')
const EventEmitter = require('events')

const JobProducerFacade = require('./producer/facade')
const JobConsumerFacade = require('./consumer/facade')

/**
 * TODO:
 * - Base async queue => done
 * - Add concurrency limit: make sure it doesn't clash with pausing => done
 * - Make qyu extend event emitter & add listeners:
 *      - done & error => done
 *      - drain => when queue + buffer are empty => done
 *      - stats => done
 * - Implementing start(), pause() returning promises => done
 * - Handling job priority => done
 * - Adding stop(): clears everything => done
 * - Handle bad input data
 * - Clean code
 * - Docs
 * - Unit tests
 * - Examples
 */
module.exports = class Qyu extends EventEmitter {
  constructor({ rateLimit, statsInterval }) {
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

  push(jobData) {
    if (jobData) {
      this.producerFacade.emitEvent(
        'push',
        jobData,
        this.consumerFacade.eventEmitter
      )
    }
  }

  start() {
    return new Promise(resolve => {
      this.consumerFacade.eventEmitter.emit('start', resolve)
      this.consumerFacade.eventEmitter.emit(
        'pull',
        this.producerFacade.eventEmitter
      )
    })
  }

  pause() {
    return new Promise(resolve => {
      this.producerFacade.emitEvent(
        'pause',
        this.consumerFacade.eventEmitter,
        resolve
      )
    })
  }

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
