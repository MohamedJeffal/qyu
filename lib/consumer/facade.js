'use strict;'

const EventEmitter = require('events')
const JobConsumerWorker = require('./worker')

/**
 * Class representing the interface interacted with when working with a consumer worker,
 * through events.
 */
module.exports = class JobConsumerFacade {
  /**
   * Initialize the facade, its internal worker and event interface
   * @param {number} rateLimit - Max number of concurrent jobs running (default = 5)
   * @param {function} emitDoneEvent - Function emitting a successful job event
   * @param {function} emitErrorEvent - Function emitting a failed job event
   * @param {function} emitDrainEvent - Function emitting a job drain event
   * @param {function} emitStatsEvent - Function emitting an event for the number of job processed in an interval
   * @param {number} statsInterval - An interval in ms to emit emitStatsEvent (default = 500)
   */
  constructor(
    rateLimit,
    emitDoneEvent,
    emitErrorEvent,
    emitDrainEvent,
    emitStatsEvent,
    statsInterval
  ) {
    // Internal consumer worker
    this.consumerWorker = new JobConsumerWorker(
      rateLimit,
      emitDoneEvent,
      emitErrorEvent,
      emitDrainEvent,
      emitStatsEvent,
      statsInterval
    )

    // Event interface used to communicate with the outside world
    this.eventEmitter = new EventEmitter()

    // Mapping various features of the internal worker through events
    this.eventEmitter.on('start', resolve => {
      this.consumerWorker.start(resolve)
    })

    this.eventEmitter.on('pause', ({ jobs }, resolve) => {
      this.consumerWorker.pause(jobs, resolve)
    })

    this.eventEmitter.on('clear', () => {
      this.consumerWorker.clear()
    })

    // Define a pull event fn to be used after each executed job in the worker
    const pullEvent = producerEventEmitter => () =>
      this.eventEmitter.emit('pull', producerEventEmitter)

    // Define a fn called when the worker pulls from the producer
    const getJobsEvent = producerEventEmitter => countToPull =>
      producerEventEmitter.emit('getJobs', this.eventEmitter, countToPull)

    this.eventEmitter.on('pull', producerEventEmitter => {
      this.consumerWorker.pull(
        getJobsEvent(producerEventEmitter),
        pullEvent(producerEventEmitter)
      )
    })

    /**
     * Once jobs are pulled from the producer, this event is called so that the worker
     * can execute them.
     */
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
