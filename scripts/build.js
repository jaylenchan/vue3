/** 打包packages下的所有包 */

const fs = require('fs')
const path = require('path')
const execa = require('execa')
/** 获取所有包名 */
function getPackages() {
  // fs.readdirSync输出指定文件夹下的第一层级文件结构，包括文件和目录
  return fs.readdirSync(path.resolve(__dirname, '..', 'packages')).filter((file) => {
    return fs.statSync(path.resolve(__dirname, '..', 'packages', file)).isDirectory()
  })
}

/** 构建一个包 */
async function build(package) {
  try {
    await execa('rollup', ['-c', '--environment', `PACKAGE:${package}`], {
      stdio: 'inherit'
    })
  } catch (err) {
    console.log('err=>', err)
  }
}

/** 并行构建所有的包 */
function buildParallel(packages) {
  const buildAll = []
  for (const package of packages) {
    const buildPromise = build(package)
    buildAll.push(buildPromise)
  }
  return Promise.all(buildAll)
}

const packages = getPackages()
buildParallel(packages)
