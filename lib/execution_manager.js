'use strict;'

const EventEmitter = require('events')

module.exports = function ExecutionManager(rateLimit, emitDoneEvent, emitErrorEvent, emitStatsEvent, statsInterval) {
    this.maxConcurrentJobs = rateLimit || 1
    this.runningJobsCount = 0
    this.processedJobs = 0

    this.executionEventsEmitter = new EventEmitter()

    this.executionEventsEmitter.on('pull', (isRunning, pullJobsFn) => {
        const countToPull = this.maxConcurrentJobs - this.runningJobsCount
        if (countToPull > 0) {
            const jobs = pullJobsFn(countToPull)
    
            if (jobs.length > 0) {
                this.executionEventsEmitter.emit('doJob', isRunning, jobs, pullJobsFn)
            }
        }
    })
    
    this.executionEventsEmitter.on('doJob', (isRunning, jobs, pullJobsFn) => {
        this.runningJobsCount += jobs.length
    
        jobs.map(job => {
            return job.fn()
                .then(result => this.executionEventsEmitter.emit('jobDone', isRunning, job.id, result, pullJobsFn))
                .catch(err => this.executionEventsEmitter.emit('jobFailed', isRunning, job.id, err, pullJobsFn))
        })
    })
    
    this.executionEventsEmitter.on('jobDone', (isRunning, jobId, result, pullJobsFn) => {
        this.runningJobsCount--
        this.processedJobs++
    
        emitDoneEvent(jobId, result)
        // if getIsStarted() === false && runningJobs.length === 0, emit 'paused'
        if (isRunning() === true) {
            this.executionEventsEmitter.emit('pull', isRunning, pullJobsFn)
        }
        // return resolver(result)
    })

    this.executionEventsEmitter.on('jobFailed', (isRunning, jobId, error, pullJobsFn) => {
        this.runningJobsCount--
        this.processedJobs++
    
        emitErrorEvent(jobId, error)
        // if getIsStarted() === false && runningJobs.length === 0, emit 'paused'
        if (isRunning() === true) {
            this.executionEventsEmitter.emit('pull', isRunning, pullJobsFn)
        }
        // return reject(result)
    })

    this.statsEventIntervalId = setInterval(() => {
        emitStatsEvent(this.processedJobs)
        this.processedJobs = 0
    }, statsInterval)

    this.clearStatsEventInterval = () => clearInterval(this.statsEventIntervalId)

    return this
}