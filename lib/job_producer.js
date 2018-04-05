'use strict;'

const EventEmitter = require('events')
const generateJobId = require('./utils/generate_job_id')

function JobProducer(priorityQueuesCount = 10) {
    this.standByJobsQueue = []

    for (let i = 0; i < priorityQueuesCount; i++) {
        this.standByJobsQueue.push([])
    }

    this.standbyEventsEmitter = new EventEmitter()

    this.standbyEventsEmitter.on('push', ({job, priority}, executionEventEmitter) => {
        this.pushJob({job, priority})

        const currentJobCount = this.standByJobsQueue.reduce((totalJobCount, currentQueue) => {
            return totalJobCount + currentQueue.length
        }, 0)

        if (currentJobCount === 1) {
            executionEventEmitter.emit('pull', this.standbyEventsEmitter)
        }
    })

    this.standbyEventsEmitter.on('getJobs', (executionEventEmitter, jobsCountToPull) => {
        const pulledJobs = this.pullJobs(jobsCountToPull)

        executionEventEmitter.emit('pulled', this.standbyEventsEmitter, pulledJobs)
    })

    this.standbyEventsEmitter.on('pause', (executionEventEmitter, resolve) => {
        executionEventEmitter.emit('pause', this.pullAllJobs(), resolve)
    })

    return this
}

JobProducer.prototype.pushJob = function ({job, priority = 1}) {
    const jobId = generateJobId()
    this.standByJobsQueue[priority - 1].push({id: jobId, fn: job})
}

JobProducer.prototype.pullJobs = function (jobsCountToPull) {
    if (jobsCountToPull === 0) {
        return []
    }

    // count number of jobs instead and store it into a prop
    const currentJobCount = this.standByJobsQueue.reduce((totalJobCount, currentQueue) => {
        return totalJobCount + currentQueue.length
    }, 0)

    if (currentJobCount === 0) {
        return []
    }

    let remainingJobsCountToPull = jobsCountToPull
    let pulledJobs = []

    for (let i = 0; remainingJobsCountToPull > 0 && i < this.standByJobsQueue.length; i++) {
        const priorityQueue = this.standByJobsQueue[i]

        if (priorityQueue.length > 0) {
            const temp = priorityQueue.splice(0, remainingJobsCountToPull)

            remainingJobsCountToPull -= temp.length
            pulledJobs = pulledJobs.concat(temp)
        }
    }

    return pulledJobs
}

JobProducer.prototype.pullAllJobs = function () {
    let pulledJobs = []

    for (let i = 0; i < this.standByJobsQueue.length; i++) {
        const priorityQueue = this.standByJobsQueue[i]

        if (priorityQueue.length > 0) {
            const temp = priorityQueue.splice(0, priorityQueue.length)
            pulledJobs = pulledJobs.concat(temp)
        }
    }

    return pulledJobs
}

module.exports = JobProducer