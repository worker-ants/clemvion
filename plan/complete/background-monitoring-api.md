---
worktree: bg-monitoring-api-7c2a91
started: 2026-05-15
owner: developer
---

# Background 노드 모니터링 API

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 진행 결정: URL 중첩 구조, WebSocket 별도 채널, AI Assistant 적용, 페이로드 cursor 페이지네이션 선적용 (2026-05-15)

## 배경

PRD 3 §4.11 Background 노드 본체 (ND-BG-01~05) 는 ✅ 구현 완료. 다만 spec `4-nodes/1-logic/12-background.md` §하단 노트에 다음이 명시:

> 본문 실행 상태를 메인 후속 노드에서 관측하려면 `meta.backgroundRunId` (§5.1) 을 키로 모니터링 API 를 별도 호출해야 한다 (모니터링 API 자체는 미구현).

즉 Background 핸들러는 `meta.backgroundRunId` 를 발급하지만, 그 키로 본문 실행 상태(노드별 진행, 성공/실패, 시작/종료 시각, 알림 송출 결과) 를 조회하는 API 는 없다.

## 관련 문서

- `prd/3-node-system.md` §4.11 ND-BG-01~05
- `spec/4-nodes/1-logic/12-background.md` §5.1 (`meta.backgroundRunId`), §하단 모니터링 API 미구현 노트
- `spec/5-system/4-execution-engine.md` §3.3 Background 실행 (PRD/Spec 정합화는 `prd-spec-sync.md` 에서 별도 처리)
- 코드: `backend/src/modules/execution-engine/` 의 `executeBackgroundSubgraph` / `scheduleBackgroundBody` / BullMQ `background-execution` 큐, NodeExecution 의 `parentNodeExecutionId` 그룹핑

## 작업 단위

### 1. API 설계 — ✅

- [x] **엔드포인트** — `GET /api/v1/executions/:executionId/background-runs/:backgroundRunId` 중첩 구조 확정 (Rationale: spec §8 Rationale)
- [x] **응답 스키마** — `{ backgroundRunId, executionId, parentNodeExecutionId, status, startedAt, completedAt, durationMs, nodeExecutions: { data[], nextCursor, hasMore }, notifications[] }`. NodeExecution shape 재사용
- [x] **권한** — workspace 멤버 단독 검증 (ExecutionsController 단건 조회 동일 패턴). spec §8.4 정정
- [x] **WebSocket 이벤트** — 별도 채널 `background:run:<id>` 신설 (run-level 이벤트 2종). body NodeExecution 이벤트는 기존 `execution:<id>` 채널 유지 + parentNodeExecutionId 필터 (spec §8.5)

### 2. 백엔드 구현 (TDD) — ✅

- [x] `backend/src/modules/executions/background-runs/` 에 `BackgroundRunsController` + `BackgroundRunsService` 추가
- [x] V047 부분 expression 인덱스 + `parentNodeExecutionId` 로 본문 노드 조회, Notification join (resourceType='background_run')
- [x] Swagger 문서화 (`ApiOkWrappedResponse` + 표준 응답)
- [x] 단위 테스트 — 진행중/완료/실패/권한거부/cursor 페이지네이션/legacy fallback (16 + 8 + 2 = 26건)
- [x] `BackgroundExecutionJob.backgroundRunId` plumbing + WS 채널 `background:run:<id>` 신설 (run-level 이벤트 2종)
- [x] AI Assistant 도구 노출 정책 → 적용 (spec §8.6, 도구 매핑 정의)

### 3. 프론트엔드 통합 — ✅

- [x] Run Results 드로어의 Background 노드 상세에 본문 실행 결과 섹션 추가 (`BackgroundRunSection`)
- [x] WebSocket `background:run:<id>` 채널 구독 + polling fallback (5s) — `useBackgroundRun` hook
- [x] `useBackgroundRun` 단위 테스트 — 5건 (legacy/완료/running+hasMore/error/notifications)
- [x] Execution 상세 페이지는 동일 컴포넌트를 재사용 (result-detail.tsx 통합)

### 4. spec 갱신

- [x] `spec/4-nodes/1-logic/12-background.md` §5.1·§5.2 미구현 노트 제거, §8 모니터링 API 신설 (URL·응답·페이지네이션·권한·WebSocket·AI Assistant·에러 코드 + Rationale)
- [x] `spec/5-system/4-execution-engine.md` §3.3 Run Results Drawer / 모니터링 API 링크 명시
- [x] `spec/3-workflow-editor/3-execution.md` §10.15 "Background 본문 실행 결과" 신설

### 5. 매뉴얼 — ✅

- [x] `frontend/src/content/docs/02-nodes/logic.mdx` + `logic.en.mdx` — Background 노드 안내 페이지에 모니터링 API / Run Results 본문 섹션 사용법 추가

### 6. REVIEW — ✅

- [x] `ai-review` 실행 (16 reviewers: 13 orchestrator + 3 focus). Critical 1건 (raw SQL 컬럼명 오류) + WS execution snapshot IDOR 차단 + 멱등성/sanitize 보강 처리. `review/code/2026/05/15/15_30_00/SUMMARY.md` + `review/2026-05-15_15-29-14/SUMMARY.md` 보관. 백 90건 / 프론트 1315건 테스트 pass

## 수용 기준

- 새 모니터링 API 가 인증/인가 검증과 함께 동작
- Run Results 드로어 + Execution 상세에서 Background 본문 실행 결과를 시각적으로 확인 가능
- spec 의 "모니터링 API 자체는 미구현" 노트 제거
- 단위/통합 테스트가 권한·정상·실패·진행중 케이스 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 의 Background spec 정합화가 끝난 다음 진행하면 표기 충돌 없음
- **리스크**:
  - 본문이 매우 길어진 경우 응답 페이로드 크기 → 페이지네이션 / streaming 결정 필요
  - WebSocket 채널 확장 시 기존 `execution:<id>` 구독자에게 의도치 않은 이벤트 전파 가능
