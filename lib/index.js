// Module entry point
'use strict;'

const util = require('util')
const EventEmitter = require('events')
const JobProducer = require('./job_producer')
const JobConsumer = require('./job_consumer')

// DO NOT FORGET THAT EVENT EMITTER IS SYNCHRONOUS

/**
 * TODO:
 * - Base async queue => done (but with synchronous events)
 * - Modularize: composition & separate: standby / execution => done ? (needs some cleaning)
 * - Add concurrency limit: make sure it doesn't clash with pausing => done
 * - Make qyu extend event emitter & add listeners:
 *      - done & error => done
 *      - drain => when queue + buffer are empty && not paused
 *      - stats => kinda
 * - Implementing start(), pause(), push() returning promises
 * - Handling job priority => number for the interval, cancel when pause and start with start..
 * - Adding stop(): clears everything
 * - Handle bad input data
 * - Check and resolve synchro issues: investigate using setImmediate / process.nextTick
 * - Make alternative full batching implementation
 * - Clean code
 * - Docs
 * - Unit tests
 * - Examples
 */

function Qyu({rateLimit, statsInterval} = {}) {
    EventEmitter.call(this)

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
    this.standByM = new JobProducer()
    this.executionM = new JobConsumer(rateLimit, this.emitDoneEvent, this.emitErrorEvent, this.emitStatsEvent, statsInterval)

    return this
}

Qyu.prototype.push = function ({job, priority}) {
    return new Promise(resolve => {
        this.standByM.standbyEventsEmitter.emit('push', {job, priority}, this.executionM.executionEventsEmitter)
    })
}

Qyu.prototype.start = function () {
    return new Promise(resolve => {
        this.executionM.executionEventsEmitter.emit('start', resolve)
        this.executionM.executionEventsEmitter.emit('pull', this.standByM.standbyEventsEmitter)
    })
}

Qyu.prototype.pause = function () {
    return new Promise(resolve => {
        this.standByM.standbyEventsEmitter.emit('pause', this.executionM.executionEventsEmitter, resolve)
    })
}

Qyu.prototype.stop = function () {
    this.pause()

    // clear standby queues
    // this.executionM.clearStatsEventInterval()
}

util.inherits(Qyu, EventEmitter)

module.exports = ({rateLimit}) => new Qyu({rateLimit})