/**
 * lint-staged configuration for foundryvtt-scenery
 *
 * Runs linters on staged files and auto-fixes issues before commit.
 */
export default {
  // TypeScript files (auto-fix and re-stage)
  'src/**/*.ts': ['pnpm exec prettier --write', 'pnpm exec eslint --fix'],

  // JSON files (format only, exclude pnpm-lock and auto-generated files)
  '!(.vscode/**|pnpm-lock|tsconfig*|.prettierrc).json': ['pnpm exec prettier --write'],

  // Markdown files (format only)
  '**/*.md': ['pnpm exec prettier --write'],

  // SCSS files (format only)
  'styles/**/*.scss': ['pnpm exec prettier --write'],

  // Handlebars templates (format only)
  'templates/**/*.hbs': ['pnpm exec prettier --write'],
};
