'use strict;'

const EventEmitter = require('events')
const generateJobId = require('./utils/generate_job_id')
const JobQueue = require('./job_queue')

function JobProducer(priorityQueuesCount) {
    this.standByJobsQueue = new JobQueue(priorityQueuesCount)

    this.standbyEventsEmitter = new EventEmitter()

    this.standbyEventsEmitter.on('push', ({job, priority}, executionEventEmitter) => {
        this.standByJobsQueue.pushJob({job, priority})

        if (this.standByJobsQueue.currentJobCount === 1) {
            executionEventEmitter.emit('pull', this.standbyEventsEmitter)
        }
    })

    this.standbyEventsEmitter.on('getJobs', (executionEventEmitter, jobsCountToPull) => {
        const pulledJobs = this.standByJobsQueue.pullJobs(jobsCountToPull)

        executionEventEmitter.emit('pulled', this.standbyEventsEmitter, pulledJobs)
    })

    this.standbyEventsEmitter.on('pause', (executionEventEmitter, resolve) => {
        executionEventEmitter.emit('pause', this.standByJobsQueue.pullAllJobs(), resolve)
    })

    return this
}

module.exports = JobProducer