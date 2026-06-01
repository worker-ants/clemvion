// @ts-check
// web-chat-sdk lint — eslint flat config (eia-sdk-publish §결정 / followup #7: eslint devDep 채택).
// 브라우저 host(loader/bridge) + jsdom jest 환경. backend 와 동일 eslint v9 / typescript-eslint v8 라인.
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "eslint.config.mjs"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
);
