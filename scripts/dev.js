/** 只打包某个包调试用 */
/** 打包packages下的所有包 */

const execa = require('execa')

const PACKAGE = 'runtime-dom'

/** 构建一个包 */
async function build(package) {
  try {
    await execa('rollup', ['-cw', '--environment', `PACKAGE:${package}`], {
      stdio: 'inherit'
    })
  } catch (err) {
    console.log('err=>', err)
  }
}

build(PACKAGE)
