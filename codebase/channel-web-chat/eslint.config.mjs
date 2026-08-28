// ⚠️ frontend 와 같은 이유로 이 워크스페이스도 **eslint 9 에 남는다** —
// `eslint-config-next` 가 끌고 오는 react/jsx-a11y/import 플러그인이 eslint 9 를 상한으로
// 못 박는다. 실측 표와 해제 조건의 SoT 는 `codebase/frontend/eslint.config.mjs` 헤더 —
// 여기서 중복 기재하지 않는다(값이 바뀔 때 한쪽만 고쳐지는 드리프트 방지).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
