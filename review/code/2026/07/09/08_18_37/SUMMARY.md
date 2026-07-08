# Code Review 통합 보고서

대상 커밋: `62484807` — `refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치`
실질 코드 변경 4건(`href.ts`, `href.test.ts`, `workspace-store.ts`, `resolve-fallback.ts` JSDoc만) + 문서/spec 7건(CHANGELOG, RESOLUTION, spec 각주 5건).

## 전체 위험도

**MEDIUM** — Critical 0건. 다만 (1) `rerun-modal.tsx` 재실행 후 네비게이션이 이번 diff 가 갱신한 spec 문구(§10.2)와 실제로 어긋나는 기존 갭이 발견됐고, (2) 같은 diff 가 편집한 `RESOLUTION.md` 문구가 직전 fresh-review 세션의 실제 reviewer 산출 현황을 과대 서술하며, (3) 본 세션 자체에서도 `documentation`/`user_guide_sync` 두 reviewer 가 매니페스트상 `success` 로 보고됐음에도 출력 파일이 디스크에 존재하지 않는 동일 계열의 "reviewer 산출 갭"이 재발했다. 코드 로직 자체(보안 정규화 강화, DRY 위임)는 견고하고 회귀 없음이 라인 단위로 확인됨.

## 참고: 본 세션 reviewer 산출 갭 (재발)

- `documentation`, `user_guide_sync` 두 reviewer 는 `ran` 매니페스트에 `status=success` 로 보고되었으나, 대응 출력 파일(`documentation.md`, `user_guide_sync.md`)이 세션 디렉터리에 실제로 존재하지 않음(디렉터리 리스팅으로 확인). requirement reviewer 가 이번 diff 의 `RESOLUTION.md` 서술에서 지적한 "매니페스트 success ≠ 실제 파일 산출" 갭이 바로 이 세션에서도 재현된 것 — 우연이 아니라 반복되는 파이프라인 결함으로 보인다.
- 이 두 관점(문서 동기화, 사용자 가이드 동기화)은 이번 통합 보고서에서 커버되지 못했다. **재시도 필요.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `rerun-modal.tsx` 의 재실행 성공 후 네비게이션이 `handleSubmit`(onSuccess 콜백 없을 때, 실제 호출부 2곳 모두 해당) 에서 slug 미부착 bare path(`/workflows/:id/executions/:newId`)로 `router.push` 하여, 이번 diff 가 갱신한 `spec/5-system/13-replay-rerun.md` §10.2 문구(`/w/<slug>/...`)와 불일치. 같은 파일의 원본 ID 링크는 이미 `buildWorkspaceHref` 를 정확히 사용 중 | `codebase/frontend/src/components/executions/rerun-modal.tsx:290-292` (JSDoc `:59-62`) vs `spec/5-system/13-replay-rerun.md` §10.2 | `router.push`를 `router.push(buildWorkspaceHref(slug, ...))` 로 교정, JSDoc·회귀 테스트(`rerun-modal.test.tsx:192-211`) 동반 갱신. `(main)/[...rest]` catch-all 이 최종적으로 구제하나 불필요한 리다이렉트 바운스(스피너 플래시) 발생 |
| 2 | Requirement | `RESOLUTION.md` 갱신 문구가 직전 fresh-review(`07_56_16`) 결과를 과대 서술 — "9 reviewer 산출, Critical 0" 이라 적었으나 실제로는 7개 파일만 존재했고 requirement·testing 2건은 그 세션 SUMMARY 자체가 "재시도 필요" 로 명시한 미산출 상태였음 | `review/code/2026/07/08/18_24_41/RESOLUTION.md` (이번 diff 편집분) | "7/9 산출, 2건 갭 재발" 로 정정하거나 실제 재검증 세션 경로로 참조 갱신 |
| 3 | Architecture | open-redirect 방어 로직이 `buildWorkspaceHref`(이번 diff 로 backslash/tab/CR/LF 까지 강화)와 `isSafeRedirectPath`(`//` 만 검사) 두 곳에 비대칭 중복 존재. 현재는 `isSafeRedirectPath` 입력 경로에 실제 도달 불가하나, `proxy.ts`/`auth-provider.tsx`/`(main)/error.tsx` 가 이미 향후 `redirect` 파라미터 소비 배선을 깔아둔 상태라 그 소비 로직이 추가되면 이번에 고친 우회 클래스가 반대편에서 재현될 위험 | `codebase/frontend/src/lib/workspace/href.ts` vs `codebase/frontend/src/components/ui/error-page.tsx:36-43` | 공용 유틸(`lib/utils/safe-path.ts`)로 추출해 양쪽·향후 redirect 소비 코드가 공유하도록 통합. 최소한 동일 정규화 클래스를 `isSafeRedirectPath` 에도 적용 |
| 4 | Architecture | `workspace-store.ts`(런타임 import) ↔ `resolve-fallback.ts`(`import type`) 상호 참조의 순환 안전성이 lint 로 강제되지 않고 컨벤션에만 의존(`consistent-type-imports`/`import/no-cycle` 룰 부재 확인) | `workspace-store.ts:5`, `resolve-fallback.ts:1` | `WorkspaceSummary` 타입을 중립 위치(`lib/workspace/types.ts`)로 이동하거나 최소한 `@typescript-eslint/consistent-type-imports` lint 규칙 추가 |
| 5 | Testing | `workspace-store.setWorkspaces` 의 `resolveFallbackWorkspace` 위임 전환에 대한 직접 유닛 테스트 부재 — `workspace-store.test.ts` 는 `switchWorkspace` 만 다루고 `setWorkspaces` 케이스가 없음(위임된 순수 함수 자체는 별도 커버되나 스토어 상태 전이 통합은 미검증) | `workspace-store.ts:421-428`, `workspace-store.test.ts` | `describe("setWorkspaces", ...)` 추가 — 현재 id 유지/미존재 시 첫 항목 폴백/빈 목록 시 null/`loaded:true` 전환 각각 단언 |
| 6 | Testing | 신규 보안 회귀 테스트(`href.test.ts`)가 4개 우회 클래스(더블 백슬래시/단일 백슬래시/tab/slug+백슬래시)를 단일 `it` 에 결합-assert 로 뭉쳤고, tab 만 값으로 검증되어 CR(`\r`)/LF(`\n`) 개별 회귀는 감지 불가. slug 분기 × tab/CR/LF 조합도 미실행 | `href.test.ts:35-41` | `it.each` 또는 케이스별 개별 `it` 으로 분리, `\r`/`\n`/slug+control-char 조합 케이스 명시 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `buildWorkspaceHref` 신규 정규화는 WHATWG URL 파서의 실제 backslash/tab/CR/LF 동등 처리 규칙을 정확히 겨냥. 현재 모든 실호출부가 신뢰 가능한 리터럴/서버발급 id 뿐이라 실질 공격 표면은 0이며 방어 심층화 성격의 적절한 조치 | `href.ts:687-719` | 조치 불요. 향후 사용자 입력이 path 로 유입되는 호출부가 생기면 그 시점에 정규화 사후검증 단위테스트 추가 |
| 2 | Architecture | `resolveFallbackWorkspace` 로의 DRY 통합은 SRP·단일 진실 원칙에 부합하는 명확한 개선(3개 소비처 수렴) | `workspace-store.ts`, `resolve-fallback.ts` | 없음(긍정 관찰) |
| 3 | Maintainability | `href.ts` 의 제어문자 제거+선행 구분자 축약이 별개 `.replace()` 2회 체이닝 — 함수가 3줄이라 현재도 읽기 어렵지 않으나 단계별 변수명 부여 시 가독성 향상 여지 | `href.ts:717-719` | 필요 시 `withoutControlChars`/`clean` 단계 분리(저비용, 차단 사유 아님) |
| 4 | Maintainability | `/w/` 라우트 prefix 리터럴은 현재 `href.ts` 한 곳뿐이라 DRY 위반 아님. 직전 라운드 RESOLUTION 이 이미 `WORKSPACE_ROUTE_PREFIX` 상수화를 INFO-defer(#8)로 추적 중 | `href.ts:24` | 소비처 3곳 이상으로 늘면 재고, 현재는 조치 불요 |
| 5 | Scope | CHANGELOG 신규 블록이 "round-2 warning 조치" 커밋 규모 대비 phase-1 전체 설명을 통째로 담아 다소 방대하나, 직전 라운드에서 누락 지적된 action item("CHANGELOG 항목 추가")을 메우는 의도된 추가 | `CHANGELOG.md` | 조치 불요 |
| 6 | Requirement | `href.ts` 제어문자 제거가 선두 위치에 앵커링되지 않고 문자열 전체 적용 — WHATWG 규칙과 일치하는 의도된 동작이나, 경로 중간 리터럴 제어문자 케이스(`/foo\tbar`)에 대한 명시 테스트는 없음(실호출부 전부 정적 리터럴이라 실질 위험 낮음) | `href.ts:718-720` | Testing WARNING #6 과 함께 처리 |
| 7 | Dependency | 신규 외부 패키지·`package.json`/lockfile 변경 없음. `workspace-store.ts`→`resolve-fallback.ts` 신규 런타임 의존은 `import type` 상호참조로 순환 안전(코드 검증 완료) | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | rerun-modal bare path spec 불일치, RESOLUTION.md 과대서술 |
| architecture | LOW | open-redirect 로직 중복·비대칭, type-only 순환 lint 미강제 |
| testing | LOW | setWorkspaces 유닛 테스트 부재, href.test.ts CR/LF 커버리지 갭 |
| maintainability | LOW | regex 체이닝 가독성(저비용), /w/ prefix 기존 추적 |
| security | NONE | open-redirect 강화 정확·적절, 실질 공격표면 0 |
| performance | NONE | 정규식 2회 체이닝/O(n) find — 규모상 무시 가능 |
| scope | NONE | 11개 파일 전부 커밋 메시지 action item 과 1:1 대응, 스코프 이탈 없음 |
| side_effect | NONE | 신규 상태/API/네트워크 부작용 없음, 동작 동등성 확인 |
| dependency | NONE | 신규 패키지 없음, 내부 의존 순환 안전 |
| database | NONE | 해당 없음(FE-only) |
| concurrency | NONE | 신규 비동기/공유상태/락 없음 |
| api_contract | NONE | backend API 무변경 |
| documentation | — | **출력 파일 미산출 — 재시도 필요** |
| user_guide_sync | — | **출력 파일 미산출 — 재시도 필요** |

## 발견 없는 에이전트

- database, concurrency, api_contract, dependency — 모두 "해당 없음"/조치 불요로 명시적 결론

## 권장 조치사항

1. `rerun-modal.tsx` 의 재실행 성공 후 bare-path 네비게이션을 `buildWorkspaceHref` 사용으로 교정 — 이번 diff 가 갱신한 spec §10.2 문구와 실제 코드를 line-level 로 일치시킨다(Requirement WARNING #1).
2. `RESOLUTION.md` 의 fresh-review 재검증 서술을 실제 산출 현황(7/9, 갭 재발)에 맞게 정정한다(Requirement WARNING #2).
3. `documentation`/`user_guide_sync` reviewer 를 재시도하여 두 관점의 리뷰 커버리지를 완결한다 — 매니페스트 success 와 실제 파일 부재가 불일치하는 파이프라인 갭이 재발했으므로 별도 세션에서 확인 필요.
4. open-redirect 방어 로직(`buildWorkspaceHref`/`isSafeRedirectPath`)을 공용 유틸로 통합해 향후 `redirect` 파라미터 소비 로직 추가 시 우회 클래스가 반대편에서 재현되지 않도록 한다(Architecture WARNING #3).
5. `href.test.ts` 보안 회귀 테스트를 `it.each` 로 분리하고 CR/LF/slug 조합 케이스를 추가, `workspace-store.test.ts` 에 `setWorkspaces` 전용 테스트 블록을 추가한다(Testing WARNING #5, #6).
6. (저우선) `WorkspaceSummary` 타입 위치 이전 또는 `consistent-type-imports` lint 규칙 추가로 store↔resolve-fallback 순환 안전성을 도구로 강제한다(Architecture WARNING #4).

## 라우터 결정

- `routing=fallback-all` (router 미사용, 전체 reviewer 실행 — session `_retry_state.json` 의 `routing_status=pending` 과 일치):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — 문서/spec/코드 변경 조건에 따라 강제)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 전체 reviewer 실행됨 |