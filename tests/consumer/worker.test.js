'use strict;'

const JobConsumerWorker = require('../../lib/consumer/worker')

describe('pull', () => {
  const emptyFn = () => {}
  const jbw = new JobConsumerWorker(2, emptyFn, emptyFn, emptyFn, emptyFn)

  afterEach(() => {
    jbw.clear()
  })

  test('When the consumer is at its job concurrency limit, it should not pull new jobs', () => {
    jbw.start(emptyFn)
    jbw.runningJobsCount = 2

    const inputEventFnData = {
      getJobsEvent: emptyFn
    }

    const getJobsEventSpy = jest.spyOn(inputEventFnData, 'getJobsEvent')
    const getBufferedJobsSpy = jest.spyOn(jbw, 'getBufferedJobs')

    expect(jbw.pull(inputEventFnData.getJobsEvent, emptyFn)).toEqual(false)
    expect(getJobsEventSpy).not.toHaveBeenCalled()
    expect(getBufferedJobsSpy).not.toHaveBeenCalled()

    getJobsEventSpy.mockReset()
    getJobsEventSpy.mockRestore()
    getBufferedJobsSpy.mockReset()
    getBufferedJobsSpy.mockRestore()
  })

  test('When the consumer is paused, it should not pull new jobs', () => {
    jbw.start(emptyFn)
    jbw.runningJobsCount = 1
    jbw.pause([], emptyFn)

    const inputEventFnData = {
      getJobsEvent: emptyFn
    }

    const getJobsEventSpy = jest.spyOn(inputEventFnData, 'getJobsEvent')
    const getBufferedJobsSpy = jest.spyOn(jbw, 'getBufferedJobs')

    expect(jbw.pull(inputEventFnData.getJobsEvent, emptyFn)).toEqual(false)
    expect(getJobsEventSpy).not.toHaveBeenCalled()
    expect(getBufferedJobsSpy).not.toHaveBeenCalled()

    getJobsEventSpy.mockReset()
    getJobsEventSpy.mockRestore()
    getBufferedJobsSpy.mockReset()
    getBufferedJobsSpy.mockRestore()
  })

  test('When the consumer is running under the concurrency limit, it should pull new jobs', () => {
    jbw.start(emptyFn)

    const inputEventFnData = {
      getJobsEvent: number => {}
    }

    const getJobsEventSpy = jest.spyOn(inputEventFnData, 'getJobsEvent')
    const getBufferedJobsSpy = jest.spyOn(jbw, 'getBufferedJobs')

    expect(jbw.pull(inputEventFnData.getJobsEvent, emptyFn)).toEqual(true)
    expect(getJobsEventSpy).toHaveBeenCalledWith(2)
    expect(getBufferedJobsSpy).not.toHaveBeenCalled()

    getJobsEventSpy.mockReset()
    getJobsEventSpy.mockRestore()
    getBufferedJobsSpy.mockReset()
    getBufferedJobsSpy.mockRestore()
  })
})

describe('executeJobs', async () => {
  const emptyFn = () => {}
  const jbw = new JobConsumerWorker(10, emptyFn, emptyFn, emptyFn, emptyFn)

  const createJob = (id, promise) => ({ id, fn: () => promise })

  afterEach(() => {
    jbw.clear()
  })

  test('After each job is fullfilled, it should update consumer job counters and emit pull event', () => {
    jbw.start()

    const jobs = [
      createJob('1', Promise.resolve(1)),
      createJob('2', Promise.reject()),
      createJob('3', Promise.resolve(3))
    ]
    const inputEventFnData = {
      pullEvent: () => {}
    }

    const pullEventSpy = jest.spyOn(inputEventFnData, 'pullEvent')

    return jbw.executeJobs(jobs, inputEventFnData.pullEvent).then(() => {
      expect(pullEventSpy).toHaveBeenCalledTimes(3)
      expect(jbw.processedJobs).toBe(3)

      pullEventSpy.mockReset()
      pullEventSpy.mockRestore()
    })
  })
})
