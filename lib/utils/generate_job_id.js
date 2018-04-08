'use strict;'
const crypto = require('crypto')

/**
 * @returns {string} Return a job identifier
 */
module.exports = () => crypto.randomBytes(16).toString('hex')
