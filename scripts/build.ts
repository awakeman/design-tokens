/*
Copyright © 2024 The Sage Group plc or its licensors. All Rights reserved
 */

import * as fs from "fs"
import { StyleDictionary, groups } from './style-dictionary.js'
import { Config, DesignToken, File, FileHeader } from 'style-dictionary/types'
import { FilterComponent } from './utils/filter-component.js'
import { xamlFormat } from './formats/xamlFormat.js'
import { deflate } from "zlib"
import { TransformedToken } from "style-dictionary"


const components = fs.readdirSync('./data/tokens/components/')
const context = fs.readdirSync('./data/tokens/context/')
const modes = fs.readdirSync('./data/tokens/modes/')
const screensize = fs.readdirSync('./data/tokens/screensize/')

const fileHeader: FileHeader = (defaultMessages = []) => {
  return [...defaultMessages, 'THIS FILE IS AUTO-GENERATED PLEASE DO NOT EDIT', `Generated on ${new Date().toLocaleDateString()}`]
}

interface IMode {
  modeName?: string
  format: string
  subType: string
  suffix: string
}

interface IFiles extends IMode {
  componentName: string
  outputRefs?: boolean
}

interface IConfig {
  contextName: string
  modeName: string
  sizeName: string
}

StyleDictionary.registerFormat({
	name: 'custom/xaml/wpf',
	format: xamlFormat,
});

const getMode = ({modeName = '', format, subType, suffix}: IMode): File[] => {
  const mode = format.includes('variables') ? '' : modeName

  const componentArray: File[] = []

  components.forEach((component) => {
    const componentName = component.split('.json')[0]

    if (!componentName) {
      throw new Error(
        `Component name not found for ${component}`)
    }

    componentArray.push(...getFiles({componentName, modeName: mode, format, subType, suffix, outputRefs: true}))
  })
  
  return [
    ...getFiles({componentName: 'modes', modeName, format, subType, suffix}),
    ...componentArray
  ]
}

const getGlobalXaml = ({format, subType, suffix}: IMode): File[] => {
  const componentArray: File[] = []

  components.forEach((component) => {
    const componentName = component.split('.json')[0]

    if (!componentName) {
      throw new Error(
        `Component name not found for ${component}`)
    }

    componentArray.push(...getFiles({componentName, modeName: 'global', format, subType, suffix, outputRefs: true}))
  })
  
  return [
    ...getXamlFiles({componentName: 'global', modeName: 'global', format, subType, suffix}),
    ...componentArray
  ]
}

const getXamlFiles = (args : IFiles): File[] => {
  var files = getFiles(args);
  
  var filter = (token: TransformedToken, options: Config) => (options.usesDtcg ? token.$type : token.type) === 'color';
  if(args.modeName === 'global') {
    filter = (token: TransformedToken, options: Config) => (options.usesDtcg ? token.$type : token.type) !== 'color';
  }
  return files.map(f => {
    const existingFilter = f.filter;
    f.filter = (token: TransformedToken, options: Config) => {
      const keep = typeof(existingFilter) === 'function' && existingFilter(token, options)
      return keep && filter(token, options);
    };
    return f;
  })
}

const getFiles = ({componentName, modeName = '', format, subType, suffix, outputRefs = false}: IFiles): File[] => {
  const hasRefs = suffix === 'css' || suffix === 'scss'

  const getPath = (componentName: string) => {
    let path = ""

    switch(componentName) {
      case 'modes':
        path = hasRefs ? modeName : `${modeName}/mode`;
        break
      case 'global':
        path = 'global';
        break
      default:
        path = hasRefs ? `components/${componentName}` : `${modeName}/components/${componentName}`;
    }

    return path
  }

  const path = getPath(componentName).trim()

  return [
    {
      destination: `${subType}/${path}.${suffix}`,
      filter: (token: TransformedToken, options: Config) => FilterComponent(token, componentName),
      format,
      options: {
        outputReferences: outputRefs
      }
    }
  ]
}

const getGlobalConfig = ({contextName, sizeName}: IConfig) : Config => {
  const subType = `${contextName}/${sizeName}`

  return {
    source: [
      './data/tokens/primitives.json',
      './data/tokens/global/*.json',
      `./data/tokens/screensize/${sizeName}.json`,
      './data/tokens/modes/light.json',
      './data/tokens/components/*.json'
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
        css: {
          buildPath: 'dist/css/',
          transforms: groups.css,
          files: [
            ...getFiles({componentName: 'global', format: 'css/variables', subType, suffix: 'css'})
          ]
        },
      scss: {
        buildPath: 'dist/scss/',
        transforms: groups.scss,
        files: [
          ...getFiles({componentName: 'global', format: 'scss/variables', subType, suffix: 'scss'})
        ]
      },
      js: {
        buildPath: 'dist/js/',
        transforms: groups.js,
        files: [
          ...getFiles({componentName: 'global', format: 'javascript/module', subType: `common/${subType}`, suffix: 'js'}),
          ...getFiles({componentName: 'global', format: 'typescript/module-declarations', subType: `common/${subType}`, suffix: 'd.ts'}),
          ...getFiles({componentName: 'global', format: 'javascript/es6', subType: `es6/${subType}`, suffix: 'js'}),
          ...getFiles({componentName: 'global', format: 'typescript/es6-declarations', subType: `es6/${subType}`, suffix: 'd.ts'}),
          ...getFiles({componentName: 'global', format: 'javascript/umd', subType: `umd/${subType}`, suffix: 'js'})
        ]
      },
      json: {
        buildPath: 'dist/json/',
        transforms: groups.json,
        files: [
          ...getFiles({componentName: 'global', format: 'json/nested', subType: `nested/${subType}`, suffix: 'json'}),
          ...getFiles({componentName: 'global', format: 'json/flat', subType: `flat/${subType}`, suffix: 'json'})
        ]
      },
      xaml: {
        buildPath: 'dist/xaml/',
        transforms: groups.xaml,
        options: {
          fileHeader,
          showFileHeader: true
        },
        files: [
          ...getGlobalXaml({format: 'custom/xaml/wpf', subType: subType, suffix: 'xaml'}),
        ]
      },
      // todo: debug android build
      // android: {
      //   buildPath: 'dist/android/',
      //   transforms: groups.mobile,
      //   files: [
      //     ...getFiles({componentName: 'global', format: 'android/resources', subType, suffix: 'xml'})
      //   ]
      // },
      ios: {
        buildPath: 'dist/ios/',
        transforms: groups.mobile,
        files: [
          ...getFiles({componentName: 'global', format: 'ios/macros', subType, suffix: 'h'})
        ]
      },
    },
    log: {
      warnings: 'warn',
      verbosity: 'verbose',
      errors: {
        brokenReferences: 'throw',
      },
    },
  }
}

const getModeConfig = ({contextName, modeName, sizeName}: IConfig) : Config => {
  const subType = `${contextName}/${sizeName}`

  return {
    source: [
      './data/tokens/primitives.json',
      './data/tokens/global/*.json',
      `./data/tokens/screensize/${sizeName}.json`,
      `./data/tokens/modes/${modeName}.json`,
      './data/tokens/components/*.json',
      `./data/tokens/context/${contextName}.json`
    ],
    platforms: {
      css: {
        buildPath: 'dist/css/',
        transforms: groups.css,
        files: [
          ...getMode({modeName, format: 'css/variables', subType, suffix: 'css'})
        ]
      },
      scss: {
        buildPath: 'dist/scss/',
        transforms: groups.scss,
        files: [
          ...getMode({modeName, format: 'scss/variables', subType, suffix: 'scss'})
        ]
      },
      js: {
        buildPath: 'dist/js/',
        transforms: groups.js,
        files: [
          ...getMode({modeName, format: 'javascript/module', subType: `common/${subType}`, suffix: 'js'}),
          ...getMode({modeName, format: 'typescript/module-declarations', subType: `common/${subType}`, suffix: 'd.ts'}),
          ...getMode({modeName, format: 'javascript/es6', subType: `es6/${subType}`, suffix: 'js'}),
          ...getMode({modeName, format: 'typescript/es6-declarations', subType: `es6/${subType}`, suffix: 'd.ts'}),
          ...getMode({modeName, format: 'javascript/umd', subType: `umd/${subType}`, suffix: 'js'})
        ]
      },
      json: {
        buildPath: 'dist/json/',
        transforms: groups.json,
        files: [
          ...getMode({modeName, format: 'json/nested', subType: `nested/${subType}`, suffix: 'json'}),
          ...getMode({modeName, format: 'json/flat', subType: `flat/${subType}`, suffix: 'json'})
        ]
      },
      xaml: {
        buildPath: 'dist/xaml/',
        transforms: groups.xaml,
        options: {
          fileHeader,
          showFileHeader: true
        },
        files: [
          ...getMode({modeName, format: 'custom/xaml/wpf', subType: subType, suffix: 'xaml'}),
        ]
      },
      // todo: debug android build
      // android: {
      //   buildPath: 'dist/android/',
      //   transforms: groups.mobile,
      //   files: [
      //     ...getMode({modeName, format: 'android/resources', subType, suffix: 'xml'})
      //   ]
      // },
      ios: {
        buildPath: 'dist/ios/',
        transforms: groups.mobile,
        files: [
          ...getMode({modeName, format: 'ios/macros', subType, suffix: 'h'})
        ]
      }
    },
    log: {
      warnings: 'warn',
      verbosity: 'verbose',
      errors: {
        brokenReferences: 'throw',
      },
    },
  }
}

async function run() {
  try {
await Promise.all(context.map((context) => {
  const contextName = context.split('.json')[0]

  if (!contextName) {
    throw new Error(
      `Context name not found for ${context}`)
  }

  return screensize.map((size) => {
    const sizeName = size.split('.json')[0]

    if (!sizeName) {
      throw new Error(
        `Size name not found for ${size}`)
    }

    const styleDictionary = new StyleDictionary(getGlobalConfig({contextName, modeName: '', sizeName}))
    
    var platforms = ['xaml']
    if (sizeName !== 'desktop') {
      platforms = platforms.concat(
        [
          'css',
          'scss',
          'js',
          'json',
          'ios',
          //'android',
        ])
    }

    return platforms.map(platform => styleDictionary.buildPlatform(platform)).concat(modes.map((mode) => {
      const modeName = mode.split('.json')[0]

      if (!modeName) {
        throw new Error(
          `Mode name not found for ${mode}`)
      }

      const styleDictionary = new StyleDictionary(getModeConfig({ contextName, modeName, sizeName }))
      return platforms.map(platform => styleDictionary.buildPlatform(platform));
    }).reduce((a, b) => a.concat(b), []))
  }).reduce((a,b) => a.concat(b), [])
}).reduce((a,b) => a.concat(b), []))
  } catch(e) {
    console.log(e)
  }
}

await run()