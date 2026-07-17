# Code Review 통합 보고서

리뷰 대상: 커밋 `34008deb5` (fix(navigation): 사용자 가이드(/docs) 진입 시 `/w/<slug>` 무한 중첩 라우팅 fix) + `89c4b1f6b` (무관 plan 의 Gate C `spec_impact` 보정).

## 전체 위험도
**LOW** — Critical 0건. 8개 reviewer 전원이 LOW 또는 NONE 위험도로 판정. 핵심 라우팅 버그(사이드바 무조건 slug 부착 + catch-all 재부착)는 `workspaceScoped` 데이터 플래그와 catch-all terminal(dashboard forward / `notFound()`) 이원화로 구조적으로 해소되었으며, unit 17건 + e2e 5건으로 엣지케이스가 폭넓게 검증됨. 남은 발견사항은 spec 문서 후속 갱신, 테스트 assertion 정밀도, 사소한 유지보수성 개선 위주.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] catch-all 의 `/w/` 접두 terminal(404) 계약("흡수만 한다"에서 "흡수 ∪ terminal(404)"로 확장)이 아직 spec 본문에 반영되지 않음. 코드는 옳고(무한 중첩 회귀 제거를 위한 의도된 확장, `11-error-empty-states.md §1.3` 과도 정합) spec 이 뒤처진 케이스 — 이미 `plan/in-progress/spec-update-catch-all-terminal-contract.md` 에 project-planner 위임용 patch 문안까지 준비돼 있음 | `codebase/frontend/src/app/(main)/[...rest]/page.tsx` vs `spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155` | 코드는 유지. `project-planner` 가 draft 제안 1·2 를 spec 본문에 반영하고 `_layout.md` frontmatter `code:` 글로브에 `(main)/[...rest]/page.tsx` 포함 여부 확인 |
| 2 | Scope | 이번 라우팅 fix 와 무관한 파일(`plan/complete/ai-agent-tool-payload-budget-followups.md`)의 frontmatter(`status: complete`, `spec_impact`) 수정이 같은 브랜치/커밋(`89c4b1f6b`)에 포함됨. 컨벤션상 허용된 ISSUE FIX 예외이고 커밋 메시지에도 "본 PR 과 무관" 명시돼 있어 차단 사유는 아니나 diff 스캔 시 혼동 소지 | `plan/complete/ai-agent-tool-payload-budget-followups.md` (커밋 `89c4b1f6b`) | 가능하면 별도 소규모 PR 로 분리 권장(필수는 아님, 이미 원자적 커밋으로 분리·커밋 메시지에 명시됨) |
| 3 | Maintainability | catch-all 세그먼트 판별에 쓰이는 리터럴 `"w"`/`rest.length===2` 가 `page.tsx`·`href.ts`·다수 테스트 mock 배열에 상수화 없이 산재. 라우트 세그먼트명·중첩 depth 규칙 변경 시 여러 파일을 개별 갱신해야 해 누락 여지 | `codebase/frontend/src/app/(main)/[...rest]/page.tsx:41-45`, `src/lib/workspace/href.ts` | `WORKSPACE_ROUTE_SEGMENT = "w"` 같은 공유 상수를 `lib/workspace/` 하위에 두고 각 파일이 import (선택, 후속) |
| 4 | Testing/Maintainability | 신규 `sidebar-nav-href.test.tsx` 가 기존 `sidebar.test.tsx` 와 거의 동일한 mock 보일러플레이트(~100줄, `matchMedia`/`next/navigation`/`next/link`/각 store/`apiClient` 등)를 중복 보유. `Sidebar` 의존성 변경 시 두 파일 동시 갱신 필요 | `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx` (177줄 중 대부분) | 공용 `sidebar-test-utils.ts`(mock 팩토리 + `renderSidebar`)로 추출해 두 파일이 공유하도록 리팩터링(후속 작업으로 처리 가능, 이번 PR 차단 아님) |
| 5 | Testing | e2e `"stale /w/<slug>/docs URL terminates on 404 instead of nesting forever"` 테스트가 실제 not-found UI 렌더는 검증하지 않고 URL 세그먼트 개수만 확인함. `notFound()` 가 아닌 다른 이유로 URL 이 고정돼도 통과하는 약한 회귀 가드 | `codebase/frontend/e2e/workspaces/slug-routing.spec.ts:93-106` | `(main)/not-found.tsx` 가 렌더하는 대표 텍스트/role 에 대한 `toBeVisible()` 어써션 추가 |
| 6 | Documentation | 사용자 보고 버그를 고치는 fix 임에도 `CHANGELOG.md` 에 대응 "Unreleased" 절이 없음. 같은 기능 영역(슬러그 라우팅) phase 1·2 및 직전 커밋들은 모두 CHANGELOG 절을 가짐 | `CHANGELOG.md` (본 diff 미변경) | 커밋 메시지 본문(원인·수정·검증)을 재사용해 `## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한 중첩 fix` 절 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Requirement/Side-Effect | `/w/<slug>` 단독 경로는 URL 의 slug 값을 멤버십 검증 없이 그대로 신뢰해 `router.replace` 로 forward(store `loaded` 대기 없음). 의도된 설계이며 실제 접근 제어는 diff 밖의 `(main)/w/[slug]` layout(`WorkspaceSlugGate`)에 위임하는 기존 구조를 그대로 따름 | `codebase/frontend/src/app/(main)/[...rest]/page.tsx:38-64` | 코드 수정 불요. 하위 게이트가 무효 slug 를 실제로 처리하는지 회귀 테스트로 계속 확인 |
| 2 | Side Effect | `WorkspaceRedirect` 컴포넌트의 계약이 "항상 redirect" 에서 "redirect 또는 render-phase `notFound()` throw" 로 확장됨. 단일 소비처·`(main)/not-found.tsx` 바운더리 존재·문서화로 뒷받침되어 현재는 안전 | `page.tsx:87` | 조치 불요. spec 보강 시(WARNING #1) 이 계약 확장도 함께 반영 |
| 3 | Maintainability | `workspace-redirect.test.tsx` 한 파일 안에서 기존 블록(영어 `it` 타이틀)과 신규 블록(한국어 `it` 타이틀)의 언어 컨벤션이 혼재 | `workspace-redirect.test.tsx:19-166` | 팀 컨벤션에 맞춰 통일(선택, 시급성 낮음) |
| 4 | Maintainability | `WorkspaceRedirect` 의 라우팅 결정 로직이 render 본문(`notFound()` 판정)과 `useEffect`(실제 forward) 로 나뉘어 전체 상태 기계 파악에 두 지점을 오가야 함(Next.js 제약상 분리 자체는 불가피) | `page.tsx:38-89` | (선택) `resolveCatchAllRoute(rest, ...)` 순수 함수로 분기 추출해 훅과 무관하게 단위 테스트 가능하게 개선 |
| 5 | Maintainability/Documentation | `sidebar.tsx` `isActive` 의 `pathname.startsWith(href) || pathname.startsWith(item.href)` 조건이 `workspaceScoped:false` 항목(`/docs`, `href===item.href`)에서 사실상 no-op. 기능 결함 아님 | `sidebar.tsx:509-511` | (선택) `workspaceScoped` 값에 따라 조건을 명시적으로 분기하거나 주석 한 줄 보강 |
| 6 | Testing | `sidebar-nav-href.test.tsx` 가 `workspaceScoped:true` 12개 항목 중 3개만 개별 스팟체크(전체 커버는 별도 blanket 정규식 테스트가 보완하므로 핵심 회귀는 포괄됨) | `sidebar-nav-href.test.tsx` | (선택) blanket 검증을 "모든 scoped 항목이 `/w/<slug>` 로 시작"까지 확장 |
| 7 | Testing | `renderSidebar()` 헬퍼가 react-query 비동기 정착을 명시적으로 기다리지 않음(기존 `sidebar.test.tsx` 패턴 답습, 신규 결함 아님, 현재 실패로 이어지지 않음) | `sidebar-nav-href.test.tsx` | (선택) 필요 시 `waitFor` 보강 |
| 8 | Requirement/User-Guide-Sync | spec 보강 draft(`spec-update-catch-all-terminal-contract.md`) 는 patch 문안까지 준비돼 있으나, `user-guide-routing-loop-fix.md` 체크리스트 항목 10("project-planner 위임")이 아직 미체크 상태 | `plan/in-progress/user-guide-routing-loop-fix.md` | plan 을 `complete` 로 이동하기 전 project-planner 위임 완료 확인(WARNING #1 과 연동) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `/w/<slug>` 단독 forward 시 URL slug 미검증(하위 계층 의존, INFO). open-redirect 방어(`toSafeInternalPath`) 등 기존 보안 경계 변경 없음 확인 |
| requirement | LOW | [SPEC-DRIFT] catch-all terminal 404 계약 spec 미반영(WARNING). 그 외 기능 완전성·엣지케이스·spec fidelity 전반 정합 확인 |
| scope | LOW | 무관 plan 파일 frontmatter 수정 포함(WARNING). 핵심 diff 는 명시된 2단 근본원인에 정확히 대응, 그 외 이탈 없음 |
| side_effect | LOW | `WorkspaceRedirect` 계약이 redirect-only → redirect/notFound throw 로 확장(INFO, 문서화·테스트로 뒷받침). 전역/네트워크/공개 시그니처 변경 없음 |
| maintainability | LOW | 라우트 세그먼트 리터럴 미상수화(WARNING), 테스트 mock 중복(WARNING), 테스트 타이틀 언어 혼재 등 후속 정리 대상 다수(INFO) |
| testing | LOW | e2e stale-URL 테스트 assertion 정밀도 부족(WARNING), mock 보일러플레이트 중복(WARNING). 엣지케이스 커버리지(단독 `/w`, 이중중첩, prefix 오탐, query/hash 보존)는 양호 |
| documentation | LOW | CHANGELOG Unreleased 절 누락(WARNING). 그 외 JSDoc/주석·spec 인용 정확도는 매우 우수, stale 독스트링도 같은 PR 에서 정정 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 중 매칭 0건(순수 FE 라우팅 fix, 신규 UI 문자열·노드·통합·auth 흐름 없음). spec 위임 미완료(항목 10)는 INFO 로만 기록 |

## 발견 없는 에이전트

- **user_guide_sync** — doc-sync-matrix 21개 trigger 전수 대조 결과 매칭 0건("해당 없음" 판정), 위험도 NONE.

## 권장 조치사항

1. `project-planner` 에게 `spec-update-catch-all-terminal-contract.md` draft 위임을 완료해 `_layout.md`/`9-user-profile.md` spec 본문에 catch-all terminal(404) 계약을 반영한다 ([SPEC-DRIFT], 경고 #1).
2. `CHANGELOG.md` 에 "Unreleased" 절을 추가한다(커밋 메시지 재사용 가능, 경고 #6).
3. e2e `"stale ... terminates on 404"` 테스트에 실제 not-found UI 렌더 assertion(`toBeVisible()` 등)을 추가해 회귀 가드 정밀도를 높인다 (경고 #5).
4. (선택, 후속) `plan/complete/ai-agent-tool-payload-budget-followups.md` frontmatter 수정을 별도 PR 로 분리하거나 최소한 현재처럼 커밋 메시지에 무관 사유를 계속 명시한다 (경고 #2).
5. (선택, 후속) 라우트 세그먼트 리터럴(`"w"`, `rest.length===2`)을 공유 상수로 승격한다 (경고 #3).
6. (선택, 후속) `sidebar-nav-href.test.tsx` 와 `sidebar.test.tsx` 의 mock 보일러플레이트를 공유 유틸로 추출한다 (경고 #4).
7. `user-guide-routing-loop-fix.md` 체크리스트 항목 10(spec 위임)을 완료한 뒤에만 plan 을 `complete` 로 이동한다 (참고 #8, 경고 #1 과 연동).

## 라우터 결정

`routing_status=pending` — router(`review-router`) 를 호출하지 않고 생략함. 사유: 알려진 Workflow router 매핑 버그(`reviewers:[]`/"no applicable reviewer" 로 종결되는 회귀) 회피를 위해 main 이 router 호출 자체를 건너뛰고 fallback Agent fan-out 으로 reviewer 를 직접 선별·실행함.

- **실행** (8명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (이상 7명 = `agents_forced`, 소스/문서 코드 변경 시 상시 강제) + `user_guide_sync` (변경이 사용자 가이드 사이드바 링크 라우팅과 직결되어 추가 선정)
- **제외** (6명): 아래 표
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (`agents_forced`, 7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 순수 frontend 라우팅 링크 수정 — 성능 영향 경로(쿼리·연산량·렌더 비용) 변경 없음 |
| architecture | 기존 catch-all 라우트/사이드바 컴포넌트 내부 로직 수정 — 아키텍처 경계·모듈 구조 변경 없음 |
| dependency | 패키지 의존성 변경 없음 |
| database | DB 스키마·쿼리 관련 변경 없음 |
| concurrency | 동시성·race condition 관련 코드 변경 없음(클라이언트 사이드 단일 렌더 흐름) |
| api_contract | API 엔드포인트·계약 변경 없음(순수 FE 라우팅) |
