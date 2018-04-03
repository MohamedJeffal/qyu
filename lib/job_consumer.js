'use strict;'

const EventEmitter = require('events')

function JobConsumer(rateLimit, emitDoneEvent, emitErrorEvent, emitStatsEvent, statsInterval) {
    this.maxConcurrentJobs = rateLimit || 1
    this.statsInterval = statsInterval || 2000
    this.isRunning = false

    this.runningJobsCount = 0
    this.processedJobs = 0

    this.executionEventsEmitter = new EventEmitter()

    this.executionEventsEmitter.on('pull', (producerEventEmitter) => {
        if (this.isRunning) {
            const countToPull = this.maxConcurrentJobs - this.runningJobsCount
            if (countToPull > 0) {
                producerEventEmitter.emit('getJobs', this.executionEventsEmitter, countToPull)
            }
        }
    })

    this.executionEventsEmitter.on('pulled', (producerEventEmitter, pulledJobs) => {
        if (pulledJobs.length > 0) {
            this.executionEventsEmitter.emit('doJob', producerEventEmitter, pulledJobs)
        }
    })
    
    this.executionEventsEmitter.on('doJob', (producerEventEmitter, jobs) => {
        this.runningJobsCount += jobs.length
    
        jobs.map(job => {
            return job.fn()
                .then(result => this.executionEventsEmitter.emit('jobDone', job.id, result, producerEventEmitter))
                .catch(err => this.executionEventsEmitter.emit('jobFailed', job.id, err, producerEventEmitter))
        })
    })
    
    this.executionEventsEmitter.on('jobDone', (jobId, result, producerEventEmitter) => {
        this.runningJobsCount--
        this.processedJobs++
    
        emitDoneEvent(jobId, result)
        // if getIsStarted() === false && runningJobs.length === 0, emit 'paused'
        if (this.isRunning === true) {
            this.executionEventsEmitter.emit('pull', producerEventEmitter)
        }
        // return resolver(result)
    })

    this.executionEventsEmitter.on('jobFailed', (jobId, error, producerEventEmitter) => {
        this.runningJobsCount--
        this.processedJobs++
    
        emitErrorEvent(jobId, error)
        // if getIsStarted() === false && runningJobs.length === 0, emit 'paused'
        if (this.isRunning === true) {
            this.executionEventsEmitter.emit('pull', producerEventEmitter)
        }
        // return reject(result)
    })

    this.executionEventsEmitter.on('start', () => {
        this.start()
    })
    
    this.executionEventsEmitter.on('pause', () => {
        this.pause()
    })

    return this
}

/*this.statsEventIntervalId = setInterval(() => {
    emitStatsEvent(this.processedJobs)
    this.processedJobs = 0
}, this.statsInterval)*/

JobConsumer.prototype.start = function () {
    this.isRunning = true
}

JobConsumer.prototype.pause = function () {
    this.isRunning = false
}

JobConsumer.prototype.getIsRunning = function () {
    return this.isRunning
}

this.clearStatsEventInterval = () => clearInterval(this.statsEventIntervalId)

module.exports = JobConsumer