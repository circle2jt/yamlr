import assert from 'assert'
import { type DebouncedFunc } from 'lodash'
import debounce from 'lodash.debounce'
import { formatTextToMs } from 'src/libs/format'
import { type ElementProxy } from '../element-proxy'
import { type Element } from '../element.interface'
import type Group from '../group'
import { type GroupItemProps, type GroupProps } from '../group/group.props'

/** |**  fn-debounce
  Debounce function (#Ref: lodash.debounce)
  @order 6
  @example
  ```yaml
    - fn-debounce:
        name: Delay to do something
        wait: 1s                # The number of milliseconds to delay.
        trailing: true          # Specify invoking on the trailing edge of the timeout. Default is true
        leading: false          # Specify invoking on the leading edge of the timeout. Default is false
        maxWait: 2s             # The maximum time func is allowed to be delayed before it's invoked.
      runs:
        - echo: Do this when it's free for 1s
  ```
*/
export class FNDebounce implements Element {
  static readonly Caches = new Map<string, DebouncedFunc<any>>()

  readonly proxy!: ElementProxy<this>
  readonly innerRunsProxy!: ElementProxy<Group<GroupProps, GroupItemProps>>

  name!: string
  wait!: number
  maxWait?: number
  trailing = true
  leading = false

  constructor(props: any) {
    Object.assign(this, props)
  }

  async exec(parentState?: Record<string, any>) {
    assert(this.name)
    assert(this.wait)

    if (typeof this.wait === 'string') {
      this.wait = formatTextToMs(this.wait)
    }
    if (this.maxWait && typeof this.maxWait === 'string') {
      this.maxWait = formatTextToMs(this.maxWait)
    }

    let fn = FNDebounce.Caches.get(this.name)
    if (!fn) {
      fn = debounce(async (parentState?: Record<string, any>) => {
        await this.innerRunsProxy.exec(parentState)
      }, this.wait, {
        trailing: this.trailing,
        leading: this.leading,
        maxWait: this.maxWait
      })
      FNDebounce.Caches.set(this.name, fn)
    }
    fn(parentState)
  }

  cancel() {
    const fn = FNDebounce.Caches.get(this.name)
    if (fn) {
      fn.cancel()
      return true
    }
    return false
  }

  flush() {
    const fn = FNDebounce.Caches.get(this.name)
    if (fn) {
      fn.flush()
      return true
    }
    return false
  }

  remove() {
    if (this.cancel()) {
      FNDebounce.Caches.delete(this.name)
      return true
    }
    return false
  }

  dispose() { }
}
