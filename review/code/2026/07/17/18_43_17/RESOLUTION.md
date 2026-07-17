# RESOLUTION — review/code/2026/07/17/18_43_17

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 | 코드 | `161699c7a` | 백틱 리터럴 동적 `import()`/`require()` 우회 차단. selector 를 `literalSpecifier`(문자열) + `backtickSpecifier`(`quasis.0.value.raw`, `expressions.length=0`) 양쪽으로 확장. 사용자 결정으로 이번 PR 에 포함 (pre-existing 이슈지만 이번 작업 주제와 동일 성격). |
| WARNING #2 | 코드 | `161699c7a` | 테스트 harness 파서 배선. `@typescript-eslint/parser` **직접 import 대신 config 에서 추출** — 아래 §설계 판단 참조. fatal 파싱 에러 fail-loud 전환 포함. |
| INFO #1 | 코드 | `161699c7a` | re-export fixture 2종(`export {} from`, `export * from`) 추가. |
| INFO #2 | 코드 | `161699c7a` | `ruleSeverity()` 를 숫자 표기로 실제 정규화(`SEVERITY_BY_NAME`), assertion `toBe(2)` 전환, 주석 정정. |
| INFO #3 | defer | — | bare 케이스 주석 분리 서술. 문서 정밀도 개선, 동작 영향 없음. |
| INFO #4 | defer | — | glob/regex 이중 표현 크로스레퍼런스 주석. ESLint API 제약상 구조적으로 단일 소스화 불가 — 주석만으로는 drift 를 실제로 막지 못해 별도 판단 필요. |
| INFO #5 | defer | — | severity 매직넘버 `2` 상수 추출. 인접 주석이 의미를 설명 중. |
| INFO #6 | defer (기존 트래킹) | — | `spec/conventions` 레이어 규약 문서 — 선행 리뷰 WARNING#4 로 이미 `project-planner` 위임 트래킹 중. 이번 diff 범위 밖. |
| INFO #7 | 조치 불요 | — | review 산출물의 절대경로 박제 — 감사 기록으로서 의도된 동작, 기존 패턴. |

## 설계 판단 — WARNING #2 를 제안대로 구현하지 않은 이유

reviewer 제안은 `@typescript-eslint/parser` 를 직접 import 하고 "devDependency 로 이미 존재" 라고 기술했으나, **실측 결과 그 전제가 틀렸다**:

- `codebase/frontend/package.json` 에 미선언 (`grep` 0건). 리포지토리 전체 package.json 어디에도 없음.
- `codebase/frontend/node_modules/@typescript-eslint` **부재**.
- `require.resolve` 는 `/Volumes/project/private/clemvion/node_modules/...` 로 해소 — 즉 **워크트리 바깥 리포지토리 루트**로 Node 가 상위 탐색해 우연히 잡히는 상태.

`.npmrc` 의 `node-linker=isolated` 는 정확히 이런 phantom dependency 를 fail-fast 시키려고 도입된 설정이다. 직접 import 했다면 로컬은 통과하고 Docker/CI clean install 에서 깨졌을 것이다.

**채택한 방식**: `eslint.config.mjs` 배열에서 `.ts` 에 적용되는 파서 인스턴스를 추출해 배선. 새 의존 없음, lockfile 변경 없음, 프로덕션과 동일 인스턴스라 버전 스큐 없음. 파서를 못 찾으면 fail-loud `throw`.

## TEST 결과

| 게이트 | 결과 |
|--------|------|
| `npx eslint` (frontend 전체) | **0 errors / 12 warnings** — baseline 동일, 회귀 없음 |
| `npx vitest run` (frontend 전체) | **279 파일 / 5542 pass, 1 skipped** |
| `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` | **34/34 pass** (fix 전 23) |
| `npx tsc --noEmit` | clean |

## Mutation 검증 (fail-open 이 아님을 증명)

| Mutation | 결과 | 판정 |
|----------|------|------|
| 백틱 selector 2개 제거 (= 원래 구멍 복원) | 5 failed / 29 passed | 신규 백틱 fixture 5건이 정확히 탐지 |
| `languageOptions.parser` 미배선 (espree 후퇴) | `fixture 파싱 실패` fail-loud throw | 조용한 통과 아님 — WARNING#2 의 핵심 우려 해소 |
| 뒤쪽 override 블록으로 두 규칙 `"off"` | 15 failed / 8 passed | 유지 |
| `COMPONENTS_PATH_RE` → NEVERMATCH | 8 failed / 15 passed | 유지 |
| severity `"error"` → `"warn"` | 15 failed / 8 passed (동시에 `npx eslint` CLI 는 exit 0) | 유지 — 유닛 테스트가 유일한 방어선 |
| 정규식 앵커 완화 (`components.*`) | 1 failed | 유지 |

## 실측 재확인 — 백틱 구멍 차단 (실제 `npx eslint --stdin`, 격리 Linter 아님)

| fixture | fix 전 | fix 후 |
|---------|--------|--------|
| `` import(`@/components/foo`) `` | **통과(우회)** | 차단 |
| `` import(`@/components`) `` (bare) | 통과(우회) | 차단 |
| `` require(`../components/foo`) `` | 레이어 가드 미발동 (`no-require-imports` 가 우연히 차단) | 레이어 가드가 직접 차단 |
| `import("@/components/foo")` (회귀 확인) | 차단 | 차단 |
| `import type { Foo } from "@/components/foo"` (회귀 확인) | 차단 | 차단 |
| `` import(`@/components/${n}`) `` (계산 경로) | 미매칭 | 미매칭 (의도된 커버리지 한계) |
| `` import(`@/components-legacy/x`) `` (근접 오탐) | 미매칭 | 미매칭 |

## pre-existing 여부

백틱 우회는 이번 브랜치가 만든 회귀가 **아니다**. `git show e370d1d02:codebase/frontend/eslint.config.mjs` 확인 결과 PR #967 로 가드가 도입된 시점부터 selector 가 `source.value` 였다. 이번 브랜치는 그 정규식을 상수로 추출했을 뿐이며, 리뷰 과정에서 기존 구멍이 드러나 사용자 승인 하에 함께 닫았다.

## ESCALATE

없음 — 사용자가 백틱 구멍 수정을 이번 PR 에 포함하기로 결정(AskUserQuestion), 그대로 이행.
