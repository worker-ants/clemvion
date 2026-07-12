// @ts-check
// @workflow/sdk lint — eslint flat config (eia-context-followups #3/#5: 내부 패키지 lint 커버리지).
// Node 라이브러리 + jest 환경. backend·web-chat-sdk 와 동일 eslint v9 / typescript-eslint v8 라인.
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
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // 언더스코어 접두 미사용 식별자(의도적 무시)는 허용.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
