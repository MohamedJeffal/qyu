'use strict;'

const EventEmitter = require('events')
const JobConsumerWorker = require('./worker')

class JobConsumerFacade {
  constructor(
    rateLimit,
    emitDoneEvent,
    emitErrorEvent,
    emitDrainEvent,
    emitStatsEvent,
    statsInterval
  ) {
    this.consumerWorker = new JobConsumerWorker(
      rateLimit,
      emitDoneEvent,
      emitErrorEvent,
      emitDrainEvent,
      emitStatsEvent,
      statsInterval
    )

    this.eventEmitter = new EventEmitter()

    this.eventEmitter.on('start', resolve => {
      this.consumerWorker.start(resolve)
    })

    this.eventEmitter.on('pause', ({ jobs }, resolve) => {
      this.consumerWorker.pause(jobs, resolve)
    })

    this.eventEmitter.on('stop', () => {
      this.consumerWorker.stop()
    })

    const pullEvent = producerEventEmitter => () =>
      this.eventEmitter.emit('pull', producerEventEmitter)

    const getJobsEvent = producerEventEmitter => countToPull =>
      producerEventEmitter.emit(
        'getJobs',
        this.eventEmitter,
        countToPull
      )

    this.eventEmitter.on('pull', producerEventEmitter => {
      this.consumerWorker.pull(
        getJobsEvent(producerEventEmitter),
        pullEvent(producerEventEmitter)
      )
    })

    this.eventEmitter.on(
      'pulled',
      (producerEventEmitter, { jobs, remainingJobCount }) => {
        this.consumerWorker.onPulled(pullEvent(producerEventEmitter), {
          jobs,
          remainingJobCount
        })
      }
    )
  }
}

module.exports = JobConsumerFacade
