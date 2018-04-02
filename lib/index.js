// Module entry point
'use strict;'

const util = require('util')
const EventEmitter = require('events')
const StandbyManager = require('./standby_manager')
const ExecutionManager = require('./execution_manager')

// DO NOT FORGET THAT EVENT EMITTER IS SYNCHRONOUS

/**
 * TODO:
 * - Base async queue => done (but with synchronous events)
 * - Modularize: composition & separate: standby / execution => done ? (needs some cleaning)
 * - Add concurrency limit: make sure it doesn't clash with pausing => done
 * - Make qyu extend event emitter & add listeners:
 *      - done & error => done
 *      - drain
 *      - stats => kinda
 * - Implementing start(), pause(), push() returning promises
 * - Handling job priority => done ?
 * - Adding stop(): clears everything
 * - Handle bad input data
 * - Check and resolve synchro issues: investigate using setImmediate / process.nextTick
 * - Make alternative full batching implementation
 * - Clean code
 * - Docs
 * - Unit tests
 * - Examples
 */

 /**
  * Unique id example:
  * const crypto = require("crypto");
  * const id = crypto.randomBytes(16).toString("hex"); -> uuid v4 equivalent
  * 
  * Sync or async version ?
  */

function Qyu({rateLimit, statsInterval} = {}) {
    EventEmitter.call(this)

    this.maxConcurrentJobs = rateLimit || 1
    this.statsInterval = statsInterval || 2000
    this.isRunning = false

    this.emitDoneEvent = (jobId, jobResult) => {
        this.emit('done', {jobId, jobResult})
    }

    this.emitErrorEvent = (jobId, error) => {
        this.emit('error', {jobId, error})
    }

    this.emitStatsEvent = nbJobs => {
        this.emit('stats', {nbJobsPerSecond: nbJobs})
    }

    // TODO: replace this by simple objects + methods
    this.standByM = new StandbyManager()
    this.executionM = new ExecutionManager(this.maxConcurrentJobs, this.emitDoneEvent, this.emitErrorEvent, this.emitStatsEvent, this.statsInterval)

    this.push = ({job, priority}) => {
        this.standByM.standbyEventsEmitter.emit('push', this.getIsRunning, {job, priority}, this.executionM.executionEventsEmitter)
    }

    this.start = () => {
        this.isRunning = true

        this.executionM.executionEventsEmitter.emit('pull', this.getIsRunning, this.standByM.pullJobs)
    }

    this.pause = () => {
        // wait for current executing jobs to be finished
        this.isRunning = false
    }

    this.stop = () => {
        this.pause()

        // clear standby queues
        this.executionM.clearStatsEventInterval()
    }

    this.getIsRunning = () => this.isRunning

    return this
}

util.inherits(Qyu, EventEmitter)

module.exports = ({rateLimit}) => new Qyu({rateLimit})