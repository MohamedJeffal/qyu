'use strict;'

const START_STATUS = 'START'
const PAUSE_STATUS = 'PAUSE'

module.exports = class StatusQueue {
    constructor() {
        this.queue = []
    }

    pushStatus(statusKind, resolve) {
        if (this.queue.length === 0 || this.queue[this.queue.length - 1].kind !== statusKind) {
            this.queue.push({kind: statusKind, resolver: resolve, done: false})
        }
    }

    updateCurrentStatus(currentStatus, isFullfilled) {
        if (isFullfilled && currentStatus.done === false) {
            currentStatus.done = true
            currentStatus.resolver()
        }
    }

    shiftCurrentStatus(currentStatus, shouldShiftStatus) {
        if (shouldShiftStatus) {
            this.queue.shift()
        }
    }

    updateStatusQueue(runningJobsCount) {
        if (this.queue.length === 0) {
            return true
        }

        const currentStatus = this.queue[0]
        const isPendingPause = currentStatus.kind === PAUSE_STATUS && runningJobsCount > 0

        if (isPendingPause) {
            return false
        }

        const isCurrentStateFullfilled = currentStatus.kind === PAUSE_STATUS ? runningJobsCount === 0 : runningJobsCount > 0
        this.updateCurrentStatus(currentStatus, isCurrentStateFullfilled)


        const isNextStatusReady = currentStatus.done === true && this.queue.length > 1
        const shouldShiftStatus = currentStatus.kind === PAUSE_STATUS ? isCurrentStateFullfilled && isNextStatusReady : isNextStatusReady

        this.shiftCurrentStatus(currentStatus, shouldShiftStatus)

        return this.queue.length > 0 && this.queue[0].kind !== PAUSE_STATUS
    }
}