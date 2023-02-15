import { existsSync, unlinkSync } from 'fs'
import { Echo } from 'src/components/echo/echo'
import { FileTemp } from 'src/libs/file-temp'
import { Testing } from 'src/testing'
import { stringify } from 'yaml'
import { RootScene } from '../root-scene'
import { Scene } from './scene'

let scene: Scene
let encryptedFile: string
const password = 'example'

beforeEach(async () => {
  await Testing.reset()
})

afterEach(async () => {
  await scene.dispose()
})

afterAll(() => {
  encryptedFile && unlinkSync(encryptedFile)
})

test('Check localVars and globalVars', async () => {
  const tmp = new FileTemp()
  const tmp1 = new FileTemp()
  await tmp.create(`
- vars:
    localVars: my local vars in scene
    GlobalVars1: My Global Vars 1 in scene
- scene:
    path: ${tmp1.file}
- echo: \${vars.localVars}
- echo: \${vars.GlobalVars1}
- echo: \${vars.rootLocalVars}
- echo: \${vars.GlobalVars2}
`)
  await tmp1.create(`
- vars:
    localVars1: my local vars 1 in scene 1
    GlobalVars1: My Global Vars 1 in scene 1

- echo: \${vars.localVars}
- echo: \${vars.localVars1}
- echo: \${vars.GlobalVars1}
- echo: \${vars.rootLocalVars}
- echo: \${vars.GlobalVars2}
`)
  try {
    scene = await Testing.newElement(Scene, {
      content: `
- vars:
    rootLocalVars: my local vars in root
    GlobalVars1: My Global 1 Vars in root
    GlobalVars2: My Global 2 Vars in root

- scene:
    path: ${tmp.file}

- echo: \${vars.rootLocalVars}
- echo: \${vars.localVars}
- echo: \${vars.GlobalVars1}
- echo: \${vars.GlobalVars2}
`
    })
    const [, _scene1, echo1, echo2, echo3, echo4] = await scene.exec() || []
    expect(echo1.result).toBe('my local vars in root')
    expect(echo2.result).toBeUndefined()
    expect(echo3.result).toBe('My Global 1 Vars in root')
    expect(echo4.result).toBe('My Global 2 Vars in root')

    const [, _scene2, echo11, echo12, echo13, echo14] = _scene1.result || []
    expect(echo11.result).toBe('my local vars in scene')
    expect(echo12.result).toBe('My Global Vars 1 in scene')
    expect(echo13.result).toBeUndefined()
    expect(echo14.result).toBe('My Global 2 Vars in root')

    const [, echo21, echo22, echo23, echo24, echo25] = _scene2.result || []
    expect(echo21.result).toBeUndefined()
    expect(echo22.result).toBe('my local vars 1 in scene 1')
    expect(echo23.result).toBe('My Global Vars 1 in scene 1')
    expect(echo24.result).toBeUndefined()
    expect(echo25.result).toBe('My Global 2 Vars in root')
  } finally {
    tmp.remove()
    tmp1.remove()
  }
})

test('Should load vars from yaml file', async () => {
  const tmp = new FileTemp('.yaml')
  try {
    await tmp.create(stringify({
      name: 'name 1',
      age: 1,
      male: true,
      more: {
        address: '1',
        num: 2,
        married: false
      }
    }))
    scene = new RootScene({
      content: `
vars_file: ${tmp.file}
runs:
  - name: Test env
`
    }, Testing.logger)
    await scene.exec()
    expect(scene.localVars.name).toBe('name 1')
    expect(scene.localVars.age).toBe(1)
    expect(scene.localVars.male).toBe(true)
    expect(scene.localVars.more).toEqual({
      address: '1',
      num: 2,
      married: false
    })
  } finally {
    tmp.remove()
  }
})

test('Should load vars from json file', async () => {
  const tmp = new FileTemp('.json')
  try {
    await tmp.create(JSON.stringify({
      name: 'name 1',
      age: 1,
      male: true,
      more: {
        address: '1',
        num: 2,
        married: false
      }
    }))
    scene = new RootScene({
      content: `
vars_file: ${tmp.file}
runs:
  - name: Test env
`
    }, Testing.logger)
    await scene.exec()
    expect(scene.localVars.name).toBe('name 1')
    expect(scene.localVars.age).toBe(1)
    expect(scene.localVars.male).toBe(true)
    expect(scene.localVars.more).toEqual({
      address: '1',
      num: 2,
      married: false
    })
  } finally {
    tmp.remove()
  }
})

test('Should override env when load scene', async () => {
  process.env.NAME = 'name 1'
  process.env.age = '1'
  process.env.male = '1'
  process.env.more_address = '1'
  process.env.MORE_NUM = '2'
  process.env.MORE_MARRied = 'no'
  scene = new RootScene({
    content: `
vars:
  name: name 0
  age: 0
  male: false
  more:
    address: addr 1
    num: 1
    married: true
runs:
  - name: Test env
`
  }, Testing.logger)
  await scene.exec()
  expect(scene.localVars.name).toBe('name 1')
  expect(scene.localVars.age).toBe(1)
  expect(scene.localVars.male).toBe(true)
  expect(scene.localVars.more).toEqual({
    address: '1',
    num: 2,
    married: false
  })
})

test('Should load successfully from text content with only list items', async () => {
  scene = await Testing.newElement(Scene, { content: '- echo: Hello' })
  await scene.exec()
  expect(scene.result).toHaveLength(1)
})

test('Should load successfully from text content with full props', async () => {
  scene = await Testing.newElement(Scene, {
    content: `
name: test
runs: 
  - echo: Hello
`
  })
  await scene.exec()
  expect(scene.result).toHaveLength(1)
})

test('Should load successfully from file', async () => {
  const tmp = new FileTemp()
  try {
    await tmp.create(`
name: Test here
runs:
  - echo: Hello
  - echo: World
`)
    scene = await Testing.newElement(Scene, { path: tmp.file })
    await scene.exec()
    expect(scene.result).toHaveLength(2)
  } finally {
    tmp.remove()
  }
})

test('Should generate a generated scene file when set password', async () => {
  const tmp = new FileTemp('.yaml')
  try {
    await tmp.create(`
name: Test here
password: ${password}
runs:
  - name: Hello
  - echo: World
`)
    scene = await Testing.newElement(Scene, { path: tmp.file })
    await scene.exec()
    expect(scene.encryptedPath && existsSync(scene.encryptedPath)).toBe(true)
    encryptedFile = scene.encryptedPath || ''
  } finally {
    tmp.remove()
  }
})

test('Load a encrypted scene file', async () => {
  const tmp = new FileTemp('.yaml')
  try {
    await tmp.create(`
name: Test here
password: ${password}
runs:
  - name: Hello
  - name: World
`)
    scene = await Testing.newElement(Scene, { path: tmp.file })
    await scene.exec()
    expect(scene.encryptedPath && existsSync(scene.encryptedPath)).toBe(true)
    encryptedFile = scene.encryptedPath || ''
    await scene.dispose()

    scene = await Testing.newElement(Scene, { path: encryptedFile, password })
    await scene.exec()
    expect(scene.result).toHaveLength(2)
  } finally {
    tmp.remove()
  }
})

test('Should run echo element', async () => {
  scene = await Testing.newElement(Scene, {
    content: `
- echo: 'ok'
`
  })
  const [echo] = await scene.exec() as Echo[]
  expect(echo.result).toBe('ok')
})
