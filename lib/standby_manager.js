'use strict;'

const EvenEmitter = require('events')

module.exports = function StandbyManager() {
    this.standByQueue = []

    this.standbyEventsEmitter = new EvenEmitter()

    this.standbyEventsEmitter.on('push', (isStarted, job, executionHandler) => {
        this.standByQueue.push(job)

        if (isStarted() === true) {
            executionHandler.emit('pull', isStarted, this.pullJobs)
        }
    })

    this.pullJobs = (jobsCountToPull) => {
        return this.standByQueue.splice(0, jobsCountToPull)
    }
}