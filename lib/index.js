// Module entry point
const EvenEmitter = require('events')

// DO NOT FORGET THAT EVENT EMITTER IS SYNCHRONOUS

/**
 * TODO:
 * - Base async queue => done (but with synchronous events)
 * - Modularize: composition & separate: standby / execution
 * - Make qyu extend event emitter & add listeners:
 *      - done & error
 *      - drain
 *      - stats
 * - Add concurrency limit: make sure it doesn't clash with pausing
 * - Handling job priority
 * - Check and resolve synchro issues: investigate using setImmediate / process.nextTick
 * - Docs
 * - Unit tests
 * - Examples
 */

function Qyu() {
    this.standByQueue = []
    this.executionQueueCount = 0
    this.isStarted = false

    // TODO: replace this by simple objects + methods
    this.standByQueueEventHandler = new EvenEmitter()
    this.executionQueueEventHandler = new EvenEmitter()

    this.standByQueueEventHandler.on('push', job => {
        this.standByQueue.push(job)

        if (this.isStarted === true) {
            this.executionQueueEventHandler.emit('pull', 1)
        }
    })

    this.executionQueueEventHandler.on('pull', jobCountToPull => {
        const job = this.standByQueue.shift()

        if (job) {
            this.executionQueueEventHandler.emit('doJob', {job, resolver: null})
        }
    })

    this.executionQueueEventHandler.on('doJob', ({job, resolver}) => {
        this.executionQueueCount++
        job().then(result => this.executionQueueEventHandler.emit('jobDone', {resolver, result}))
    })
    
    this.executionQueueEventHandler.on('jobDone', ({resolver, result}) => {
        this.executionQueueCount--

        if (this.isStarted === true) {
            this.executionQueueEventHandler.emit('pull', 1)
        }
        console.log('job result: ', result)
        // return resolver(result)
    })

    this.push = job => {
        this.standByQueueEventHandler.emit('push', job)
    }

    this.start = () => {
        this.isStarted = true

        this.executionQueueEventHandler.emit('pull', 1)
    }

    this.pause = () => {
        // wait for current executing jobs to be finished
        this.isStarted = false
    }

    return this
}

module.exports = Qyu