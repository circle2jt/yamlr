import assert from 'assert'
import { existsSync } from 'fs'
import { join } from 'path'
import { nodeModulesDir } from 'src/managers/modules-manager'
import { ElementProxy } from '../element-proxy'
import { Element } from '../element.interface'
import { InstallProps } from './install.props'

export abstract class InstallAbstract implements Element {
  readonly hideName = true
  readonly proxy!: ElementProxy<this>
  protected get logger() { return this.proxy.logger }

  packages: Record<string, string> = {}

  constructor(eprops: InstallProps) {
    let _packages: undefined | any[]
    if (Array.isArray(eprops)) {
      _packages = eprops
    } else if (typeof eprops === 'string') {
      _packages = eprops.split(',').map(e => e.trim().split(' ').map(e => e.trim())).flat().filter(e => e)
    }
    _packages?.forEach((pack: any) => {
      if (typeof pack === 'string') {
        this.packages[pack] = pack
      } else if (typeof pack === 'object') {
        const [name] = Object.keys(pack)
        this.packages[name] = pack[name]
      }
    })
  }

  async exec() {
    const packs = Object.keys(this.packages || {})
    assert(packs.length, 'Packages are required to install')
    const packsInstall = packs.reduce<string[]>((sum: string[], name: string) => {
      if (!existsSync(join(nodeModulesDir, name))) {
        if (name !== this.packages[name]) {
          sum.push(`${name}@${this.packages[name]}`)
        } else {
          sum.push(`${name}`)
        }
      }
      return sum
    }, [])
    if (!packsInstall.length) return false
    if (this.proxy.name) this.logger.addIndent()
    try {
      await this.action(...packsInstall)
    } finally {
      if (this.proxy.name) this.logger.removeIndent()
    }
    return true
  }

  dispose() { }

  abstract action(...packsInstall: string[]): any
}
