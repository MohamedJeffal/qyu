'use strict;'

const StatusManager = require('./status_manager')

/**
 * Class representing a job consumer, which drives the state / execution of those jobs:
 *  - Handle a number of concurrent running jobs
 *  - Handle pausing / unpausing with its StatusManager
 *  - Its main feature is as a consumer, it decides when / how many jobs to pull from the producer
 *
 *  - It emits various events:
 *     - job done / error
 *     - jobs drain
 *     - statistics on the number of job processed in an interval
 */
module.exports = class JobConsumerWorker {
  /**
   * Initialize the job consumer and its internal components
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
    this.maxConcurrentJobs = rateLimit || 5
    // Current running job counter
    this.runningJobsCount = 0

    this.statsInterval = statsInterval || 500
    // Stats interval (to handle its cancelation)
    this.statsEventIntervalClearToken = null
    // Number of jobs processed from the star of an interval
    this.processedJobs = 0

    // Manages pause / unpause states and whether the worker should pull more jobs
    this.statusManager = new StatusManager()

    // When paused, all jobs in the producer are buffered in the consumer to keep their initial execution order intact
    this.bufferedJobsQueue = []

    // References to functions emitting events
    this.emitDoneEvent = emitDoneEvent
    this.emitErrorEvent = emitErrorEvent
    this.emitDrainEvent = emitDrainEvent
    this.emitStatsEvent = emitStatsEvent

    /**
     * Start the interval emitting an event for the number of job processed
     * @returns {boolean} Return whether the interval has been started
     */
    this.startStatsInterval = () => {
      const shoudStartInterval = this.statsEventIntervalClearToken === null

      if (shoudStartInterval) {
        this.statsEventIntervalClearToken = setInterval(() => {
          this.emitStatsEvent(this.processedJobs)
          this.processedJobs = 0
        }, this.statsInterval)
      }

      return shoudStartInterval
    }

    /**
     * Stop the interval emitting an event for the number of job processed
     * @returns {boolean} Return whether the interval has been stoppped
     */
    this.stopStatsInterval = () => {
      const shouldStopInverval = this.statsEventIntervalClearToken !== null

      if (shouldStopInverval) {
        clearInterval(this.statsEventIntervalClearToken)
        this.statsEventIntervalClearToken = null
      }

      return shouldStopInverval
    }
  }

  /**
   * Push a start status to the status manager
   * @param {function} resolve - The promise 'resolve' function to call once this status is 'done'
   * @returns {string|null} Return the status kind if successful, null otherwise
   */
  start(resolve) {
    return this.statusManager.pushStatus(
      'START',
      resolve,
      this.startStatsInterval
    )
  }

  /**
   * Buffer the producer jobs and push a pause status to the status manager
   * @param {Array<Job>} jobs - Jobs available from the producer before the pause
   * @param {function} resolve - The promise 'resolve' function to call once this status is 'done'
   * @returns {string|null} Return the status kind if successful, null otherwise
   */
  pause(jobs, resolve) {
    this.bufferedJobsQueue = jobs

    return this.statusManager.pushStatus(
      'PAUSE',
      resolve,
      this.stopStatsInterval
    )
  }

  /**
   * Clear the consumers components and cancels the stats interval
   * @returns {void}
   */
  clear() {
    this.statusManager.clear()
    this.bufferedJobsQueue = []
    this.processedJobs = 0

    this.stopStatsInterval()
  }

  /**
   * Pull jobs from the producer, while respecting:
   *  - The max number of concurrent running jobs defined
   *  - The current status of the consumer (paused or not)
   * @param {function} getJobsEvent - A function that emits an event to the producer facade, to get jobs from the producer
   * @param {function} pullEvent - A function that emits an event to the consumer facade, used for each executed job to pull new jobs
   * @returns {void}
   */
  pull(getJobsEvent, pullEvent) {
    // Check the current status
    const shouldPull = this.statusManager.updateStatusQueue(
      this.runningJobsCount
    )

    // Check the max number of jobs to pull while respecting the concurrency limit
    const countToPull = this.maxConcurrentJobs - this.runningJobsCount

    if (shouldPull && countToPull > 0) {
      if (this.bufferedJobsQueue.length > 0) {
        // If jobs were buffered after a pause, pull / execute them first.
        this.onPulled(pullEvent, this.getBufferedJobs(countToPull))
      } else {
        // Otherwise execute the event to get jobs from the producer
        getJobsEvent(countToPull)
      }
    }
  }

  /**
   * @typedef {Object} PulledJobsData
   * @property {Array<Job>} jobs - Pulled jobs
   * @param {number} remainingJobCount - Number of remaining jobs in the producer
   */

  /**
   * After pulling jobs:
   * - Check / emit job drain event
   * - Execute pulled jobs
   * @param {function} pullEvent - A function that emits an event to the consumer facade, used for each executed job to pull new jobs
   * @param {PulledJobsData} - Pulled jobs data from the producer
   * @returns {void}
   */
  onPulled(pullEvent, { jobs, remainingJobCount } = {}) {
    if (
      jobs.length === 0 &&
      remainingJobCount === 0 &&
      this.runningJobsCount === 0
    ) {
      // Emit job drain event when both producer and consumer have no jobs
      this.emitDrainEvent()
    }

    if (jobs.length > 0) {
      this.executeJobs(jobs, pullEvent)
    }
  }

  /**
   * Get a number of jobs from the buffered queue
   * @param {number} countToPull - Max number of jobs to pull
   * @returns {PulledJobsData} Return pulled jobs and the number of remaining jobs in the buffered queue
   */
  getBufferedJobs(countToPull) {
    const pulledJobs = this.bufferedJobsQueue.splice(0, countToPull)

    return {
      jobs: pulledJobs,
      remainingJobCount: this.bufferedJobsQueue.length
    }
  }

  /**
   * Execute a collection  of jobs concurrently, and:
   *  - Update the number of current running jobs
   *  - After each job completion, execute the pullEvent from the consumer facade and pull more jobs
   * @param {Array<Jobs>} jobs - Jobs to execute concurrently
   * @param {function} pullEvent - A function that emits an event to the consumer facade, used for each executed job to pull new jobs
   * @returns {void}
   */
  executeJobs(jobs, pullEvent) {
    this.runningJobsCount += jobs.length

    for (const job of jobs) {
      this.executeJob(job).then(() =>
        pullEvent()
      )
    }
  }

  /**
   * Execute an asynchronous job, and upon completion:
   *  - Update consumer job counters
   *  - Emit an event corresponding to job success or failure
   * @param {Job} job - Pulled job from producer
   * @returns {void}
   */
  executeJob(job) {
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

  /**
   * Update consumer job counters upon job completion
   * @returns {void}
   */
  updateOnJobDone() {
    this.runningJobsCount--
    this.processedJobs++
  }
}
