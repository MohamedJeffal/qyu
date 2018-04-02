'use strict;'

const EvenEmitter = require('events')

module.exports = function ExecutionManager(rateLimit) {
    this.maxConcurrentJobs = rateLimit || 1
    this.runningJobsCount = 0

    this.executionEventsEmitter = new EvenEmitter()

    this.executionEventsEmitter.on('pull', (isStarted, pullJobsFn) => {
        const countToPull = this.maxConcurrentJobs - this.runningJobsCount
        if (countToPull > 0) {
            const jobs = pullJobsFn(countToPull)
    
            if (jobs.length > 0) {
                this.executionEventsEmitter.emit('doJob', isStarted, jobs, pullJobsFn)
            }
        }
    })
    
    this.executionEventsEmitter.on('doJob', (isStarted, jobs, pullJobsFn) => {
        this.runningJobsCount += jobs.length
    
        jobs.map(job => job().then(result => this.executionEventsEmitter.emit('jobDone', isStarted, result, pullJobsFn)))
    })
    
    this.executionEventsEmitter.on('jobDone', (isStarted, result, pullJobsFn) => {
        this.runningJobsCount--
    
        if (isStarted() === true) {
            this.executionEventsEmitter.emit('pull', isStarted, pullJobsFn)
        }
        console.log('job result: ', result)
        // return resolver(result)
    })

    return this
}