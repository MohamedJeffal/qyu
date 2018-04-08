'use strict;'

const JobQueue = require('../../lib/producer/job_queue')

const createPriorityQueues = queuesCount => {
  const priorityQueues = []

  for (let i = 0; i < queuesCount; i++) {
    priorityQueues.push([])
  }

  return priorityQueues
}

jest.mock('../../lib/utils/generate_job_id')
const generateMockId = require('../../lib/utils/generate_job_id')

const mockId = 'f1179626846531ddedab074bd17f53df'

generateMockId.mockImplementation(() => mockId)

describe('Initialization', () => {
  test('By default, 10 priority queues are initialized', () => {
    const defaultJq = new JobQueue()

    expect(defaultJq.priorityQueues.length).toEqual(10)
    expect(defaultJq.currentJobCount).toEqual(0)
  })

  test('If initialized with an invalid number of queues <= 0 or null, one queue will be created', () => {
    const emptyJq = new JobQueue(0)
    expect(emptyJq.priorityQueues.length).toEqual(1)

    const negativeJq = new JobQueue(-42)
    expect(negativeJq.priorityQueues.length).toEqual(1)

    const nullJq = new JobQueue(null)
    expect(nullJq.priorityQueues.length).toEqual(1)
  })
})

describe('clear', () => {
  test('All priority queues should be emptied and job counter reset', () => {
    const jq = new JobQueue(2)

    jq.pushJob({ job: () => Promise.resolve(1) })
    jq.pushJob({ job: () => Promise.resolve(2) })

    jq.clear()

    expect(jq.priorityQueues).toEqual([[], []])
    expect(jq.currentJobCount).toEqual(0)
  })
})

describe('pushJob', () => {
  const jq = new JobQueue()

  afterEach(() => {
    jq.clear()
  })

  test("A job with a invalid priority won't be pushed and null will be returned", () => {
    for (const priorityValue of [-5, 42, null]) {
      const jobWithInvalidPriority = {
        job: () => Promise.resolve(42),
        priority: priorityValue
      }

      expect(jq.pushJob(jobWithInvalidPriority)).toEqual(null)
      expect(jq.priorityQueues).toEqual(createPriorityQueues(10))
      expect(jq.currentJobCount).toEqual(0)
    }
  })

  test("A null or undefined job won't be pushed and null will be returned", () => {
    for (const jobValue of [null, undefined]) {
      const jobWithInvalidValue = { job: jobValue }

      expect(jq.pushJob(jobWithInvalidValue)).toEqual(null)
      expect(jq.priorityQueues).toEqual(createPriorityQueues(10))
      expect(jq.currentJobCount).toEqual(0)
    }
  })

  test('By default, a job will be pushed in the middle priority queue (ceil)', () => {
    const jobData = { job: () => Promise.resolve(42) }

    expect(jq.pushJob(jobData)).not.toBeNull()
    expect(jq.currentJobCount).toEqual(1)

    expect(jq.priorityQueues[4]).toEqual([
      { id: mockId, fn: jobData.job, priority: 5 }
    ])
  })

  test('A job will be pushed in the proper priority queue (n-1)', () => {
    let jobCount = 0
    for (const priorityValue of [1, 6, 10]) {
      const jobData = {
        job: () => Promise.resolve(42),
        priority: priorityValue
      }

      expect(jq.pushJob(jobData)).not.toBeNull()
      expect(jq.currentJobCount).toEqual(++jobCount)

      expect(jq.priorityQueues[priorityValue - 1]).toEqual([
        { id: mockId, fn: jobData.job, priority: priorityValue }
      ])
    }
  })
})

const simpleJobFn = () => Promise.resolve(42)

const inputData = {
  jobs: [
    { job: simpleJobFn, priority: 4 },
    { job: simpleJobFn, priority: 2 },
    { job: simpleJobFn, priority: 2 },
    { job: simpleJobFn, priority: 1 },
    { job: simpleJobFn, priority: 9 }
  ]
}

describe('pullJobs', () => {
  const jq = new JobQueue()

  beforeEach(() => {
    for (const j of inputData.jobs) {
      jq.pushJob(j)
    }
  })

  afterEach(() => {
    jq.clear()
  })

  test('For 3 jobs asked for and 5 available, 3 jobs will returned ordered by priority with the remaining number of jobs (= 2)', () => {
    const result = {
      jobs: [
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 1
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        }
      ],
      remainingJobCount: 2
    }

    expect(jq.pullJobs(3)).toEqual(result)
  })

  test('For 10 jobs asked for and 5 available, 5 jobs will returned ordered by priority with the remaining number of jobs (= 0)', () => {
    const result = {
      jobs: [
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 1
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 4
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 9
        }
      ],
      remainingJobCount: 0
    }

    expect(jq.pullJobs(10)).toEqual(result)
  })
})

describe('pullAllJobs', () => {
  const jq = new JobQueue()

  beforeEach(() => {
    for (const j of inputData.jobs) {
      jq.pushJob(j)
    }
  })

  afterEach(() => {
    jq.clear()
  })

  test('Return all existing jobs by order of priority and the remaining jobs (= 0)', () => {
    const result = {
      jobs: [
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 1
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 2
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 4
        },
        {
          id: 'f1179626846531ddedab074bd17f53df',
          fn: simpleJobFn,
          priority: 9
        }
      ],
      remainingJobCount: 0
    }

    expect(jq.pullAllJobs()).toEqual(result)
  })
})
