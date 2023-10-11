import cloneDeep from 'lodash.clonedeep'
import { type AppEvent } from 'src/app-event'
import { LoggerLevel } from 'src/libs/logger/logger-level'
import { ElementProxy } from '../element-proxy'
import { ElementBaseKeys, type Element, type ElementBaseProps, type ElementClass } from '../element.interface'
import { type RootScene } from '../root-scene'
import { type GroupItemProps, type GroupProps } from './group.props'

/** |**  runs
  Group elements
  @example
  ```yaml
    - name: Print all of message
      runs:
        - echo: hello
        - echo: world
        - name: Stop
          runs:
            - exit:
  ```
*/
const DEBUG_GROUP_RESULT = process.env.DEBUG_GROUP_RESULT

export class Group<GP extends GroupProps, GIP extends GroupItemProps> implements Element {
  readonly ignoreEvalProps = ['runs']
  readonly proxy!: ElementProxy<this>

  protected runs: GIP[] = []
  protected get scene() { return this.proxy.scene }
  protected get rootScene() { return this.proxy.rootScene }
  protected get logger() { return this.proxy.logger }
  protected get innerScene() {
    return this.scene
  }

  constructor(props: GP | GIP[]) {
    this.lazyInitRuns(props)
  }

  async dispose() { }

  lazyInitRuns(props: GP | GIP[]) {
    if (Array.isArray(props)) {
      props = {
        runs: props
      } as any
    }
    Object.assign(this, props)
    this.runs = this.runs?.filter(e => e) || []
  }

  private async newElement(nameOrClass: string | ElementClass, props: any) {
    if (typeof nameOrClass === 'string') {
      const name = nameOrClass
      const ElemClass: ElementClass = await this.rootScene.tagsManager.loadElementClass(name, this.innerScene)
      return new ElemClass(props)
    }
    const ElemClass = nameOrClass
    return new ElemClass(props)
  }

  async newElementProxy<T extends Element>(nameOrClass: string | ElementClass, props: any, baseProps: any = {}, loopObj: any = {}) {
    const elem = await this.newElement(nameOrClass, props)
    const elemProxy = new ElementProxy(elem, baseProps) as ElementProxy<T>
    elemProxy.tag = typeof nameOrClass === 'string' ? nameOrClass : ((nameOrClass as any).tag || nameOrClass.name)
    elemProxy.parent = this
    elemProxy.scene = this.innerScene
    elemProxy.rootScene = (this.innerScene.isRoot ? this.innerScene : this.scene.rootScene) as RootScene
    Object.assign(elemProxy, loopObj)
    const elemImplementedAppEvent = elemProxy.$ as any as AppEvent
    if (typeof elemImplementedAppEvent.onAppExit === 'function') this.rootScene.onAppExit.push(elemImplementedAppEvent)
    return elemProxy
  }

  async exec(parentState?: Record<string, any>) {
    return await this.runEachOfElements(parentState)
  }

  private getTagName(props: any) {
    const keys = Object.keys(props)
    let tagName: string | undefined
    for (let key of keys) {
      if (key.startsWith('~')) {
        const oldKey = key
        key = key.substring(1)
        props[key] = props[oldKey]
        props[oldKey] = undefined
        props.async = true
      }
      if (!ElementBaseKeys.includes(key) && props[key] !== undefined) {
        tagName = key
        break
      }
    }
    return tagName
  }

  async runEachOfElements(parentState?: Record<string, any>) {
    const asyncJobs = new Array<Promise<any>>()
    const result = DEBUG_GROUP_RESULT ? new Array<ElementProxy<Element>>() : undefined
    let newRuns = cloneDeep(this.runs)
    // Handle includes tag
    const includes = newRuns.map((e: any, i: number) => {
      return e.include ? { idx: i, include: e.include } : undefined
    }).filter(e => e)
    if (includes.length) {
      const runs = await Promise.all(includes
        .map(async (e: any) => {
          const elemProxy = await this.createAndExecuteElement(asyncJobs, 'include', parentState, {}, e.include)
          return { idx: e.idx, runs: elemProxy?.result || [] }
        })) as Array<{ idx: number, runs: any[] }>
      for (let i = runs.length - 1; i >= 0; i--) {
        newRuns.splice(runs[i].idx, 1, ...runs[i].runs)
      }
    }

    const hasRunOnly = newRuns.some(r => {
      return r.only === true
    })
    if (hasRunOnly) {
      newRuns = newRuns.filter(r => {
        return (r.only === true) || (r.template)
      })
    }
    newRuns = newRuns.filter(r => !r.skip)
    let isPassedCondition = false
    for (let i = 0; i < newRuns.length; i++) {
      const allProps = newRuns[i]
      // Init props
      const props: any = allProps || {}
      if (props.runs || props['~runs']) {
        const runs = props.runs || props['~runs']
        props.async = !!props['~runs']
        props.group = {
          runs
        }
        props.runs = props['~runs'] = undefined
      }
      let { '<-': inheritKeys, '->': exposeKey, skip, only, ...eProps } = props
      let tagName = this.getTagName(eProps)
      const isTemplate = !!eProps.template

      // Only support template or tag name. Prefer tag name
      if (tagName && eProps.template) eProps.template = undefined

      if (inheritKeys) eProps = this.rootScene.extend(tagName, eProps, inheritKeys)
      if (exposeKey) this.rootScene.export(tagName, eProps, exposeKey)

      // Skip this if it's a template
      if (isTemplate) continue

      // Retry to get tagName which is override by keys
      if (!tagName) {
        tagName = this.getTagName(eProps)
      }

      let { if: condition, elseif: elseIfCondition, else: elseCondition, force, debug, vars, async, detach, skipNext, loop, name, id, preScript, postScript, context } = eProps
      let elemProps: any
      if (tagName) {
        // This is a tag
        elemProps = eProps[tagName]
      } else if (vars) {
        // This is "vars" tag
        tagName = 'vars'
        elemProps = vars
        vars = undefined
      } else {
        // This is a empty tag
        tagName = 'base'
        elemProps = undefined
      }
      if (elseCondition === null) {
        elseIfCondition = true
      }
      if (isPassedCondition) {
        if (elseIfCondition) continue
        isPassedCondition = false
      }
      if (debug === true) debug = LoggerLevel.DEBUG
      const baseProps: ElementBaseProps = {
        id,
        name,
        if: condition,
        elseif: elseIfCondition,
        force,
        debug,
        vars,
        detach,
        async,
        loop,
        preScript,
        postScript,
        context,
        skipNext
      }
      // Execute
      if (loop === undefined) {
        const elemProxy = await this.createAndExecuteElement(asyncJobs, tagName, parentState, baseProps, elemProps)
        if (elemProxy) {
          result?.push(elemProxy)
          isPassedCondition = !!baseProps.if || !!baseProps.elseif
          if (elemProxy.isSkipNext) break
        }
      } else {
        let loopCondition = await this.innerScene.getVars(loop, this.proxy)
        if (loopCondition) {
          if (Array.isArray(loopCondition)) {
            for (let i = 0; i < loopCondition.length; i++) {
              const newProps = (i === loopCondition.length - 1) ? elemProps : cloneDeep(elemProps)
              const elemProxy = await this.createAndExecuteElement(asyncJobs, tagName, parentState, baseProps, newProps, {
                loopKey: i,
                loopValue: loopCondition[i]
              })
              if (elemProxy) {
                result?.push(elemProxy)
              }
            }
          } else if (typeof loopCondition === 'object') {
            const keys = Object.keys(loopCondition)
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i]
              const newProps = (i === loopCondition.length - 1) ? elemProps : cloneDeep(elemProps)
              const elemProxy = await this.createAndExecuteElement(asyncJobs, tagName, parentState, baseProps, newProps, {
                loopKey: key,
                loopValue: loopCondition[key]
              })
              if (elemProxy) {
                result?.push(elemProxy)
              }
            }
          } else if (loopCondition === true) {
            while (loopCondition) {
              const newProps = elemProps && cloneDeep(elemProps)
              const elemProxy = await this.createAndExecuteElement(asyncJobs, tagName, parentState, baseProps, newProps, {
                loopValue: loopCondition
              })
              if (elemProxy) {
                result?.push(elemProxy)
              }
              loopCondition = await this.innerScene.getVars(loop, this.proxy)
            }
          }
        }
      }
    }
    if (asyncJobs.length) {
      await Promise.all(asyncJobs)
    }
    return result
  }

  private async createAndExecuteElement(asyncJobs: Array<Promise<any>>, name: string, parentState: any, baseProps: ElementBaseProps, props: any, loopObj: { loopKey?: any, loopValue?: any } = {}) {
    const elemProxy = await this.newElementProxy(name, props, baseProps, loopObj)
    elemProxy.parentState = parentState

    const condition = baseProps.elseif ?? baseProps.if
    const isContinue = (condition === undefined) || await this.innerScene.getVars(condition, elemProxy)
    if (!isContinue) return undefined

    if (baseProps.id) {
      await elemProxy.scene.setVars(baseProps.id, elemProxy)
    }

    const p = elemProxy.exec(parentState).finally(() => elemProxy.dispose())

    const detach = baseProps.detach && await this.innerScene.getVars(baseProps.detach, elemProxy)
    if (detach) {
      this.rootScene.pushToBackgroundJob(p)
    } else {
      const async = baseProps.async && await this.innerScene.getVars(baseProps.async, elemProxy)
      if (async) {
        asyncJobs.push(p)
      } else {
        await Promise.all(asyncJobs)
        asyncJobs = []
        await p
      }
    }
    return elemProxy
  }
}
