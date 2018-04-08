'use strict;'

const generateJobId = require('../utils/generate_job_id')

/**
 * Class abstracting over job priority queues.
 */
module.exports = class JobQueue {
  /**
   * Create and initialize the handled range of priority queues.
   * Also initialize a job counter (to not calculate it each time).
   * @param {number|null} priorityQueuesCount - Number of priority queues handled (> 0).
   */
  constructor(priorityQueuesCount = 10) {
    // Job priority queues
    this.priorityQueues = []

    // If priorityQueuesCount === 0, we default to 1
    priorityQueuesCount =
      priorityQueuesCount !== null && priorityQueuesCount > 0
        ? priorityQueuesCount
        : 1
    for (let i = 0; i < priorityQueuesCount; i++) {
      this.priorityQueues.push([])
    }

    // Current job counter
    this.currentJobCount = 0
  }

  /** Asynchronous function returning a Promise
   *  @name AsyncJob
   *  @function
   *  @returns {Promise}
   */

  /**
   * Push a job into a priority queue, where 1 is the highest.
   * @param {AsyncJob|null} job - An asynchronous function to be executed
   * @param {number|null|undefined} priority - The level of priority for the job execution, 1 is top priority  (> 0 & <= priorityQueues length)
   * @returns {string|null} - Return the job id if successful, otherwise null.
   */
  pushJob({ job, priority } = {}) {
    if (
      !job ||
      typeof job !== 'function' ||
      priority === null ||
      priority <= 0 ||
      priority > this.priorityQueues.length
    ) {
      return null
    }

    const jobId = generateJobId()

    // By default, we try to push the job in the middle priority queue
    priority =
      priority === undefined
        ? Math.ceil(this.priorityQueues.length / 2)
        : priority

    this.priorityQueues[priority - 1].push({ id: jobId, fn: job, priority })

    this.currentJobCount++

    return jobId
  }

  /**
   * @typedef {Object} Job
   * @property {string} id - The job unique identifier
   * @property {AsyncJob} fn - The asynchronous job to be executed
   * @property {number} priority - The job execution priority
   */

  /**
   * @typedef {Object} PulledJobsData
   * @property {Job[]} jobs - Pulled jobs ordered by priority
   * @property {number} remainingJobCount - Total number of jobs remaining in the queue
   */

  /**
   * Pull a number of jobs by order of priority.
   * @param {number} jobCountToPull - Max number of jobs to get
   * @returns {PulledJobsData} Return the pulled jobs and the remaining number of jobs
   */
  pullJobs(jobCountToPull) {
    if (jobCountToPull === 0 || this.currentJobCount === 0) {
      return {
        jobs: [],
        remainingJobCount: this.currentJobCount
      }
    }

    let remainingJobCountToPull = jobCountToPull
    let pulledJobs = []

    /**
     * - Traverse priority queues in an ascending order, from top priority to the lowest.
     * - For each queue, remove and get the remaining number of jobs to pull
     * - Remove the number of jobs pulled in the queue from the remaining number of jobs to pull
     * - Continue iterating until the remaining number is 0 or the final queue is reached
     */
    for (
      let i = 0;
      remainingJobCountToPull > 0 && i < this.priorityQueues.length;
      i++
    ) {
      const priorityQueue = this.priorityQueues[i]

      if (priorityQueue.length > 0) {
        const jobs = priorityQueue.splice(0, remainingJobCountToPull)

        remainingJobCountToPull -= jobs.length
        pulledJobs = pulledJobs.concat(jobs)
      }
    }

    // Update the current job counter
    this.currentJobCount -= pulledJobs.length

    return { jobs: pulledJobs, remainingJobCount: this.currentJobCount }
  }

  /**
   * Pull all existing jobs by order of priority.
   * @returns {PulledJobsData} Return existing jobs and the remaining number of jobs (= 0)
   */
  pullAllJobs() {
    if (this.currentJobCount === 0) {
      return {
        jobs: [],
        remainingJobCount: this.currentJobCount
      }
    }

    let pulledJobs = []

    /**
     * - Traverse priority queues in an ascending order, from top priority to the lowest.
     * - For each queue, remove and get all existing jobs
     * - Continue iterating until the final queue is reached
     */
    for (let i = 0; i < this.priorityQueues.length; i++) {
      const priorityQueue = this.priorityQueues[i]

      if (priorityQueue.length > 0) {
        const jobs = priorityQueue.splice(0, priorityQueue.length)
        pulledJobs = pulledJobs.concat(jobs)
      }
    }

    // Update the current job counter
    this.currentJobCount = 0

    return { jobs: pulledJobs, remainingJobCount: this.currentJobCount }
  }

  /**
   * Clear all priority queues by emptying them and reset current job count
   * @returns {void}
   */
  clear() {
    this.priorityQueues = this.priorityQueues.map(() => [])

    this.currentJobCount = 0
  }
}
