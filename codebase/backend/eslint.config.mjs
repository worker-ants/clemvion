// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // error 승격 (ai-review INFO-11): await 누락(floating promise)을 빌드 전 lint 에서
      // 차단. async emit 등 await 의존 코드의 회귀를 조기 검출 (PR #413 분산 seq counter
      // 의 await 마이그레이션 리스크 class). 승격 시점 기존 위반 0건.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      // 정리성 규칙(차단 아님). backend `lint` 가 유일하게 `--fix` 게이트였던 탓에
      // redundant `as T` 단언이 로컬에서만 제거되고 커밋 안 돼 누적됐다(전수 281건).
      // gate 를 타 패키지와 동일한 report-only 로 전환하면서, 본 규칙은 warn 으로
      // 가시화만 하고 차단하지 않는다 — opt-in 정리는 `pnpm --filter backend lint:fix`.
      // (error 로 두면 --fix 가 단언을 지우며 import 를 orphan 시켜 no-unused-vars
      //  cascade 로 게이트가 깨졌다.)
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unbound-method': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // 03 m-1 — backend 서비스 코드는 구조화 Logger(3-error-handling.md §6.2) 사용.
      // console.* 직접 사용 차단해 §6.2 로그 규약 drift 재발 방지. 면제: scripts/(CLI)·
      // instrumentation.ts(부트스트랩 이전 OTel)는 아래 override, code.handler 등
      // module-load 경로는 inline `// eslint-disable-next-line no-console`.
      'no-console': 'error',
    },
  },
  {
    // CLI 스크립트(독립 실행)·instrumentation.ts(NestJS 부트스트랩 이전 OTel)는
    // console 직접 사용이 정당 — no-console 면제 (03 m-1).
    files: ['src/scripts/**/*.ts', 'src/instrumentation.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // 테스트 더블·방어적 캐스트(`as T`)가 흔해 정리성 단언 경고는 노이즈 — off
      // (ai-review INFO#5; 프로덕션 코드에는 위 warn 유지).
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // 테스트는 디버그 console.* 가 흔하므로 no-console 면제 (03 m-1).
      'no-console': 'off',
    },
  },
);
