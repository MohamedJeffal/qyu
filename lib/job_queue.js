'use strict;'

const generateJobId = require('./utils/generate_job_id')

module.exports = class JobQueue {
    constructor(priorityQueuesCount = 10) {
        this.priorityQueues = []

        for (let i = 0; i < priorityQueuesCount; i++) {
            this.priorityQueues.push([])
        }

        this.currentJobCount = 0
    }

    pushJob({job, priority = 1}) {
        const jobId = generateJobId()
        this.priorityQueues[priority - 1].push({id: jobId, fn: job})

        this.currentJobCount++
    }

    pullJobs(jobCountToPull) {
        if (jobCountToPull === 0 || this.currentJobCount === 0) {
            return []
        }
    
        let remainingJobCountToPull = jobCountToPull
        let pulledJobs = []
    
        for (let i = 0; remainingJobCountToPull > 0 && i < this.priorityQueues.length; i++) {
            const priorityQueue = this.priorityQueues[i]
    
            if (priorityQueue.length > 0) {
                const jobs = priorityQueue.splice(0, remainingJobCountToPull)
    
                remainingJobCountToPull -= jobs.length
                pulledJobs = pulledJobs.concat(jobs)
            }
        }

        this.currentJobCount -= pulledJobs.length
    
        return pulledJobs
    }

    pullAllJobs() {
        if (this.currentJobCount === 0) {
            return []
        }

        let pulledJobs = []
    
        for (let i = 0; i < this.priorityQueues.length; i++) {
            const priorityQueue = this.priorityQueues[i]
    
            if (priorityQueue.length > 0) {
                const jobs = priorityQueue.splice(0, priorityQueue.length)
                pulledJobs = pulledJobs.concat(jobs)
            }
        }

        this.currentJobCount = 0
    
        return pulledJobs
    }

}