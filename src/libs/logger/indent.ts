import chalk from 'chalk'
import { SPACE } from './console'

export class Indent {
  indentString = ''

  #indent = 0

  get indentStringLength() {
    return this.indent * 2
  }

  set indent(indent: number) {
    this.#indent = indent
    this.indentString = chalk.gray.dim(new Array(indent).fill(`${SPACE}┄`).join(''))
  }

  get indent() {
    return this.#indent
  }

  constructor(indent = 0) {
    if (indent) {
      this.add(indent)
    }
  }

  add(indent = 1) {
    this.update(this.indent + indent)
  }

  update(indent: number) {
    this.indent = indent
  }

  format(str: string) {
    return `${this.indentString}${str}`
  }

  clone() {
    return new Indent(this.indent)
  }
}
