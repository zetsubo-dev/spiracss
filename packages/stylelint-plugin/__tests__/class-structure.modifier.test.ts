import classStructure from '../dist/esm/rules/spiracss-class-structure.js'
import { testRule, withClassMode } from './rule-test-utils.js'

describe('spiracss/class-structure - modifier checks', () => {
  testRule({
    plugins: [classStructure],
    ruleName: classStructure.ruleName,
    config: [
      true,
      withClassMode({
        allowElementChainDepth: 4,
        enforceChildCombinator: false,
        naming: { blockCase: 'kebab' }
      })
    ],
    customSyntax: 'postcss-scss',

    accept: [
      {
        code: '.block { &.-modifier {} }',
        description: 'Modifiers are written with &'
      },
      {
        code: '.block { &.-modifier-name {} }',
        description: 'multi-word modifiers'
      }
    ],

    reject: [
      {
        code: '.block { .-modifier {} }',
        description: 'Modifiers cannot be written without &',
        message: 'Write modifier classes inside the Block using "&.<modifier>". Example: ".block { &.-primary { ... } }". Do not use ".block.-primary" or ".-primary" at top level. (spiracss/class-structure)'
      },
      {
        code: '.block.-modifier {}',
        description: 'top-level Block + modifier is not allowed',
        message: 'Write modifier classes inside the Block using "&.<modifier>". Example: ".block { &.-primary { ... } }". Do not use ".block.-primary" or ".-primary" at top level. (spiracss/class-structure)'
      },
      {
        code: '.block { &.modifier {} }',
        description: 'classes attached to & must use modifierPrefix',
        message: 'Only modifier classes may be appended to "&". Found "modifier". Use "&.<modifier>". Example: "&.-primary". If not a modifier, move it to its own selector. (spiracss/class-structure)'
      }
    ]
  })
})
