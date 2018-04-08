'use strict;'

const StatusManager = require('../../lib/consumer/status_manager')

describe('pushStatus', () => {
  const statM = new StatusManager()

  afterEach(() => {
    statM.clear()
  })

  test('Pushing a status of the same kind as the last pushed status should fail', () => {
    const inputStatusKind = 'START'
    const statusResolver = () => {}
    const statusUpdateStatsEventInterval = () => {}
    const statusInputData = [
      inputStatusKind,
      statusResolver,
      statusUpdateStatsEventInterval
    ]
    const statusQueueResult = [
      {
        kind: inputStatusKind,
        resolver: statusResolver,
        done: false,
        updateStatsEventInterval: statusUpdateStatsEventInterval
      }
    ]

    expect(statM.pushStatus(...statusInputData)).toEqual(inputStatusKind)
    expect(statM.queue.length).toBe(1)
    expect(statM.queue).toEqual(statusQueueResult)

    expect(statM.pushStatus(...statusInputData)).toEqual(null)
    expect(statM.queue.length).toBe(1)
  })

  test('Pushing a status of an unknown kind should fail', () => {
    for (const statusKind of ['RESET', null, undefined, false, 42]) {
      expect(statM.pushStatus(statusKind)).toEqual(null)
      expect(statM.queue.length).toBe(0)
    }
  })

  test('Pushing a status with invalid promise resolve / stats event intervals fns should fail', () => {
    const invalidInputFns = [{}, null, undefined, 'test', 42]

    for (const invalidFn of invalidInputFns) {
      expect(statM.pushStatus('START', invalidFn, () => {})).toEqual(null)
      expect(statM.queue.length).toBe(0)
    }

    for (const invalidFn of invalidInputFns) {
      expect(statM.pushStatus('START', () => {}, invalidFn)).toEqual(null)
      expect(statM.queue.length).toBe(0)
    }
  })

  test('Pushing multiple alternating statuses should work and return their kind', () => {
    const inputStatuses = ['START', 'PAUSE', 'START', 'PAUSE']
    const emptyFn = () => {}

    for (const inputStatusKind of inputStatuses) {
      expect(statM.pushStatus(inputStatusKind, emptyFn, emptyFn)).toEqual(
        inputStatusKind
      )
    }

    const statusQueueResult = [
      {
        kind: 'START',
        resolver: emptyFn,
        done: false,
        updateStatsEventInterval: emptyFn
      },
      {
        kind: 'PAUSE',
        resolver: emptyFn,
        done: false,
        updateStatsEventInterval: emptyFn
      },
      {
        kind: 'START',
        resolver: emptyFn,
        done: false,
        updateStatsEventInterval: emptyFn
      },
      {
        kind: 'PAUSE',
        resolver: emptyFn,
        done: false,
        updateStatsEventInterval: emptyFn
      }
    ]

    expect(statM.queue).toEqual(statusQueueResult)
  })
})

describe('updateStatus', () => {
  const statM = new StatusManager()

  afterEach(() => {
    statM.clear()
  })

  test('If a status has not been fullfilled, it should not be updated', () => {
    const inputStatus = 'START'
    const emptyFn = () => {}

    statM.pushStatus(inputStatus, emptyFn, emptyFn)

    expect(statM.updateStatus(statM.queue[0], false)).toBe(false)
    expect(statM.queue).toEqual([
      {
        kind: inputStatus,
        resolver: emptyFn,
        done: false,
        updateStatsEventInterval: emptyFn
      }
    ])
  })

  test('If a status is already fullfilled, it should not be updated', () => {
    const inputStatus = 'START'
    const emptyFn = () => {}

    statM.pushStatus(inputStatus, emptyFn, emptyFn)

    statM.queue[0].done = true
    expect(statM.updateStatus(statM.queue[0], true)).toBe(false)
  })

  test('A status should be updated when it just has been fullfilled for the first time', () => {
    const inputStatus = 'START'
    const inputFnsData = {
      promiseResolveFn: () => 42,
      statsEventIntervalFn: () => {}
    }

    const promiseResolveFnSpy = jest.spyOn(inputFnsData, 'promiseResolveFn')
    const statsEventIntervalFnSpy = jest.spyOn(inputFnsData, 'promiseResolveFn')

    statM.pushStatus(
      inputStatus,
      inputFnsData.promiseResolveFn,
      inputFnsData.statsEventIntervalFn
    )

    expect(statM.updateStatus(statM.queue[0], true)).toBe(true)
    expect(statM.queue[0].done).toEqual(true)

    expect(promiseResolveFnSpy).toHaveBeenCalled()
    expect(statsEventIntervalFnSpy).toHaveBeenCalled()

    promiseResolveFnSpy.mockReset()
    promiseResolveFnSpy.mockRestore()
    statsEventIntervalFnSpy.mockReset()
    statsEventIntervalFnSpy.mockRestore()
  })
})
