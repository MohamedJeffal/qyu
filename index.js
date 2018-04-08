'use strict;'

const Qyu = require('./lib')

/**
 * @typedef {Object} QyuInputData
 * @param {number} rateLimit - Max number of concurrent jobs running (default = 5)
 * @param {number} statsInterval - An interval in ms to emit emitStatsEvent (default = 500)
 */

/**
 * Qyu entry point: create and return an instance of Qyu
 * @param {QyuInputData}
 * @returns {Object} Return an instance of Qyu
 */
module.exports = ({ rateLimit, statsInterval }) => new Qyu({ rateLimit, statsInterval })
