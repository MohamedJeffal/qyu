// Module entry point
'use strict;'

const util = require('util')
const EventEmitter = require('events')
const JobProducer = require('./job_producer')
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

    this.producerWorker = new JobProducer()
    this.consumerFacade = new JobConsumerFacade(
      rateLimit,
      this.emitDoneEvent,
      this.emitErrorEvent,
      this.emitDrainEvent,
      this.emitStatsEvent,
      statsInterval
    )
  }

  push({ job, priority }) {
    this.producerWorker.standbyEventsEmitter.emit(
      'push',
      { job, priority },
      this.consumerFacade
    )
  }

  start() {
    return new Promise(resolve => {
      this.consumerFacade.emit('start', resolve)
      this.consumerFacade.emit('pull', this.producerWorker.standbyEventsEmitter)
    })
  }

  pause() {
    return new Promise(resolve => {
      this.producerWorker.standbyEventsEmitter.emit(
        'pause',
        this.consumerFacade,
        resolve
      )
    })
  }

  stop() {
    return new Promise(resolve => {
      this.producerWorker.standbyEventsEmitter.emit(
        'stop',
        this.consumerFacade,
        resolve
      )
    })
  }
}
