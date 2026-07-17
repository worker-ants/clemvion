# Code Review 통합 보고서

## 세션 성격 (종결용 리뷰)
이 세션은 선행 세션 `review/code/2026/07/17/16_33_59/`(SUMMARY WARNING#1: 동적 `import()`/`require()` 레이어 가드 우회 미차단, WARNING#2: negative-space 가드 회귀 테스트 부재)의 fix 커밋 `e0e2123d4` 만을 diff 스코프로 재리뷰한 **종결용(termination) 리뷰**다. 목적은 applier 의 fix 코드 자체가 미리뷰로 남지 않게 하는 것이며, 대상 파일은 `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 2개뿐이다.

security·requirement·scope 3개 리뷰어가 실제 ESLint 실행·vitest 실행·git blob 비교·의도적 config mutation 재현으로 선행 WARNING#1/#2 가 완전히 해소됐음을 실측 확인했다(각 리뷰 본문 참조).

## 전체 위험도
**LOW** — CRITICAL 없음. fix 자체(동적 import/require 우회 차단)는 실측(ESLint 실행 + 6종 mutation testing)으로 견고함이 확인됐으나, 회귀 테스트의 잔여 커버리지 갭(override 무력화·bare import 미탐지) 2건, 정규식 패턴 중복 1건, 아키텍처 문서화·스코프 정합성 2건 등 WARNING 5건이 향후 유지보수 관점에서 발견됨.

**측정 아티팩트 반증 (위험도 산정에 미반영)**: side_effect 가 보고한 "신규 테스트 1회 실패"는 리뷰 대상 커밋과 무관한 공유 worktree 내 동시 mutation-testing 아티팩트(`eslint.config.mjs.bak`, `eslint.config.mutated.mjs`, `eslint-layering-guard.mutation-check.test.ts` — 다른 sub-agent 가 생성·삭제한 흔적, 현재 워크트리에는 존재하지 않음)로 인한 것이며, clean tree 에서 3회 연속 16/16 통과로 반증됨. 실제 결함이 아니므로 WARNING 으로 승격하지 않음 (아래 표에도 미포함).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 회귀 테스트가 flat config 배열에서 `files.includes("src/lib/**")` 인 **첫 블록만** `.find()` 로 추출해 합성 config 로 검증한다. 실제 ESLint 는 배열 전체를 순회하며 동일 rule-ID 는 "나중 블록이 우선"으로 병합하는데, 이 테스트는 그 의미론을 재현하지 않는다. 실측(mutation): 배열 뒤쪽에 동일 `files: ["src/lib/**"]` 를 재매칭하며 두 규칙을 `"off"` 로 재설정하는 override 블록을 추가하면 실제 `npx eslint` 는 위반을 놓치는데(neutralize 확인) 이 회귀 테스트는 16/16 그대로 통과한다. 동일한 구조적 원인으로, "`eslint-config-next` 업그레이드로 인한 병합 동작 변화"에 대한 방어도 테스트 구조상 원리적으로 커버 범위 밖(architecture 리뷰 별도 지적, 근본 원인 동일). | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:20-24` | (a) `verifyConfig` 를 `src/lib/**` 를 매칭하는 모든 블록을 순서대로 병합한 것으로 구성해 실제 병합 의미론을 재현, 또는 최소 (b) "매칭 블록이 정확히 1개"임을 assert하는 테스트 추가 |
| 2 | 테스트 | `no-restricted-imports` 의 `group` 배열과 동적 selector 정규식 모두 서브패스 없는 "bare" 형태(`"@/components"`, `"**/../components"`)를 하위경로 형태와 별도 엔트리로 갖고 있으나, 회귀 케이스는 전부 서브패스가 있는 형태(`@/components/foo` 등)만 검사한다. 실측: bare 엔트리만 제거하는 mutation 을 가해도 16/16 그대로 통과(반면 원본 config 로 실제 `npx eslint` 는 bare import 를 정상적으로 error 로 잡음) — 방어선은 코드에 존재하나 테스트가 그 존재를 검증하지 못하는 사각지대. | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:264-282` | `it.each` 위반 케이스에 bare 형태 4종(`import "@/components"`, `import "../components"`, `import("@/components")`, `require("../components")`) 추가 |
| 3 | 유지보수성 | `@/components` 경로 매칭 정규식(`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$`)이 동적 `import()` selector 와 `require()` selector 두 곳에 문자 그대로 복붙되어 있다(+ `no-restricted-imports.patterns[].group` glob 배열까지 더하면 동일 개념이 3곳에 서로 다른 문법으로 인코딩). 향후 패턴 확장(예: 새 alias 추가) 시 일부만 갱신하고 나머지를 빠뜨릴 drift 위험이 구조적으로 남아 있으며, 현재 회귀 테스트는 "두 정규식이 항상 동일해야 한다"는 불변조건 자체는 검증하지 않는다. | `codebase/frontend/eslint.config.mjs:52`, `:59` | 정규식 본체를 상수(`COMPONENTS_PATH_RE`)로 추출해 두 selector 에서 템플릿 리터럴로 보간, 단일 소스화. 여유 있으면 "두 정규식 문자열 동일" assert 케이스 추가 |
| 4 | 아키텍처 | 레이어 경계 규약(`lib → components` import 금지)이 `spec/conventions/` 에 정식 문서화되지 않고 코드 주석(eslint.config.mjs·rag-types.ts·conversation-utils.ts·테스트 docstring) 3~4곳에 분산 존재. 프로젝트 CLAUDE.md 의 "정식 규약은 spec/conventions/ 가 단일 진실" 원칙과 어긋나며, CI 가 강제하는 아키텍처 규칙의 "왜"가 spec 이 아니라 코드에만 있어 향후 새 디렉터리에 이 원칙을 적용할지 판단 근거가 부족하다. (선행 리뷰 requirement INFO#3 과 동일 이슈이나, architecture 는 이번 실측을 근거로 WARNING 으로 판단) | `codebase/frontend/eslint.config.mjs:54-56`, `src/lib/conversation/rag-types.ts:1-9`, `src/components/editor/run-results/conversation-utils.ts:1-4` | `spec/conventions/frontend-layering.md`(가칭) 신설, 코드 주석은 그 문서를 가리키는 참조로 축약 |
| 5 | 아키텍처 | 가드 스코프가 `files: ["src/lib/**"]` 로 한정되어 있어, 동일한 계층적 지위(하위 계층)를 갖는 sibling 디렉터리 `src/types/**`(`transform.ts` 등 순수 타입 정의)는 커버하지 않는다. 현재 위반은 0건(실측 확인)이라 즉각적 결함은 아니나, "레이어 역전 금지"라는 아키텍처 의도가 `src/lib` 라는 디렉터리 이름 하나에 우연히 국소화됐을 가능성이 있다. | `codebase/frontend/eslint.config.mjs:62` | `src/types/**` 도 동일 규칙을 적용할지 spec/conventions 문서에서 결정 후 필요시 `files` glob 확장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | ESLint 정규식 selector 는 빌드타임 소스 리터럴에만 매칭되어 ReDoS 등 런타임 공격표면이 아니며, 패턴 구조상 catastrophic backtracking 소지도 없음 | `eslint.config.mjs:87,94` | 조치 불필요 |
| 2 | 보안 | 린트 규칙은 "정직한 실수" 방지용이며 `eslint-disable` 주석 등 의도적 우회에 대한 강제력은 설계상 없음(팀이 이미 인지) | `eslint.config.mjs:53-173` | 조치 불필요 |
| 3 | 보안 | 신규 테스트가 실제 config 객체를 그대로 로드해 검증하는 fail-closed 설계 — 긍정적 | `eslint-layering-guard.test.ts:15-36` | 조치 불필요 |
| 4 | 요구사항 | 커밋 메시지의 "위반 8건" 표기가 실제 `it.each` 10건과 불일치(문서 오기, 코드/동작에는 영향 없음) | `eslint-layering-guard.test.ts:266-283` | 조치 불필요 |
| 5 | 요구사항 | 계산된 동적 specifier(변수, 보간 template literal)는 여전히 탐지 불가 — config 주석에 명시적으로 문서화된 의도적 잔여 한계 | `eslint.config.mjs:23-26,52,59` | 조치 불필요, 향후 실사례 발견 시 별도 이슈화 |
| 6 | 범위 | git diff 표면적(48줄 추가)이 실질 fix 델타보다 커 보이는 것은 원본 레이어 가드가 선행 리뷰 시점엔 uncommitted 상태였던 히스토리 특성 때문(blob 비교로 실질 델타는 주석 4줄+규칙 2개임을 확인). 범위 이탈 아님 | `eslint.config.mjs` 전체 diff | 조치 불필요, orchestrator 참고용 |
| 7 | 범위 | 선행 WARNING#1 이 "규칙 추가 또는 주석 명시" 택일을 제안했으나 이번 fix 는 둘 다 적용(동일 fix 의도 내 자연스러운 보강) | `eslint.config.mjs:18-21`, `:26-42` | 조치 불필요 |
| 8 | 부작용 | `npx eslint .` 2회 실측 결과 baseline(0 errors/12 warnings) 불변, `src/lib/**` 기존 동적 import/require 사용처 전수 조사 결과 신규 규칙 매칭 0건 — 순수 예방적 추가 | `eslint.config.mjs` L62-100 | 조치 불필요 |
| 9 | 부작용 | 정규식 경계 처리 적절 — `@/components-extra`, `../component-utils`(단수) 등 유사 이름 오탐 없음 | `eslint.config.mjs` L86-87,93-94 | 조치 불필요 |
| 10 | 부작용 | 신규 rule key 가 `eslint-config-next` 프리셋을 override 하지 않음(flat config 11블록 전수 스캔으로 확인) | `eslint.config.mjs` 전체 | 조치 불필요 |
| 11 | 부작용 | `files: ["src/lib/**"]` 에 확장자 필터가 없으나, 비-JS 파일(`.json`,`.mdx`)은 parser/languageOptions 블록이 없어 실측상 graceful skip 됨(collateral 없음) | `eslint.config.mjs` L62 | 필요 시 `files: ["src/lib/**/*.{ts,tsx}"]` 로 좁히는 것 고려 가능(현재는 문제 없음) |
| 12 | 부작용 | 신규 테스트는 `Linter#verify()` 인메모리 호출뿐인 순수 단위 테스트 — 파일시스템/네트워크/전역상태 부작용 없음, self-trip 위험도 없음 | `eslint-layering-guard.test.ts` | 조치 불필요 |
| 13 | 유지보수성 | 테스트 최상단 module-level `throw`(가드 블록 부재 시) — 의도는 타당하나 vitest 리포트에서 개별 `it` 실패보다 "파일 전체 로드 실패"로 표시되어 CI 로그 해석이 다소 불친절할 수 있음 | `eslint-layering-guard.test.ts:19-23` | 선택: `beforeAll` 내부로 이동하면 실패 리포트가 더 명확해짐(필수 아님) |
| 14 | 유지보수성 | esquery selector + 이중 이스케이프 정규식이 한 줄에 뒤섞여 가독성이 다소 낮음 | `eslint.config.mjs:52,59` | WARNING#3 의 상수 추출로 자연히 개선됨(별도 조치 불필요) |
| 15 | 테스트 | 테스트가 config 배열의 매칭 문자열(`"src/lib/**"`)에 엄격 의존 — fail-open 방향이 아닌 "과민 반응"(정당한 리팩터링도 throw) 방향이라 위험도는 낮음 | `eslint-layering-guard.test.ts:23-25` | 조치 불필요, 유지보수자 인지용 |
| 16 | 테스트 | Mock 미사용, 실제 config + 실제 `Linter` 사용 — 목적(config 약화 시 즉시 드러남)에 정확히 부합하는 설계 | 파일 전체 | 조치 불필요 |
| 17 | 아키텍처 | 레이어 경계 판단(lib=하위, components=상위)은 실측(255개 파일 `components→lib` 정상 의존 vs `lib→components` 0건)으로 뒷받침됨. Dependency Rule 을 CI fitness function 으로 강제하는 정석 패턴 | `eslint.config.mjs:53-100` | 조치 불필요, 유지 |
| 18 | 아키텍처 | 정규식 기반 2-rule 조합은 현재 규모(경계 1쌍)엔 적절하나, 경계 쌍이 늘어나면 `eslint-plugin-import` `no-restricted-paths` 같은 zone 기반 선언적 도구 대비 선형 증식 소지 | `eslint.config.mjs:82-98` | 지금은 과설계이므로 조치 불필요, 경계 2쌍 이상 시 재평가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 lint/test 설정 변경, 전통적 보안 공격표면(인젝션·인증·시크릿·I/O) 전무 확인. INFO 3건만 |
| requirement | NONE | 선행 WARNING#1(동적 import/require 우회)·WARNING#2(회귀 테스트 부재)를 실제 ESLint 실행 + vitest 16/16 통과 + 의도적 config mutation 재현으로 완전 해소 확인 |
| scope | NONE | blob 대 blob 비교로 실질 fix 델타(주석 4줄+규칙 2개+제안된 테스트)만 정확히 포함됨을 실측. 요청 외 리팩토링·무관 변경 없음 |
| side_effect | LOW | `npx eslint .` baseline 불변·오탐 0건 실측. 유일 특이사항(테스트 1회 flake)은 리뷰 대상과 무관한 공유 worktree mutation-testing 아티팩트로 원인 규명·반증됨(위 참고) |
| maintainability | LOW | `@/components` 매칭 정규식이 두 selector 에 문자 그대로 중복 — 향후 패턴 확장 시 drift 위험 (WARNING 1건) |
| testing | LOW | 6종 실측 mutation testing 으로 핵심 위협모델(glob 오타·규칙 삭제·패턴 완화)은 정밀하게 방어 확인. flat-config override 무력화 경로 + bare import 사각지대 2건이 실측으로 확인됨 (WARNING 2건) |
| architecture | LOW | 레이어 방향 판단은 실측(255:0)으로 타당. spec/conventions 미문서화, 가드 스코프의 `src/types/**` 누락 2건 (WARNING 2건, 그중 1건은 testing WARNING과 근본 원인 공유) |

## 발견 없는 에이전트

security, requirement, scope — 3개 리뷰어 모두 CRITICAL/WARNING 없이 INFO(문제없음/조치불필요) 로만 결론, 위험도 NONE.

## 권장 조치사항

1. (테스트, WARNING#1) 회귀 테스트가 flat config 의 "나중 블록 우선" 병합 의미론을 반영하도록 개선 — 실제 배열 전체(또는 매칭되는 모든 블록)를 병합해 검증하거나, 최소한 "매칭 블록이 정확히 1개"임을 assert.
2. (테스트, WARNING#2) `it.each` 위반 케이스에 서브패스 없는 bare import/require 4종을 추가해 사각지대 해소.
3. (유지보수성, WARNING#3) `@/components` 매칭 정규식을 상수로 추출해 두 selector 간 중복 제거, drift 위험 원천 차단.
4. (아키텍처, WARNING#4) `spec/conventions/frontend-layering.md`(가칭) 신설해 레이어 경계 규약을 SoT 화 — project-planner 위임 검토.
5. (아키텍처, WARNING#5) 위 spec 문서에서 `src/types/**` 등 sibling 디렉터리도 가드 스코프에 포함할지 결정.
6. (선택, INFO#13) 테스트 module-level throw 를 `beforeAll` 로 이동해 CI 실패 리포트 가독성 개선 — 필수 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing` (7명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (소스 코드 변경 시 항상 적용 — `eslint.config.mjs`, `eslint-layering-guard.test.ts`) — `architecture` 는 강제가 아니라 "레이어 경계 집행 규칙 강화" 라는 자체 판단으로 선정됨
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 린트 규칙은 빌드타임만 영향; 테스트 추가도 런타임 성능 무관 |
  | documentation | public API 변경 없음; ESLint 메시지는 내부용 |
  | dependency | package.json 변경 없음 |
  | database | DB 쿼리·마이그레이션 변경 없음 |
  | concurrency | 비동기/락/큐 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 내부 lint 설정·테스트 변경만 |
