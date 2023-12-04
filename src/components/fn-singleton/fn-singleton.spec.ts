import { sleep } from 'src/libs/time'
import { Testing } from 'src/testing'
import { FNSingleton } from './fn-singleton'

beforeEach(async () => {
  await Testing.reset()
})

afterEach(async () => {

})

test('fn-singleton should be run correctly', async () => {
  Testing.vars.i = 0
  for (let i = 0; i < 4; i++) {
    const fn = await Testing.createElementProxy(FNSingleton, {
      name: 'task1',
      trailing: true
    }, {
      runs: [
        {
          sleep: '200'
        },
        {
          js: '$vars.i++'
        }
      ]
    })
    try {
      await fn.exec()
    } finally {
      await fn.dispose()
    }
    if (i > 1) {
      await sleep(500)
    } else {
      await sleep(10)
    }
  }
  expect(Testing.vars.i).toBe(3)
})
