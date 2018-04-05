'use strict;'

const Qyu = require('./lib')

// Qyu entry point
module.exports = ({ rateLimit, statsInterval }) => new Qyu({ rateLimit, statsInterval })
