import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';
import securityPlugin from 'eslint-plugin-security';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Ignore patterns
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'vendor/**', '*.min.js'],
  },

  // JavaScript files configuration
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // FoundryVTT Core Globals
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly',
        foundry: 'readonly',

        // FoundryVTT Utilities
        duplicate: 'readonly',
        mergeObject: 'readonly',
        expandObject: 'readonly',
        flattenObject: 'readonly',
        diffObject: 'readonly',
        getProperty: 'readonly',
        setProperty: 'readonly',
        hasProperty: 'readonly',
        fromUuid: 'readonly',
        loadTemplates: 'readonly',
        renderTemplate: 'readonly',
        getTemplate: 'readonly',

        // FoundryVTT Classes - Applications
        Application: 'readonly',
        FormApplication: 'readonly',
        Dialog: 'readonly',
        FilePicker: 'readonly',
        ImagePopout: 'readonly',

        // FoundryVTT Classes - Documents
        Actor: 'readonly',
        Item: 'readonly',
        Scene: 'readonly',
        ChatMessage: 'readonly',
        Macro: 'readonly',
        Playlist: 'readonly',
        User: 'readonly',
        Folder: 'readonly',
        Combat: 'readonly',
        RollTable: 'readonly',
        JournalEntry: 'readonly',

        // FoundryVTT Classes - Canvas
        Token: 'readonly',
        Tile: 'readonly',
        Drawing: 'readonly',
        Wall: 'readonly',
        AmbientLight: 'readonly',
        AmbientSound: 'readonly',
        Note: 'readonly',
        MeasuredTemplate: 'readonly',

        // FoundryVTT Classes - Canvas Layers
        TextureLoader: 'readonly',

        // FoundryVTT Classes - Sidebar
        SceneDirectory: 'readonly',
        ActorDirectory: 'readonly',
        ItemDirectory: 'readonly',
        ChatLog: 'readonly',
        Settings: 'readonly',

        // FoundryVTT Classes - Collections
        Collection: 'readonly',

        // FoundryVTT Classes - Misc
        Hooks: 'readonly',
        Roll: 'readonly',
        DicePool: 'readonly',

        // Third-party Libraries (loaded by Foundry)
        PIXI: 'readonly',
        Handlebars: 'readonly',
        io: 'readonly',
      },
    },
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
      security: securityPlugin,
    },
    rules: {
      // Base JavaScript recommended rules
      ...js.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // Import plugin rules
      'import/extensions': 'off', // Foundry uses .js for ES modules
      'import/no-unresolved': 'off', // Foundry modules don't need resolution
      'import/prefer-default-export': 'off',

      // Security rules (browser context, less critical than backend)
      'security/detect-eval-with-expression': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-object-injection': 'off', // Too many false positives

      // Foundry-specific adjustments
      'no-underscore-dangle': 'off', // Foundry uses _id, _view, etc.
      'class-methods-use-this': [
        'error',
        {
          exceptMethods: ['getData', '_updateObject', '_prepareContext', '_onRender'],
        },
      ],

      // Code quality
      'no-console': ['warn', { allow: ['error'] }], // Allow console.error, warn on others
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Style preferences (aligned with Prettier)
      'no-param-reassign': 'off', // Common in Foundry modules
      'no-plusplus': 'off',
      'prefer-destructuring': 'off',
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // FoundryVTT Core Globals
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly',
        foundry: 'readonly',

        // FoundryVTT Utilities
        duplicate: 'readonly',
        mergeObject: 'readonly',
        expandObject: 'readonly',
        flattenObject: 'readonly',
        diffObject: 'readonly',
        getProperty: 'readonly',
        setProperty: 'readonly',
        hasProperty: 'readonly',
        fromUuid: 'readonly',
        loadTemplates: 'readonly',
        renderTemplate: 'readonly',
        getTemplate: 'readonly',

        // FoundryVTT Classes - Applications
        Application: 'readonly',
        FormApplication: 'readonly',
        Dialog: 'readonly',
        FilePicker: 'readonly',
        ImagePopout: 'readonly',

        // FoundryVTT Classes - Documents
        Actor: 'readonly',
        Item: 'readonly',
        Scene: 'readonly',
        ChatMessage: 'readonly',
        Macro: 'readonly',
        Playlist: 'readonly',
        User: 'readonly',
        Folder: 'readonly',
        Combat: 'readonly',
        RollTable: 'readonly',
        JournalEntry: 'readonly',

        // FoundryVTT Classes - Canvas
        Token: 'readonly',
        Tile: 'readonly',
        Drawing: 'readonly',
        Wall: 'readonly',
        AmbientLight: 'readonly',
        AmbientSound: 'readonly',
        Note: 'readonly',
        MeasuredTemplate: 'readonly',

        // FoundryVTT Classes - Canvas Layers
        TextureLoader: 'readonly',

        // FoundryVTT Classes - Sidebar
        SceneDirectory: 'readonly',
        ActorDirectory: 'readonly',
        ItemDirectory: 'readonly',
        ChatLog: 'readonly',
        Settings: 'readonly',

        // FoundryVTT Classes - Collections
        Collection: 'readonly',

        // FoundryVTT Classes - Misc
        Hooks: 'readonly',
        Roll: 'readonly',
        DicePool: 'readonly',

        // Third-party Libraries (loaded by Foundry)
        PIXI: 'readonly',
        Handlebars: 'readonly',
        io: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
      import: importPlugin,
      security: securityPlugin,
    },
    rules: {
      // Base TypeScript recommended rules
      ...tseslint.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // TypeScript-specific rules
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any but warn
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import plugin rules
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/prefer-default-export': 'off',

      // Security rules
      'security/detect-eval-with-expression': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-object-injection': 'off',

      // Foundry-specific adjustments
      'no-underscore-dangle': 'off',
      'class-methods-use-this': [
        'error',
        {
          exceptMethods: [
            'getData',
            '_updateObject',
            '_prepareContext',
            '_onRender',
            'title',
            '_onClickFilePicker',
          ],
        },
      ],
      '@typescript-eslint/no-this-alias': [
        'error',
        {
          allowedNames: ['app'], // Allow 'const app = this' in static methods
        },
      ],

      // Code quality
      'no-console': ['warn', { allow: ['error'] }],
    },
  },

  // Prettier config last (disables conflicting rules)
  prettierConfig,
];
