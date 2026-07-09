# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 4건(오픈 리다이렉트 잔여 우회 클래스, DRY 부분 정리 잔존, CHANGELOG 미반영, dangling anchor)은 모두 즉시 위험이 낮은 개선 사항이며, 나머지는 INFO(대부분 양호 확인) 수준. 단, `requirement`·`testing` 두 reviewer 는 매니페스트상 `success` 로 보고됐으나 산출 파일이 디스크에 존재하지 않아 **본 요약에서 내용을 반영하지 못했다** (아래 "재시도 필요" 및 권장 조치 참조).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `buildWorkspaceHref` 의 open-redirect 방어가 선두 `/` 연속만 정규화하고, WHATWG URL 파서가 특수 스킴에서 `/` 와 동일 취급하는 backslash(`\`)·ASCII tab/CR/LF 는 걷어내지 않아 우회 클래스가 잔존. 현재 저장소 내 모든 실호출부는 truthy slug + 리터럴/신뢰 path 조합이라 라이브 경로로 직접 트리거되지는 않음(확인됨) | `codebase/frontend/src/lib/workspace/href.ts:17` | `path.replace(/^[/\\]+/, "")` 로 `/`·`\` 를 함께 제거하고 tab/CR/LF 스트립 추가, 또는 `new URL(path, "http://internal.invalid/").pathname` 방식으로 path 전용 강제 해석 검토. backslash·tab 변형 테스트 케이스 추가 |
| 2 | architecture | 이전 라운드 WARNING(폴백 로직 중복)이 `resolveFallbackWorkspace()` 추출로 `layout.tsx`/`[...rest]/page.tsx` 2곳은 정리됐으나, 동일 정책("현재 id 존재하면 유지, 없으면 첫 항목")의 세 번째 인라인 구현이 `workspace-store.ts` `setWorkspaces` 에 남아 있음. 신규 헬퍼 JSDoc 은 "단일 진실 공급원"이라 주장하나 실제로는 2/3 지점만 커버 — 정책이 바뀌면 이 3번째 지점에서 이번에 막으려던 것과 동일한 drift 재발 가능 | `codebase/frontend/src/lib/stores/workspace-store.ts` `setWorkspaces` (약 40-45행) | `setWorkspaces` 도 `resolveFallbackWorkspace(list, current)?.id ?? null` 로 위임하거나, 불가하다면 JSDoc 을 "2/3 호출부만 커버, `setWorkspaces` 는 별도 구현"으로 스코프 축소 |
| 3 | documentation | 워크스페이스 슬러그 URL 라우팅(대형 FE 재구조화, 4개 커밋에 걸침)이 `CHANGELOG.md` 에 전혀 등재되지 않음 — 이 저장소는 훨씬 작은 수정도 항목화하는 관행이 있음 | `CHANGELOG.md`(루트) | spec-sync 커밋 또는 후속 커밋에서 "Unreleased — 워크스페이스 슬러그 URL 라우팅" 항목 추가(URL-우선 reconcile, UX-only redirect, catch-all 흡수, 백엔드 인가 불변 등 핵심 계약 요약) |
| 4 | documentation | 같은 커밋에서 신규 생성된 `RESOLUTION.md` 가 존재하지 않는 "§재검증" 절을 2곳에서 참조하는 dangling anchor(작성 시점부터 누락, 이후 추가/삭제 이력 없음) | `review/code/2026/07/08/18_24_41/RESOLUTION.md:22`, `:30` | 실제 재검증이 이뤄진 리뷰 세션(예: 현재 `review/code/2026/07/09/07_56_16/`) 경로로 교체하거나 해당 섹션을 실제로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `useWorkspaceSlug` 의 store-fallback 은 first-workspace 로 떨어지지 않는 의도적으로 다른 정책(4번째 변형) — 버그 아님이나 유사 명명이 4곳에 흩어져 향후 혼동 가능 | `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:19-22` | 우선순위 낮음. WARNING #2 정리 시 JSDoc 에 "first-workspace 폴백 없음(의도적)" 한 줄 명시 |
| 2 | maintainability | `resolveFallbackWorkspace` 네이밍이 두 소비처(폴백 vs 활성워크스페이스 조회) 의미를 완전히 포괄하지 못함 — JSDoc 이 보완하여 오독 위험은 낮음 | `codebase/frontend/src/lib/workspace/resolve-fallback.ts` | 3번째 소비처 생기면 `resolveActiveOrFirstWorkspace` 같은 중립적 이름 고려 |
| 3 | maintainability | `buildWorkspaceHref` 의 `String(path)` 캐스팅이 `path: string` 시그니처상 no-op — 불필요한 인지 부하 | `codebase/frontend/src/lib/workspace/href.ts:953` | `path.replace(/^\/+/, "")` 로 단순화하거나 방어 근거를 주석으로 명시 |
| 4 | maintainability | cafe24/makeshop pending-polling 미러 테스트 파일 간 신규 케이스 삽입 순서가 서로 다름(기능적 결함 아님) | `use-cafe24-pending-polling.test.tsx` vs `use-makeshop-pending-polling.test.tsx` | 우선순위 낮음. 다음 동반 수정 시 순서 정렬 |
| 5 | maintainability | `use-workspaces.test.tsx` 의 mock 선언 스타일이 인접 신규 테스트의 `vi.hoisted()` 패턴과 다름(동작엔 문제 없음) | `codebase/frontend/src/lib/workspace/__tests__/use-workspaces.test.tsx:5-15` | 우선순위 낮음. 여유 시 `vi.hoisted` 로 통일 |
| 6 | documentation | `buildWorkspaceHref` 최상단 JSDoc 이 이번에 추가된 open-redirect 방어를 언급하지 않음(구현부 인라인 주석에만 있음) | `codebase/frontend/src/lib/workspace/href.ts:1-9` | 최상단 JSDoc 에 "protocol-relative(`//`) 입력은 same-origin 절대경로로 정규화됨" 한 줄 추가 |
| 7 | side_effect | 신규/보강 테스트 2건이 mock 이 아닌 실제 zustand 싱글턴 store 를 직접 reset/setState — 각 파일 `beforeEach` 리셋으로 실질 교차오염 위험은 낮음 | `use-cafe24-pending-polling.test.tsx:73-75,423-430`, `use-makeshop-pending-polling.test.tsx:85-87,559-566` | 낮은 우선순위. `afterEach` 에도 `reset()` 추가하면 안전판 강화 |
| 8 | 양호(다수) | `resolveFallbackWorkspace` 추출(순수함수, 동일 반환값), `buildWorkspaceHref` 단일 경계 위치, 순환의존성 없음, 4개 조치 항목이 diff 와 1:1 대응(scope 위반 없음), 시크릿/인젝션/인가우회 없음, 유저가이드/CHANGELOG trigger 매칭 없음(user_guide_sync) 등 다수 항목이 문제없음으로 확인됨 | 각 reviewer 본문 참조 | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | open-redirect 방어 잔여 우회 클래스(WARNING, 라이브 경로 미도달 확인) |
| architecture | LOW | 폴백 로직 DRY 정리가 2/3 지점만 커버(WARNING), 4번째 변형은 의도적(INFO) |
| requirement | **재시도 필요** | 산출 파일 부재로 확인 불가 |
| scope | NONE | 선언된 4개 조치 항목이 diff 와 정확히 1:1 대응, 스코프 이탈 없음 |
| side_effect | LOW | `buildWorkspaceHref` 동작 변경 전체 호출부(~50곳) 회귀 없음 확인, 실 store 직접 조작 테스트는 저위험 |
| maintainability | LOW | 네이밍/캐스팅/테스트 스타일 관련 경미한 INFO 4건, 신규 이슈 없음 |
| testing | **재시도 필요** | 산출 파일 부재로 확인 불가 |
| documentation | LOW | CHANGELOG 미반영(WARNING), RESOLUTION.md dangling anchor(WARNING) |
| user_guide_sync | NONE | 매트릭스 19개 행 전체 미매칭, 갱신 의무 없음 |

## 발견 없는 에이전트

- scope — 문제 없음(위반 없음), 참고용 INFO만 기록
- user_guide_sync — 매칭 trigger 없음, 갱신 불요

## 권장 조치사항

1. **[운영 이상 — 우선 확인]** `requirement`·`testing` reviewer 가 매니페스트상 `success` 로 보고됐으나 실제 output 파일(`requirement.md`, `testing.md`)이 세션 디렉터리에 존재하지 않는다(`_prompts/` 입력 파일만 확인됨). Write 가 harness 에 의해 차단되었을 가능성이 있음 — 두 reviewer 를 재실행하거나 원인을 확인해 결과를 확보할 것.
2. security WARNING(#1): `buildWorkspaceHref` 의 open-redirect 정규화를 backslash·제어문자까지 포괄하도록 강화(현재 라이브 경로 미도달이지만 "보안 경계"로 문서화된 함수이므로 완전성 확보 권장).
3. architecture WARNING(#2): `workspace-store.ts` `setWorkspaces` 의 세 번째 폴백 구현을 `resolveFallbackWorkspace()` 로 위임하거나 JSDoc 의 커버리지 주장을 정정.
4. documentation WARNING(#3, #4): CHANGELOG.md 에 슬러그 라우팅 기능 항목 추가, `RESOLUTION.md` dangling anchor("§재검증") 교정.
5. 낮은 우선순위 INFO(네이밍/캐스팅/테스트 스타일/JSDoc 보강)는 다음 관련 작업 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 소스 코드 변경 시 상시 적용 규칙 및 문서 파일 변경(`review/code/2026/07/08/18_24_41/*.md` 동봉 커밋) trigger 로 강제 포함
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(순수 FE 라우팅 리팩터·테스트 추가)에 성능 영향 대상 없음(세부 판단 로그는 prompt manifest 에 미포함) |
  | dependency | 신규 의존성 변경 없음(라우터 판단) |
  | database | DB 관련 파일 변경 없음(라우터 판단) |
  | concurrency | 동시성 관련 로직 변경 없음(라우터 판단) |
  | api_contract | API 계약(backend) 변경 없음, FE-only 라우팅 변경(라우터 판단) |