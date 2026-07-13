# Code Review 통합 보고서

## 전체 위험도
**LOW** — 병합을 막는 CRITICAL/WARNING 없음(성능 1건의 미해결 WARNING은 3라운드 전부터 알려진 비차단 사안). 단, **2개 reviewer(maintainability, user_guide_sync)가 `status=success`로 보고됐으나 output 파일이 디스크에 없어(Workflow disk-write gap) 이번 라운드 실제 결과를 확인하지 못함** — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 엣지 데이터 미리보기의 바이트 크기 계산(`JSON.stringify(value)` + `TextEncoder`)이 축약 전 원본 데이터 전체를 대상으로 하며 상한이 없음. 이번 라운드에 추가된 `SHOW_DELAY_MS=90` 진입 지연은 "여러 엣지를 스치는(sweep)" 시나리오는 막지만, "대용량 출력을 가진 엣지 하나에 정착해 hover"하는 경우의 동기 직렬화 비용(메인스레드 블로킹)은 근본적으로 남아 있음. 3라운드 연속 지적된 미해결 항목(security 리뷰어도 별도 관점에서 INFO로 동일 근본 원인 재확인) | `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview` | `full.length`(TextEncoder 생략)로 근사치화하거나, 일정 길이(예: 100KB) 초과 시 인코딩을 생략하고 `> N` 근사 표기로 전환. 축약 생성과 크기 측정을 한 순회로 합쳐 2회 순회 비용도 함께 절감 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 엣지 hover 미리보기가 노드 실행 결과(잠재적 민감 데이터: 토큰/PII 등)를 저마찰(hover, 200ms 유지)로 노출. 신규 인가 경계·권한 상승은 아니며 동일 인증 세션·워크스페이스 권한 범위 내 기존 Run Results 패널과 노출 범위 동일 | `edge-data-preview.tsx`(`useEdgeFlowData`, `EdgeDataPreviewTooltip`, `EdgeDataModal`), `execution-store.ts`(`findLatestResultByNodeId`) | 조치 불요. 향후 노드 출력 마스킹/redaction 정책 도입 시 이 hover 경로도 적용 대상에 포함 |
| 2 | security | 렌더링 경로 전 구간 React 텍스트 자식으로만 처리(`JSON.stringify` 후 `<pre>`), `dangerouslySetInnerHTML`/`eval` 등 인젝션 벡터 없음 — 확인 사항 | `edge-data-preview.tsx`, `presentation-renderers.tsx` `JsonContent` | 해당 없음 |
| 3 | security | 툴팁 위치가 뷰포트 경계로 clamp 되지 않아 화면 우측/하단 근처에서 잘릴 수 있음(UX, 보안 무관) | `workflow-canvas.tsx` `onEdgeMouseEnter`, `edge-data-preview.tsx` 툴팁 style | 참고용, 조치 불요 |
| 4 | performance/architecture | `findLatestResultByNodeId`(O(1) selector) 신설에도 기존 O(n) 역스캔 중복(`node-settings-panel.tsx` `InfoTab` 508-513행, `use-expression-context.ts`)은 미이관. 이번 라운드에서 실측 근거(1:1 이관 후보 vs 다른 패턴이라 드롭인 불가)와 함께 plan 비고에 명시적으로 defer 처리되고 follow-up(`task_edb57ca2`)으로 추적됨 — 스코프 절제로 인정, 병합 차단 아님 | `execution-store.ts` vs `node-settings-panel.tsx`, `use-expression-context.ts`; `plan/in-progress/spec-sync-edge-gaps.md` 비고 | `task_edb57ca2` follow-up이 실제로 `InfoTab`을 `findLatestResultByNodeId`로 교체하는지 추적 유지 |
| 5 | performance | `abbreviate()` 객체 분기가 슬라이스 전 `Object.entries(value)`로 전체 키를 eager 열거(배열 분기는 `slice`로 필요한 부분만 처리). 필드 수가 매우 큰 최상위 객체에서 불필요한 메모리 구성 | `lib/utils/edge-data-preview.ts` `abbreviate` | 우선순위 낮음. iterator 기반 순회로 20개에서 조기 종료 가능 |
| 6 | performance/architecture/scope | `edges` 배열 전체 prop-drilling → `EdgeDataPreviewTooltip`/`EdgeDataModal`가 각자 `edges.find()`로 O(E) 재탐색. hover 시점에 캔버스가 이미 `edge.source`를 쥐고 있음에도 `edgeId` 문자열만 전달. 대형 워크플로에서 hover 유지 중 실행 상태 변화 시 누적 재탐색 발생(경미) | `edge-data-preview.tsx` `useEdgeFlowData`, `workflow-canvas.tsx` | hover 시점에 `sourceNodeId`를 함께 커밋하거나 `useEdgeFlowData`가 `Edge` 객체를 직접 받도록 시그니처 변경 |
| 7 | architecture/scope | `canvas/` → `run-results/`(`output-shape.ts`, `presentation-renderers.tsx`) 신규 크로스 임포트. 두 기능 모듈이 "노드 산출값 정규화/렌더링"이라는 cross-cutting 개념을 공유함이 폴더 구조에 드러나지 않음(기능 결함 아님) | `edge-data-preview.tsx:6` | 조치 불요(당장). 세 번째 소비처 발생 시 중립 위치로 승격 검토 |
| 8 | architecture/scope | `workflow-canvas.tsx` 오케스트레이션 책임 누적(God-component) — 엣지 관련 훅 4개(`useEdgeHighlighting`/`useEdgeReconnect`/`useEdgeExecutionState`/`useEdgeHoverPreview`) + 컨텍스트 메뉴·노드 검색·단일 노드 실행 등 다수 책임 공존. plan 이 이미 추적 중, 신규 결함 아님 | `workflow-canvas.tsx` | plan의 "§4 오케스트레이션 정리" 후속에 이번 hover/modal 배선도 포함 |
| 9 | requirement | spec §5 ASCII 목업의 축약 표기가 따옴표 없는 `[3 items]`인데 실제 렌더 결과는 따옴표로 감싼 `"[3 items]"`(축약 결과가 문자열이라 `JSON.stringify` 시 따옴표 부여, 테스트로 의도 확인됨). 코드/목업 어느 쪽이 틀렸다 단정하기 애매해 SPEC-DRIFT로 단정하지 않음 | `spec/3-workflow-editor/2-edge.md` §5 목업 vs `lib/utils/edge-data-preview.ts` `abbreviate()` | 우선순위 낮음. (a) spec 목업을 실제 출력에 맞게 정정하거나 (b) `abbreviate()` 후처리로 따옴표 제거 — project-planner/developer 재량 |
| 10 | documentation | `findLatestResultByNodeId` JSDoc "…소비처가 공유"라는 문구가 실제로는 단일 소비처(`edge-data-preview.tsx`)뿐인 현재 상태보다 앞서 있음(경미한 과장). plan 비고에는 정직하게 defer 기록됨 | `execution-store.ts` `findLatestResultByNodeId` JSDoc | 굳이 고칠 필요 없음. 원하면 "현재 X; Y 이관은 별도 follow-up" 식으로 좁혀 서술 |
| 11 | testing | `EdgeDataModal` "정상 데이터 축약 없이 렌더" 테스트의 단언(`toContain("1")`)이 과도하게 느슨해 축약이 일어나도 우연히 통과할 여지 있음 | `__tests__/edge-data-preview.test.tsx` | 축약 마커(`"[N items]"`) 미포함을 명시적으로 단언하거나 전개된 전체 문자열 부분 비교로 변경 |
| 12 | testing | `status: "running"`/`"failed"` 등 비-`completed` 상태에서의 hover 시나리오 테스트 부재(`seedResult` 헬퍼가 항상 `completed` 하드코딩). 구현은 status 무관 동작이나 이 의도가 테스트로 고정되지 않음 | `__tests__/edge-data-preview.test.tsx`, `edge-data-preview.tsx` `useEdgeFlowData` | `running`(부분 output)/`failed`(output 없음) 케이스 1~2개 추가 |
| 13 | testing | 빈 컬렉션(`{}`/`[]`)의 `isEmpty` 판정(`false`로 취급 — 툴팁에 그대로 표시)이 테스트로 고정돼 있지 않음 | `lib/utils/edge-data-preview.ts` `summarizeDataForPreview` | 현재 동작을 회귀 가드로 고정하는 테스트 추가 |
| 14 | testing/architecture | `workflow-canvas.tsx`의 hover→미리보기 배선(이벤트 좌표 전달, 모달 오픈 시 `dismiss()` 선행 순서 등) 통합 테스트 사각지대 — 훅/컴포넌트는 격리 단위 테스트로 커버되나 캔버스 전체 RTL 하네스 부재. plan이 이미 추적 중, 신규 결함 아님 | `workflow-canvas.tsx` | plan의 캔버스 통합 테스트 하네스 후속 작업에 포함 |
| 15 | scope | 이전 ai-review 라운드 산출물(`review/code/.../15_52_56`, `16_20_51`)이 신규 파일로 대량 포함 — 프로젝트 컨벤션상 review/fix 강제 사이클의 정상 산출물이며 범위 이탈 아님(반복 확인) | `review/code/2026/07/13/{15_52_56,16_20_51}/*` | 조치 불요 |

## 재확인된 정상 동작 (결함 아님, 참고)

- **security**: 하드코딩 시크릿 없음, SQL/커맨드/경로 인젝션 벡터 없음, 인증/인가 경계 변경 없음, 알려진 취약점 있는 신규 의존성 없음.
- **concurrency**: `setTimeout` 기반 hover 상태기계가 "단일 활성 타이머" 불변식 유지(진입 시 항상 `clearTimer()` 선행), 언마운트 cleanup 확보. `findLatestResultByNodeId`의 stale-index 재확인은 실제 앱 경로가 아닌 테스트 seeding 전용 방어(정상 경로는 `addNodeResult`의 단일 `set()` 호출로 항상 원자적). `onOpenModal`의 이중 상태 갱신도 단일 이벤트 핸들러 내 동기 처리로 불일치 프레임 없음.
- **side_effect**: 1라운드가 지적한 "unmount 시 pending hide-timer 미정리"가 `useEffect` cleanup 추가로 해소 확인(회귀 테스트 포함). 전역 변수 신설·네트워크 호출·환경변수 접근 없음. 테스트의 Zustand 전역 store `setState` 직접 시딩도 `beforeEach` 리셋으로 격리 확인.
- **requirement**: CRITICAL(i18n 하드코딩) 해소, `findLatestResultByNodeId` 문서-구현 일치, 관련 테스트 92 passed/1 skipped, `tsc --noEmit` 클린, null/undefined 구분 정확, 모달 무손실 렌더, 실행별 데이터 격리 확인.
- **documentation**: 2라운드에 걸쳐 지적된 i18n 하드코딩·`findNodeResult` 오서술·spec §5 클릭 문구 모호성·JSDoc 오타가 모두 해소. CHANGELOG 테스트 개수 서술이 실측과 정확히 일치(13/6/8/4).
- **testing**: 직전 라운드 testing WARNING 4건(EdgeDataModal 무테스트, mouseEnter/leave 배선 미검증, `findLatestResultByNodeId` 무테스트, 경계값 미검증)이 모두 실제 테스트로 해소.
- **scope**: 이번 라운드 실질 diff는 직전 리뷰가 지적한 테스트 커버리지 갭만 좁게 메운 추가로 국한, 요청 외 기능 확장/무관 파일 수정 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | hover 노출 마찰 저하(INFO) 외 실질 결함 없음 |
| performance | LOW | 바이트 크기 계산 무상한 직렬화(WARNING, 3라운드 미해결) + 경미 INFO 다수 |
| architecture | LOW | 기존 dedup 미이관·cross-import·God-component 누적 등 이월 INFO만, 신규 결함 없음 |
| requirement | LOW | spec 목업 따옴표 불일치(INFO) 외 §4/§5 요구사항 완전 충족 확인 |
| scope | NONE | 요청 범위 정확히 일치, 스코프 이탈 없음 |
| side_effect | NONE | 1라운드 타이머 미정리 결함 해소 확인, 신규 부작용 없음 |
| documentation | NONE | 2라운드 문서 결함 전부 해소, JSDoc 경미 과장(INFO)만 잔존 |
| testing | LOW | 이전 라운드 갭 4건 해소 확인, 신규 경계 케이스 INFO 다수(비차단) |
| concurrency | NONE | 타이머/스토어 원자성 모두 양호, 실질 결함 없음 |
| maintainability | **재시도 필요** | output 파일 없음(disk-write gap) — 이번 라운드 결과 미확인 |
| user_guide_sync | **재시도 필요** | output 파일 없음(disk-write gap) — 이번 라운드 결과 미확인 |

## 발견 없는 에이전트

security, scope, side_effect, documentation, concurrency (모두 위험도 NONE — INFO 수준 참고 사항만 존재, 실질 결함 없음).

## 권장 조치사항

1. **최우선**: `maintainability`, `user_guide_sync` reviewer를 재실행하여 실제 output을 확보할 것 — `status=success`로 보고됐으나 output 파일이 디스크에 없는 Workflow disk-write gap이 발생했다. 다른 reviewer들이 교차 확인한 범위(예: `JsonContent` 재사용, i18n, spec-doc 정합성)로 미루어 봤을 때 새로운 CRITICAL 가능성은 낮아 보이나, 확정 전까지 이 요약의 위험도는 잠정적이다.
2. (선택, 비차단) `summarizeDataForPreview`의 바이트 크기 계산에 길이 상한(또는 `TextEncoder` 생략)을 적용해 대용량 노드 출력 hover 시 메인스레드 블로킹을 방지 — 3라운드 연속 지적된 유일한 WARNING.
3. (선택, 비차단) `task_edb57ca2` follow-up으로 추적 중인 `node-settings-panel.tsx` `InfoTab` → `findLatestResultByNodeId` 이관이 실제로 진행되는지 확인.
4. (선택, 비차단) testing 리뷰가 지적한 `toContain("1")` 느슨한 단언, `running`/`failed` 상태 hover 테스트, 빈 컬렉션 `isEmpty` 테스트를 후속 커밋에서 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` (8명 — 소스 코드/spec/문서 변경에 대한 router_safety 강제 규칙 적용)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음(diff는 기존 `@xyflow/react`, 내부 모듈 재사용뿐) |
  | database | 라우터 판단 — DB 스키마/마이그레이션/쿼리 변경 없음(순수 프런트엔드 diff) |
  | api_contract | 라우터 판단 — API 엔드포인트/DTO/wire 프로토콜 변경 없음 |