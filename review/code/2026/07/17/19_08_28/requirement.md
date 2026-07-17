# Requirement Review — codebase/frontend/eslint.config.mjs + eslint-layering-guard.test.ts

## 배경

선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md`) WARNING #1(flat config 병합 의미론 미반영)·#2(bare 형태 사각지대)·#3(정규식 중복)의 후속 fix. 이번 브랜치(`origin/main..HEAD`, 4 commits)는 추가로 자체 리뷰에서 나온 severity 강등 미탐지(`a1e2ec8af`, 18_06_36 세션)와 백틱 우회·파서 미배선(`161699c7a`, 18_43_17 세션)도 함께 해소했다고 주장한다. 실제 diff(`codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`)와 워킹트리 최종 상태를 직접 읽고, 테스트를 실행해 검증했다.

## 검증 방법

1. `git log --oneline origin/main..HEAD` 로 4개 커밋(`a1e2ec8af` severity 보강, `e6e0fdc0d`/`3159b921b` review docs, `161699c7a` 백틱+파서) 확인.
2. `eslint.config.mjs`, `eslint-layering-guard.test.ts` 최종 파일 전문을 Read 로 직접 확인 — diff 조각이 아니라 병합된 최종 상태.
3. `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` 직접 실행 → **34/34 pass** (RESOLUTION.md 주장과 일치).
4. `npx eslint src/lib` 직접 실행 → 0 errors / 2 warnings(무관한 `no-unused-vars`, 레이어 가드와 무관) — baseline 회귀 없음.
5. `grep TODO\|FIXME\|HACK\|XXX` 대상 두 파일 → 0건.
6. `spec/` 전체에서 `no-restricted-imports`/`no-restricted-syntax`/이 레이어 규약을 다루는 전용 문서 검색 → 없음 (기존 트래킹 항목, 아래 발견사항 참고).

## 발견사항

- **[INFO]** W#1(flat config 병합 의미론)·W#2(bare 형태)·W#3(정규식 중복) 3건 모두 기능적으로 완전히 해소됨을 직접 실행으로 재확인
  - 위치: `codebase/frontend/eslint.config.mjs:7,15-17,73-90`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:32-34,57-68,115-119,122-156`
  - 상세: (a) `layeringBlocks`(복수, `.filter`) + `Object.assign({}, ...layeringBlocks.map(...))` 로 "나중 블록 우선" 병합을 실제 재현 — 단일 `.find()` 였던 이전 버전의 fail-open을 제거. (b) `it.each` 최상단에 bare 4종(`import "@/components"`, `import "../components"`, `import("@/components")`, `require("../components")`)이 추가돼 서브패스 없는 위반도 검증. (c) `COMPONENTS_PATH_RE` 단일 상수를 `literalSpecifier`/`backtickSpecifier` 헬퍼가 공유해, 이전에 `ImportExpression`·`CallExpression` selector 문자열에 정규식 리터럴이 중복 하드코딩되던 구조를 제거. `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 상수화로 메시지 중복도 함께 제거.
  - 제안: 조치 불요.

- **[INFO]** severity 강등(`"error"`→`"warn"`) 미탐지 갭이 실제로 닫혔음을 코드 레벨로 확인
  - 위치: `eslint-layering-guard.test.ts:70-80,115-119,157-162`
  - 상세: `ruleSeverity()` 헬퍼가 문자열/숫자 표기를 ESLint 숫자 severity(0/1/2)로 정규화하고, `mergedRules[...]` 설정값과 `Linter#verify()` 의 실제 출력 메시지(`m.severity`) 양쪽을 모두 `toBe(2)` 로 검증한다 — config 표기(`"error"` vs `2`) 리팩터에는 false-fail 하지 않으면서 실제 강등은 잡는 이중 방어. RESOLUTION.md 가 주장한 mutation 재현(7건 fail)과 방향이 일치.
  - 제안: 조치 불요.

- **[INFO]** 백틱(템플릿 리터럴) 우회 구멍이 실제로 차단됨을 확인 — `TemplateLiteral` 노드에는 `.value` 가 없어 기존 `[source.value=/.../]` selector 가 조용히 빗나가던 문제
  - 위치: `eslint.config.mjs:9-17,76-79,86-89`
  - 상세: `backtickSpecifier`가 `expressions.length=0` + `quasis.0.value.raw` 로 인터폴레이션 없는 백틱만 정확히 겨냥하고, 인터폴레이션 있는 계산 경로(`` import(`@/components/${n}`) ``)는 의도적으로 범위 밖으로 남긴다는 주석(48행)과 실제 테스트(`eslint-layering-guard.test.ts:187-190`, "인터폴레이션이 섞인 백틱은 계산 경로라 잡지 않는다")가 정확히 일치 — 문서(주석)와 구현의 괴리 없음.
  - 제안: 조치 불요.

- **[INFO]** 테스트 harness 파서 배선(`tsParser`) 방식이 합리적 트레이드오프이며 실제로 동작함을 확인
  - 위치: `eslint-layering-guard.test.ts:36-55`
  - 상세: `@typescript-eslint/parser` 직접 import 대신 `eslintConfig` 배열에서 `.ts` 대상 블록의 `languageOptions.parser` 를 추출해 재사용한다. RESOLUTION.md(18_43_17)가 실측으로 근거를 남겼다(`package.json` 미선언, `node_modules/@typescript-eslint` 부재, phantom dependency 위험) — `node-linker=isolated` 환경에서 합리적 설계 판단. `import type` fixture(`test.ts:151-152`)가 실제로 파싱·매칭됨을 34/34 통과로 재확인.
  - 제안: 조치 불요.

- **[INFO]** 파싱 에러(fatal) 은폐 경로가 fail-loud 로 전환됨
  - 위치: `eslint-layering-guard.test.ts:96-107`
  - 상세: `layeringErrors()` 가 `messages.find(m => m.fatal)` 을 먼저 체크해 파싱 실패 시 즉시 `throw` 한다 — 이전에는 fatal 메시지가 `ruleId` 필터(`no-restricted-imports`/`no-restricted-syntax`)에 걸리지 않아 "위반 0건"으로 위장 통과할 수 있었던 경로(예: 파서 배선이 깨지면 `import type` fixture가 파싱 자체에 실패해도 "정상적으로 위반 없음"처럼 보였을 것). 함수명(`layeringErrors`)과 실제 동작(위반 목록 반환 + fatal 시 예외)이 일치.
  - 제안: 조치 불요.

- **[INFO]** `spec/` 에 이 ESLint 레이어 경계 규약(`src/lib → @/components` 금지)을 다루는 전용 문서가 여전히 부재
  - 위치: N/A (spec 문서 부재 — `spec/conventions/` grep 0건)
  - 상세: 이는 spec 본문과의 불일치(SPEC-DRIFT)가 아니라 **spec 자체의 부재**다. 코드 구현이 spec 을 위반하는 것이 아니라, ESLint 레벨의 코드 컨벤션이 아직 `spec/conventions/*.md` 로 문서화되지 않은 상태 — 선행 리뷰(`17_29_21/SUMMARY.md` WARNING#4)와 이번 세션의 `18_43_17/RESOLUTION.md` INFO#6 양쪽에서 이미 `project-planner` 위임으로 트래킹 중이며, 이번 diff(W#1~#3 + severity/백틱 후속) 의 명시 범위 밖이다.
  - 제안: 조치 불요(이번 diff 범위 아님). 별도 `project-planner` 작업으로 `spec/conventions/frontend-layering.md`(가칭) 신설 검토는 기존 트래킹 유지.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음
  - 위치: `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 전체
  - 상세: `grep` 결과 0건. 미완성 작업 시사 없음.
  - 제안: 조치 불요.

## 요약

이번 diff 는 선행 리뷰 WARNING #1(flat config 병합 의미론 미반영)·#2(bare 형태 사각지대)·#3(정규식 중복) 3건을 모두 기능적으로 완전히 해소했으며, 직접 실행한 `npx vitest run`(34/34 pass) 과 `npx eslint src/lib`(0 errors, 무관 warning 2건만)로 회귀 없음을 재확인했다. 추가로 자체 리뷰에서 드러난 severity 강등 미탐지 갭과 백틱 리터럴 동적 import 우회 구멍(레이어 가드 도입 시점부터 존재하던 pre-existing 이슈)까지 사용자 승인 하에 같은 PR 범위에서 닫아, "src/lib 는 components 를 어떤 경로로도 import 할 수 없다"는 비즈니스 규칙이 정적/동적/CJS/문자열/백틱 리터럴 전 형태에 걸쳐 코드와 테스트 양쪽에 일관되게 반영됐다. 함수명(`layeringErrors`, `ruleSeverity`)과 주석이 실제 동작과 정확히 일치하고, 계산된 경로(interpolation)라는 의도된 커버리지 한계도 주석과 테스트가 서로 어긋나지 않는다. 관련 전용 spec 문서가 아직 없다는 점은 이번 diff 의 결함이 아니라 기존에 별도 트래킹 중인 항목이다. CRITICAL/WARNING 수준 발견사항 없음.

## 위험도

NONE
