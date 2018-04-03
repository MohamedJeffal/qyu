'use strict;'

const EventEmitter = require('events')
const generateJobId = require('./utils/generate_job_id')

function JobProducer(priorityQueuesCount = 10) {
    this.standByQueue = []

    for (let i = 0; i < priorityQueuesCount; i++) {
        this.standByQueue.push([])
    }

    this.standbyEventsEmitter = new EventEmitter()

    this.standbyEventsEmitter.on('push', ({job, priority}, executionEventEmitter) => {
        this.pushJob({job, priority})

        executionEventEmitter.emit('pull', this.standbyEventsEmitter)
    })

    this.standbyEventsEmitter.on('getJobs', (executionEventEmitter, jobsCountToPull) => {
        const pulledJobs = this.pullJobs(jobsCountToPull)

        executionEventEmitter.emit('pulled', this.standbyEventsEmitter, pulledJobs)
    })

    return this
}

JobProducer.prototype.pushJob = function ({job, priority = 1}) {
    const jobId = generateJobId()
    this.standByQueue[priority - 1].push({id: jobId, fn: job})
}

JobProducer.prototype.pullJobs = function (jobsCountToPull) {
    const currentJobCount = this.standByQueue.reduce((totalJobCount, currentQueue) => {
        return totalJobCount + currentQueue.length
    }, 0)

    if (currentJobCount === 0) {
        return []
    }

    let remainingJobsCountToPull = jobsCountToPull
    let pulledJobs = []

    for (let i = 0; remainingJobsCountToPull > 0 && i < this.standByQueue.length; i++) {
        const priorityQueue = this.standByQueue[i]

        if (priorityQueue.length > 0) {
            const temp = priorityQueue.splice(0, remainingJobsCountToPull)

            remainingJobsCountToPull -= temp.length
            pulledJobs = pulledJobs.concat(temp)
        }
    }

    return pulledJobs
}

module.exports = JobProducer