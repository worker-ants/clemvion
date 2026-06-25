# Code Review 통합 보고서

## 전체 위험도
**LOW** — Playwright strict-mode 충돌 수정(getByText → getByRole("button")) 은 올바른 방향이며, 요구사항 준수·RBAC·스니펫 검증 모두 적합. 유일한 개선 포인트는 생성 플로우 테스트에서 dialog dismiss 검증 누락(WARNING 1건).

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 생성 플로우 테스트에서 dialog dismiss 후 상태 검증 누락. 만들기 버튼 클릭 후 dialog 가 열린 채로 목록 버튼이 노출될 수 있는 엣지 케이스(서버 응답이 왔지만 UI 닫힘 처리가 누락된 버그)를 놓칠 수 있다. | `console.spec.ts` 생성 플로우 테스트 | `await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: DIALOG_TIMEOUT });` 을 신규 봇 버튼 assertion 앞에 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `getByText` → `getByRole("button", { name: /…/ })` 3곳 수정이 2-column 레이아웃에서의 strict-mode 충돌을 정확히 해소하며, 인라인 주석으로 이유 설명이 충분함. | `console.spec.ts` 수정 3곳 | 현행 유지 |
| 2 | Testing | `getByText("Plain webhook")` 은 필터링된 요소(DOM 미존재)라 strict-mode 충돌 없음. `toHaveCount(0)` 사용도 적합. | `console.spec.ts` | 현행 유지 |
| 3 | Testing | 단위 테스트(`web-chat-page.test.tsx`)에서 `findAllByText` 패턴으로 2중 렌더를 이미 허용해 e2e 수정과 대칭적으로 일관됨. | `web-chat-page.test.tsx` | 현행 유지 |
| 4 | Testing | `mockConsole` POST 핸들러가 `[...initial]` shallow copy 로 테스트 간 공유 상태 오염을 막고 있어 격리 올바름. | `console.spec.ts` | 현행 유지 |
| 5 | Testing | 라이브 미리보기 iframe 은 위젯+EIA 풀스택 의존으로 의도적으로 e2e 범위 밖으로 제외(파일 상단 주석 명시). | `console.spec.ts` | 현행 유지 |
| 6 | Testing | `toBeVisible` 에 `PAGE_READY_TIMEOUT` 이 수정된 세 assertion 모두에 일관되게 적용됨. | 수정된 세 assertion | 현행 유지 |
| 7 | Requirement | `getByRole("button", { name: /…/ })` 매처가 `page.tsx` 의 사이드바 `<button>` DOM 구조와 정확히 일치. 수정 방향이 옳다. | 수정 3곳 | 현행 유지 |
| 8 | Requirement | `getByText("Plain webhook").toHaveCount(0)` 유지 — PLAIN_WEBHOOK 은 interaction 필터 대상이라 h2 영역 노출 경로 없음. strict-mode 충돌 없음. | console.spec.ts | 현행 유지 |
| 9 | Requirement | 생성 후 자동 선택(`onCreated(id)` → `setSelectedId`) 경로를 e2e 가 올바르게 결과 기반으로 검증. | console.spec.ts | 현행 유지 |
| 10 | Requirement | [SPEC-DRIFT] 2-column 레이아웃 e2e 검증 미비 — spec §6/§R7 이 "xl+ 에서 2-column" 을 명시하나 e2e 테스트에 레이아웃 자체 검증 없음. 코드·주석은 spec 과 일치하므로 spec drift 없음. | spec/7-channel-web-chat/5-admin-console.md §6, §R7 | spec 에 e2e 검증 대상 명시 여부 검토(선택적) |
| 11 | Requirement | viewer 역할 테스트가 spec §7 RBAC(목록 조회 가능, 생성 버튼 미노출)를 정확히 검증. | console.spec.ts | 현행 유지 |
| 12 | Requirement | 설치 스니펫 검증이 spec §5 요구사항(`endpointPath` + `ClemvionChat('boot'`)을 모두 커버. | console.spec.ts | 현행 유지 |
| 13 | Requirement | `mockConsole` POST 응답의 `body.name` → GET 재조회 경로를 stateful mock 이 올바르게 지원. | console.spec.ts | 현행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 요구사항 전 항목 준수. spec §2/§3/§5/§7 커버 적합. |
| testing | LOW | dialog dismiss 검증 누락 WARNING 1건. 핵심 경로는 검증됨. |
| security | NONE | 결함 없음 |
| scope | NONE | 결함 없음 |
| side_effect | NONE | 결함 없음 |
| maintainability | NONE | 결함 없음 |

## 라우터 결정

- routing_status=done (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명, 전원 router_safety 강제 포함)
  - **제외**: 8명 (performance, architecture, documentation, dependency, database, concurrency, api_contract, user_guide_sync — 테스트 셀렉터 변경이라 해당 관점 무관)

## 비고

reviewers 최종 상태: 6명 전원 success, unfinished 0건. critical=0, warning=1.
