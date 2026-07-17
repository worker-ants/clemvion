# 부작용(Side Effect) 리뷰 — src/lib 레이어 가드 동적 import/require 커버 (e0e2123d4)

## 점검 방법

- 정적 분석(정규식·flat config 병합 규칙) + 실측(`npx eslint .`, `npx vitest run`)을 병행.
- 중점 질문: 신규 `no-restricted-syntax` 셀렉터 2개(`ImportExpression`, `CallExpression[callee.name='require']`)가 `src/lib/**` 의 정당한 동적 import 를 오탐해 baseline(0 errors / 12 warnings)을 깨뜨리는가?

## 발견사항

- **[INFO]** baseline 불변 확인 — 오탐 없음
  - 위치: `codebase/frontend/eslint.config.mjs` L62-100 (신규 `files: ["src/lib/**"]` 블록)
  - 상세: `npx eslint .` 를 2회 실측한 결과 `0 errors, 12 warnings` — 지시된 baseline 과 정확히 일치, 신규 rule 로 인한 error/warning 증가 없음. 또한 `grep -rn "import(\|require(" src/lib` 로 `src/lib/**` 내 기존 동적 import/require 사용처를 전수 조사했으나 `@/components`·상대경로 `components` 를 대상으로 한 것은 0건(모두 `../api/auth`, `sonner`, `../i18n`, `./locale-store` 등 무관 대상). 즉 신규 규칙은 현재 코드베이스에 대해 0건 매칭이며 순수 예방적(preventive) 추가로, 기존 코드를 깨뜨리지 않는다.
  - 제안: 없음 (정상).

- **[INFO]** 정규식 경계 처리 적절 — 유사 이름 오탐 없음
  - 위치: `eslint.config.mjs` L86-87, L93-94 (`/^(@\\/components(\\/.*)?|(\\.\\.\\/)+components(\\/.*)?)$/`)
  - 상세: `(\/.*)?)$` 구조 때문에 `components` 세그먼트 뒤에 `/` 또는 문자열 끝만 허용된다. `@/components-extra`, `../components-shared/foo`, `../component-utils`(단수) 같은 유사 이름은 `-`/`-shared` 뒤 문자가 `/` 도 끝도 아니므로 매칭되지 않는다 — 향후 이런 이름의 정당한 모듈이 생겨도 오탐 위험이 낮다.
  - 제안: 없음 (설계 의도대로 동작).

- **[INFO]** 신규 rule key 가 기존 preset 을 override 하지 않음
  - 위치: `eslint.config.mjs` 전체 flat config 배열(11개 블록)
  - 상세: `node --eval "import('./eslint.config.mjs')..."` 로 11개 config 블록을 전수 스캔한 결과, `no-restricted-imports`/`no-restricted-syntax` 는 신규 블록(index 10, `files: ["src/lib/**"]`)에만 정의되어 있고 `eslint-config-next`(nextVitals/nextTs) preset 어디에도 동일 rule key 가 없다. 따라서 이 추가가 `src/lib/**` 서브셋에 대해 기존에 더 넓게 적용되던 restriction 을 silent 하게 약화·override 하는 부작용은 없다.
  - 제안: 없음.

- **[INFO]** `files` glob 에 확장자 필터가 없음 — 비-JS 파일 collateral 우려는 실측으로 기각
  - 위치: `eslint.config.mjs` L62 `files: ["src/lib/**"]`
  - 상세: 다른 블록(`files: ["**/*.ts", "**/*.tsx"]` 등)과 달리 확장자 제한이 없어, 이론상 `src/lib/**` 하위 비-JS 자산(실측: `src/lib/i18n/__tests__/hardcoded-korean-baseline.json`, `src/lib/docs/__tests__/fixtures/**/*.mdx`)까지 flat config 의 "matched files" 집합에 포함될 가능성을 점검했다. 해당 파일들을 직접 `npx eslint <file>` 로 타겟팅한 결과 `File ignored because no matching configuration was supplied` 로 graceful skip 됨을 확인 — 이 config 어디에도 `.json`/`.mdx` 용 parser/languageOptions 블록이 없어 실제 파싱·린팅 대상에 편입되지 않는다. `npx eslint .` 전체 스캔 결과도 이 파일들을 error/warning 으로 표면화하지 않는다(위 baseline 확인과 일치). collateral side effect 없음.
  - 제안: 없음. 다만 향후 `src/lib/**` 에 `.json`/`.mdx` 용 rule 블록이 추가될 경우 이 glob 이 의도치 않게 넓게 매칭될 수 있으니, 필요 시 `files: ["src/lib/**/*.{ts,tsx}"]` 로 좁히는 것을 고려할 수 있음(현재는 문제 없음, 정보성 제안).

- **[INFO]** 신규 테스트 파일의 부작용 범위
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (신규)
  - 상세: `Linter#verify()` 를 인메모리로만 호출하는 순수 단위 테스트 — 파일시스템 쓰기·네트워크 호출·환경변수 읽기/쓰기·전역 상태 변경 없음. 테스트 fixture 문자열(`'import("@/components/foo")'` 등)은 실제 AST 상의 import 문이 아니라 `Linter#verify()` 에 전달되는 문자열 리터럴이므로, 이 테스트 파일 자신이 신규 규칙에 self-trip 될 위험도 없음(`npx eslint src/lib/__tests__/eslint-layering-guard.test.ts` 실측 결과 0 issues).
  - 제안: 없음.

- **[WARNING]** (리뷰 대상 diff 자체의 결함 아님) 공유 worktree 동시 작업으로 인한 1회성 측정 flake — 원인 규명 기록
  - 위치: 리뷰 세션 중 관찰, 리뷰 대상 파일 아님
  - 상세: 신규 테스트를 최초 단독 실행했을 때(`Start at 17:31:35`) `layeringBlock?.rules` 가 없다는 이유로 fail-open 가드 에러가 발생해 0 tests 로 실패했다. 직후 3회 연속 재실행은 모두 16/16 통과. 원인을 추적한 결과 같은 worktree 에 `codebase/frontend/eslint.config.mjs.bak`(16:53 생성), `codebase/frontend/eslint.config.mutated.mjs`·`src/lib/__tests__/eslint-layering-guard.mutation-check.test.ts`(17:33 생성, `files: ["src/lib-typo/**"]` 로 의도적으로 mutate 된 내용)가 untracked 로 남아 있는 것을 발견했다 — 이는 **본 리뷰 대상 커밋에 포함되지 않은 파일**이며, 다른 동시 실행 중인 프로세스(별도 sub-agent 로 추정)가 mutation-testing 목적으로 실제 `eslint.config.mjs` 를 일시적으로 치환·복원하는 작업을 수행한 흔적으로 보인다. 내 최초 테스트 실행이 그 치환 windows 와 겹치며 우연히 실패한 것으로 판단되며, 리뷰 대상 diff(`eslint.config.mjs`, `eslint-layering-guard.test.ts`) 자체의 결함이 아니다. (참고: 프로젝트 메모리 "ai-review flaky 측정 아티팩트" 사례와 동일 패턴 — 공유 worktree 동시 편집이 측정을 오염시킴.)
  - 제안: 이 발견을 orchestrator/사용자에게 전달해 격리된 worktree 에서 재검증하거나, 해당 mutation-testing 산출물(.bak/.mutated.mjs/mutation-check.test.ts)이 다른 서브에이전트의 정상 산출물인지 확인 후 정리 필요. 본 리뷰어는 그 파일들을 리뷰 대상이 아니므로 건드리지 않았음.

## 요약

리뷰 대상 diff(`eslint.config.mjs` 의 `no-restricted-syntax` 셀렉터 2개 + 회귀 테스트)는 순수 정적 lint 설정 추가로, 런타임 전역 상태·파일시스템·환경변수·네트워크·이벤트/콜백에 관여하지 않으며 기존 함수 시그니처나 공개 API 도 변경하지 않는다. 지시된 baseline(`npx eslint .` → 0 errors / 12 warnings)은 diff 적용 후에도 정확히 유지되었고, `src/lib/**` 내 기존 동적 import/require 사용처는 전수 조사 결과 `@/components` 관련이 전무해 신규 규칙이 오탐할 여지가 없다. 정규식 경계·rule key 충돌·비-JS 파일 collateral 가능성도 실측으로 기각했다. 유일한 특이사항은 diff 와 무관한, 공유 worktree 내 동시 프로세스의 mutation-testing 흔적으로 추정되는 1회성 테스트 flake이며 이는 리뷰 대상 코드의 결함이 아니라 환경 노이즈로 기록해 둔다.

## 위험도

LOW
