import assert from 'assert'
import { GlobalEvent } from 'src/libs/global-event'
import { type ElementProxy } from '../element-proxy'
import { type Element } from '../element.interface'
import type Group from '../group'
import { type GroupItemProps, type GroupProps } from '../group/group.props'

/** |**  event'emit
  Send data via global event
  @order 6
  @group event
  @example
  ```yaml
    - event'emit:
        name: test-event
        data:
          name: Test event
          data: Hello
  ```
*/
export class EventEmiter implements Element {
  readonly ignoreEvalProps = []
  readonly proxy!: ElementProxy<this>
  readonly innerRunsProxy!: ElementProxy<Group<GroupProps, GroupItemProps>>

  name!: string
  data?: any

  constructor(props: any) {
    Object.assign(this, props)
  }

  async exec() {
    assert(this.name)

    GlobalEvent.emit(this.name, this.data)
  }

  dispose() { }
}
