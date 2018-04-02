// Module entry point
'use strict;'

const EvenEmitter = require('events')
const StandbyManager = require('./standby_manager')
const ExecutionManager = require('./execution_manager')

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
 * - Implementing start(), pause(), push() returning promises
 * - Handling job priority
 * - Handle bad input data
 * - Check and resolve synchro issues: investigate using setImmediate / process.nextTick
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

function Qyu({rateLimit} = {}) {
    this.maxConcurrentJobs = rateLimit || 1
    this.isStarted = false

    // TODO: replace this by simple objects + methods
    this.standByM = new StandbyManager()
    this.executionM = new ExecutionManager(this.maxConcurrentJobs)

    this.push = job => {
        this.standByM.standbyEventsEmitter.emit('push', this.getIsStarted, job, this.executionM.executionEventsEmitter)
    }

    this.start = () => {
        this.isStarted = true

        this.executionM.executionEventsEmitter.emit('pull', this.getIsStarted, this.standByM.pullJobs)
    }

    this.pause = () => {
        // wait for current executing jobs to be finished
        this.isStarted = false

        // if getIsStarted() === false && runningJobs.length === 0, emit 'paused'
    }

    this.getIsStarted = () => this.isStarted

    return this
}

module.exports = Qyu