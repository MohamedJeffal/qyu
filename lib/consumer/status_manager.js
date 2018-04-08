'use strict;'

const START_STATUS = 'START'
const PAUSE_STATUS = 'PAUSE'

/**
 * Class managing the consumer worker status:
 *   - START:
 *      * Is in progress until there are jobs being executed
 *      * Once that happens, it is 'done'
 *   - PAUSE:
 *      * Can be in progress, i.e. waiting for the current executing jobs to finish.
 *      * It is eventually 'done', when the previous phase has concluded.
 *
 * The transition between statuses happens when the current one is 'done' and the next status is available.
 * Each consecutive status must be different from the one before.
 *
 * It is initaliazed to empty state, waiting for a 'START' status.
 */
module.exports = class StatusManager {
  /**
   * Initialize an empty status queue, that will contain the consecutive statuses pushed.
   * The current status of the consumer worker is the head of the queue.
   */
  constructor() {
    this.queue = []
  }

  /**
   * @typedef {Object} Status
   * @property {string} kind - The status type (START|PAUSE)
   * @property {function} resolver - The promise 'resolve' function to call once this status is 'done'
   * @property {boolean} done - Has this status been completed ?
   * @property {function} updateStatsEventInterval - Function updating the stats event interval
   */

  /**
   * Push a {Status} status event, its promise resolve and stats event update functions into the status queue.
   * For the status to be added:
   *  - It can be the first status event added to the queue.
   *  - It must be of a different kind than the previously added status.
   * @returns {string|null} Return the status kind if successful, null otherwise
   */

  pushStatus(statusKind, resolve, updateStatsEventInterval) {
    const isStatusKindHandled =
      statusKind === START_STATUS || statusKind === PAUSE_STATUS
    const areFns =
      typeof resolve === 'function' &&
      typeof updateStatsEventInterval === 'function'

    if (
      isStatusKindHandled &&
      areFns &&
      (this.queue.length === 0 ||
        this.queue[this.queue.length - 1].kind !== statusKind)
    ) {
      this.queue.push({
        kind: statusKind,
        resolver: resolve,
        done: false,
        updateStatsEventInterval
      })

      return statusKind
    }

    return null
  }

  /**
   * Clear the status queue by emptying it.
   * @returns {void}
   */
  clear() {
    this.queue = []
  }

  /**
   * Update the current status state when it has been fullfilled (if not already done),
   * call its promise resolve and stats event update functions.
   * @param {Status} currentStatus - The status being updated (head of the queue)
   * @param {boolean} isFullfilled - Has the current status been completed, i.e. can we go to the next one?
   * @returns {boolean} Return whether it has been updated or not.
   */
  updateStatus(currentStatus, isFullfilled) {
    if (isFullfilled && currentStatus.done === false) {
      currentStatus.done = true
      currentStatus.resolver()
      currentStatus.updateStatsEventInterval()

      return true
    }

    return false
  }

  /**
   * Shift the current status when it has been completed and that the next one is ready
   * @param {boolean} shouldShiftStatus - Has it been completed & is the next one ready ?
   * @returns {boolean} Return whether it has been shifted or not.
   */
  shiftCurrentStatus(shouldShiftStatus) {
    if (shouldShiftStatus) {
      this.queue.shift()
    }

    return shouldShiftStatus
  }

  /**
   * Perform the following updates on the queue:
   *  - Whether to update the current status state, before updating it.
   *  - Whether the queue can shift to the next status, before shifting.
   * @param {number} runningJobsCount - Current running jobs in the consumer worker.
   * @returns {boolean} - Return whether the consumer worker can pull more jobs.
   */
  updateStatusQueue(runningJobsCount) {
    // Do not pull new jobs when there is no current status (i.e. the queue has just been initialized)
    if (this.queue.length === 0) {
      return false
    }

    const currentStatus = this.queue[0]
    const isPendingPause =
      currentStatus.kind === PAUSE_STATUS && runningJobsCount > 0

    // While the current PAUSE status is pending, the consumer should not pull jobs
    if (isPendingPause) {
      return false
    }

    /**
     * The current state if fullfilled when:
     *  - for PAUSE: no more jobs are running in the consumer
     *  - for START: there are jobs being run in the consumer
     */
    const isCurrentStateFullfilled =
      currentStatus.kind === PAUSE_STATUS
        ? runningJobsCount === 0
        : runningJobsCount > 0

    // Update the current status state accordingly
    this.updateStatus(currentStatus, isCurrentStateFullfilled)

    const isNextStatusReady =
      currentStatus.done === true && this.queue.length > 1

    /**
     * The current status should be shifted when it has been fullfilled and the next status is available in the queue.
     */
    const shouldShiftStatus = isCurrentStateFullfilled && isNextStatusReady

    // Update the queue accordingly
    this.shiftCurrentStatus(shouldShiftStatus)

    // Do pull jobs if the new current job is PAUSE (both when it is pending and done)
    return this.queue.length > 0 && this.queue[0].kind !== PAUSE_STATUS
  }
}
