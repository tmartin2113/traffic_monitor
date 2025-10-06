/**
 * @file .eslintrc.cjs
 * @description ESLint configuration for production-ready TypeScript/React application
 * @version 1.0.0
 * 
 * Production-ready linting rules:
 * - Strict TypeScript checking
 * - React best practices
 * - Accessibility requirements (a11y)
 * - Security rules
 * - Performance optimizations
 * - No console statements in production code
 */

module.exports = {
  root: true,
  
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier', // Must be last to override other configs
  ],
  
  parser: '@typescript-eslint/parser',
  
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
    'jsx-a11y',
    'import',
  ],
  
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    },
  },
  
  rules: {
    // ========================================================================
    // TYPESCRIPT RULES
    // ========================================================================
    
    // Require explicit return types on functions
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
    }],
    
    // Require explicit accessibility modifiers on class members
    '@typescript-eslint/explicit-member-accessibility': ['error', {
      accessibility: 'explicit',
    }],
    
    // Disallow any type (must be explicit)
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Require consistent use of type imports
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: true,
    }],
    
    // Disallow unused variables
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    
    // Require consistent naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'enum',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE'],
      },
    ],
    
    // Disallow non-null assertions
    '@typescript-eslint/no-non-null-assertion': 'error',
    
    // Require promises to be handled
    '@typescript-eslint/no-floating-promises': 'error',
    
    // Disallow misused promises
    '@typescript-eslint/no-misused-promises': 'error',
    
    // Require await in async functions
    '@typescript-eslint/require-await': 'error',
    
    // Prefer nullish coalescing
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    
    // Prefer optional chaining
    '@typescript-eslint/prefer-optional-chain': 'error',
    
    // ========================================================================
    // REACT RULES
    // ========================================================================
    
    // Require React components to be written as functions
    'react/prefer-stateless-function': 'error',
    
    // Disallow missing key prop in iterators
    'react/jsx-key': ['error', {
      checkFragmentShorthand: true,
      checkKeyMustBeforeSpread: true,
    }],
    
    // Disallow missing React when using JSX
    'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
    
    // Require boolean prop naming
    'react/boolean-prop-naming': ['error', {
      rule: '^(is|has|should|can|will)[A-Z]([A-Za-z0-9]?)+',
      validateNested: true,
    }],
    
    // Disallow unused prop types
    'react/no-unused-prop-types': 'error',
    
    // Require default props for optional props
    'react/require-default-props': 'off', // TypeScript handles this
    
    // Disallow inline functions in JSX props (performance)
    'react/jsx-no-bind': ['error', {
      allowArrowFunctions: false,
      allowBind: false,
      allowFunctions: false,
    }],
    
    // Require self-closing tags when no children
    'react/self-closing-comp': 'error',
    
    // ========================================================================
    // REACT HOOKS RULES
    // ========================================================================
    
    // Enforce Rules of Hooks
    'react-hooks/rules-of-hooks': 'error',
    
    // Check effect dependencies
    'react-hooks/exhaustive-deps': 'warn',
    
    // ========================================================================
    // REACT REFRESH RULES
    // ========================================================================
    
    // Warn if components are not exported for Fast Refresh
    'react-refresh/only-export-components': ['warn', {
      allowConstantExport: true,
    }],
    
    // ========================================================================
    // ACCESSIBILITY RULES (a11y)
    // ========================================================================
    
    // Require alt text on images
    'jsx-a11y/alt-text': 'error',
    
    // Require ARIA roles to be valid
    'jsx-a11y/aria-role': 'error',
    
    // Require ARIA props to be valid
    'jsx-a11y/aria-props': 'error',
    
    // Disallow redundant roles
    'jsx-a11y/no-redundant-roles': 'error',
    
    // Require onClick to have onKeyDown for accessibility
    'jsx-a11y/click-events-have-key-events': 'error',
    
    // Require interactive elements to have labels
    'jsx-a11y/label-has-associated-control': 'error',
    
    // ========================================================================
    // IMPORT RULES
    // ========================================================================
    
    // Require imports to be sorted
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type',
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    
    // Disallow default exports (prefer named exports)
    'import/no-default-export': 'error',
    
    // Disallow duplicate imports
    'import/no-duplicates': 'error',
    
    // Disallow circular dependencies
    'import/no-cycle': ['error', { maxDepth: 3 }],
    
    // Require imports to resolve correctly
    'import/no-unresolved': 'error',
    
    // ========================================================================
    // GENERAL RULES
    // ========================================================================
    
    // CRITICAL: No console statements in production code
    'no-console': ['error', {
      allow: [], // No exceptions - use logger utility
    }],
    
    // Disallow debugger statements
    'no-debugger': 'error',
    
    // Disallow alert, confirm, prompt
    'no-alert': 'error',
    
    // Require === instead of ==
    'eqeqeq': ['error', 'always'],
    
    // Disallow var (use const/let)
    'no-var': 'error',
    
    // Prefer const over let when variable is never reassigned
    'prefer-const': 'error',
    
    // Require curly braces for all control statements
    'curly': ['error', 'all'],
    
    // Disallow else after return
    'no-else-return': 'error',
    
    // Require default case in switch statements
    'default-case': 'error',
    
    // Disallow eval()
    'no-eval': 'error',
    
    // Disallow extending native types
    'no-extend-native': 'error',
    
    // Disallow unnecessary function binding
    'no-extra-bind': 'error',
    
    // Disallow implicit type coercion
    'no-implicit-coercion': 'error',
    
    // Disallow use of __iterator__
    'no-iterator': 'error',
    
    // Disallow labels
    'no-labels': 'error',
    
    // Disallow use of __proto__
    'no-proto': 'error',
    
    // Disallow reassigning function parameters
    'no-param-reassign': 'error',
    
    // Disallow return await
    'no-return-await': 'error',
    
    // Disallow unnecessary template literals
    'no-useless-concat': 'error',
    
    // Prefer template literals over string concatenation
    'prefer-template': 'error',
    
    // Require radix parameter in parseInt
    'radix': 'error',
    
    // ========================================================================
    // COMPLEXITY RULES
    // ========================================================================
    
    // Limit cyclomatic complexity
    'complexity': ['error', { max: 10 }],
    
    // Limit maximum depth of nested blocks
    'max-depth': ['error', { max: 4 }],
    
    // Limit maximum number of lines per function
    'max-lines-per-function': ['error', {
      max: 100,
      skipBlankLines: true,
      skipComments: true,
    }],
    
    // Limit maximum number of parameters
    'max-params': ['error', { max: 5 }],
    
    // ========================================================================
    // SECURITY RULES
    // ========================================================================
    
    // Disallow use of Object.prototype methods directly
    'no-prototype-builtins': 'error',
    
    // Disallow assignment in return statement
    'no-return-assign': 'error',
    
    // Disallow script URLs
    'no-script-url': 'error',
    
    // Disallow self assignment
    'no-self-assign': 'error',
    
    // Disallow throwing literals
    'no-throw-literal': 'error',
    
    // Disallow unused expressions
    'no-unused-expressions': 'error',
  },
  
  // ========================================================================
  // FILE-SPECIFIC OVERRIDES
  // ========================================================================
  
  overrides: [
    // Allow default exports in config files
    {
      files: ['*.config.ts', '*.config.js', 'vite.config.ts', 'vitest.config.ts'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    
    // Relax rules for test files
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'tests/**/*'],
      env: {
        'vitest-globals/env': true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
        'max-lines-per-function': 'off',
      },
    },
    
    // Allow console in scripts
    {
      files: ['scripts/**/*'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  
  // Ignore patterns
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    '*.config.js',
    '.eslintrc.cjs',
  ],
};
