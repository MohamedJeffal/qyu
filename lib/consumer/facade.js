'use strict;'

const EventEmitter = require('events')
const JobConsumerWorker = require('./worker')

class JobConsumerFacade extends EventEmitter {
  constructor(
    rateLimit,
    emitDoneEvent,
    emitErrorEvent,
    emitDrainEvent,
    emitStatsEvent,
    statsInterval
  ) {
    super()

    this.consumerWorker = new JobConsumerWorker(
      rateLimit,
      emitDoneEvent,
      emitErrorEvent,
      emitDrainEvent,
      emitStatsEvent,
      statsInterval
    )

    this.on('start', resolve => {
      this.consumerWorker.start(resolve)
    })

    this.on('pause', ({ jobs }, resolve) => {
      this.consumerWorker.pause(jobs, resolve)
    })

    this.on('stop', () => {
      this.consumerWorker.stop()
    })

    const pullEvent = producerEventEmitter => () =>
      this.emit('pull', producerEventEmitter)

    const getJobsEvent = producerEventEmitter => countToPull =>
      producerEventEmitter.emit('getJobs', this, countToPull)

    this.on('pull', producerEventEmitter => {
      this.consumerWorker.pull(
        getJobsEvent(producerEventEmitter),
        pullEvent(producerEventEmitter)
      )
    })

    this.on('pulled', (producerEventEmitter, { jobs, remainingJobCount }) => {
      this.consumerWorker.onPulled(pullEvent(producerEventEmitter), {
        jobs,
        remainingJobCount
      })
    })
  }
}

module.exports = JobConsumerFacade
