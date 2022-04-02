/** 根据环境变量中的PACKAGE包进行 */

import path from 'path'
import json from '@rollup/plugin-json'
import resolvePlugin from '@rollup/plugin-node-resolve'
import ts from 'rollup-plugin-typescript2'

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.PACKAGE)

function resolvePath(config) {
  return path.resolve(packageDir, config)
}

const packageJson = require(resolvePath('package.json'))
const name = path.basename(packageDir)

// 构建类型配置
const buildTypeOutputConfig = {
  esm: {
    file: resolvePath(`dist/${name}.esm.js`),
    format: 'es'
  },
  cjs: {
    file: resolvePath(`dist/${name}.cjs.js`),
    format: 'cjs'
  },
  global: {
    file: resolvePath(`dist/${name}.global.js`),
    format: 'iife'
  }
}

// 每个包中的package.json中自定义的buildConfig字段
// 通过这个buildConfig可以找到一个types属性，指示我们这个包需要打包出来的格式都要有哪些
const { types, globalName } = packageJson.buildConfig

function createBuildConfig(type, outputConfig) {
  if (type === 'global') {
    outputConfig.name = globalName
  }
  return {
    input: resolvePath('src/index.ts'),
    output: outputConfig,
    plugins: [
      json(),
      ts({
        // ts 插件
        tsconfig: path.resolve(__dirname, 'tsconfig.json')
      }),
      resolvePlugin() // 解析第三方模块插件
    ]
  }
}

// rollup需要导出配置文件，可以是一个配置文件数组
export default types.map((type) => {
  return createBuildConfig(type, buildTypeOutputConfig[type])
})
