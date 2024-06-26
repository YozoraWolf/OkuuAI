import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// @ts-check


export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      "no-async-promise-executor": "off",
      "semi": ["error", "always"],
    },
  }
);