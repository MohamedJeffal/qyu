'use strict;'

const EventEmitter = require('events')
const generateJobId = require('./utils/generate_job_id')

module.exports = function StandbyManager(priorityQueuesCount = 10) {
    this.standByQueue = []

    for (let i = 0; i < priorityQueuesCount; i++) {
        this.standByQueue.push([])
    }

    this.standbyEventsEmitter = new EventEmitter()

    this.standbyEventsEmitter.on('push', (isRunning, {job, priority}, executionHandler) => {
        this.pushJob({job, priority})

        if (isRunning() === true) {
            executionHandler.emit('pull', isRunning, this.pullJobs)
        }
    })

    this.pushJob = ({job, priority = 1}) => {
        const jobId = generateJobId()
        this.standByQueue[priority - 1].push({id: jobId, fn: job})
    }

    this.pullJobs = (jobsCountToPull) => {
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
}