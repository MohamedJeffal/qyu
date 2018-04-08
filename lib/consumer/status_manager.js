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
 * @property {string} kind - The status type (STAR|PAUSE)
 * @property {function} resolver - The promise 'resolve' function to call once this status is 'done'  
 * @property {boolean} done - Has this status been completed ?
 */

  /**
   * Push a {Status} status event and its promise resolve function into the status queue.
   * For the status to be added:
   *  - It can be the first status event added to the queue.
   *  - It must be of a different kind than the previously added status.
   * @returns {string|null} Return the status kind if successful, null otherwise
   */ 
  pushStatus(statusKind, resolve, updateStatsEventInterval) {
    if (
      this.queue.length === 0 ||
      this.queue[this.queue.length - 1].kind !== statusKind
    ) {
      this.queue.push({ kind: statusKind, resolver: resolve, done: false, updateStatsEventInterval })

      return statusKind
    }

    return null
  }

  /**
   * Clear the status queue by emptying it.
   */
  clear() {
    this.queue = []
  }

  /**
   * Update the current status state when it has been fullfilled (if not already done),
   * and call its promise resolve function.
   * @param {Status} currentStatus - The status being updated (head of the queue)
   * @param {boolean} isFullfilled - Has the current status been completed, i.e. can we go to the next one?
   * @returns {boolean} Return whether it has been updated or not.
   */
  updateCurrentStatus(currentStatus, isFullfilled) {
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
   * @param {Status} currentStatus - The status being shifted (head of the queue)
   * @param {boolean} shouldShiftStatus - Has it been completed & is the next one ready ?
   * @returns {boolean} Return whether it has been shifted or not. 
   */
  shiftCurrentStatus(currentStatus, shouldShiftStatus) {
    if (shouldShiftStatus) {
      this.queue.shift()

      return true
    }

    return false
  }

  /**
   * Perform the following updates on the queue:
   *  - Whether to update the current status state, before updating it.
   *  - Whether the queue can shift to the next status, before shifting.
   * @param {number} runningJobsCount - Current running jobs in the consumer worker.
   * @returns {boolean} - Return whether the consumer worker can pull more jobs.
   */
  updateStatusQueue(runningJobsCount) {
    if (this.queue.length === 0) {
      return false
    }

    const currentStatus = this.queue[0]
    const isPendingPause =
      currentStatus.kind === PAUSE_STATUS && runningJobsCount > 0

    if (isPendingPause) {
      return false
    }

    const isCurrentStateFullfilled =
      currentStatus.kind === PAUSE_STATUS
        ? runningJobsCount === 0
        : runningJobsCount > 0
    this.updateCurrentStatus(currentStatus, isCurrentStateFullfilled)

    const isNextStatusReady =
      currentStatus.done === true && this.queue.length > 1
    const shouldShiftStatus = isCurrentStateFullfilled && isNextStatusReady

    this.shiftCurrentStatus(currentStatus, shouldShiftStatus)

    return this.queue.length > 0 && this.queue[0].kind !== PAUSE_STATUS
  }
}
