# Background 노드 모니터링 API

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

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

### 1. API 설계

- [ ] **엔드포인트** — `GET /api/v1/executions/:executionId/background-runs/:backgroundRunId` (또는 동등) 결정. `executionId` 는 메인 실행 ID, `backgroundRunId` 는 `meta.backgroundRunId` 가 가리키는 ID
- [ ] **응답 스키마** — `{ status, startedAt, completedAt?, nodeExecutions: NodeExecution[], notifications: Notification[] }`. `NodeExecution` 은 기존 execution-history 와 동일 shape 재사용
- [ ] **권한** — 본 실행을 시작한 사용자 + 워크스페이스 멤버 (Editor+) 만 조회 가능. RBAC 가드 적용
- [ ] **WebSocket 이벤트** — Background 본문이 진행 중일 때 실시간 갱신을 받고 싶다면 별도 채널(`background:run:<id>`) 또는 기존 `execution:<id>` 채널 확장 결정

### 2. 백엔드 구현 (TDD)

- [ ] `backend/src/modules/executions/` 에 `BackgroundRunsController` + `BackgroundRunsService` 추가
- [ ] NodeExecution 의 `parentNodeExecutionId` 인덱스로 본문 노드들 조회 + Notification 엔티티에서 background_failed 등 관련 알림 join
- [ ] Swagger 문서화 (프로젝트 `swagger-pattern.md` 메모 참조)
- [ ] 단위 테스트 + 통합 테스트 (실패 본문 / 진행 중 본문 / 완료 본문 / 권한 거부 케이스)
- [ ] `ED-AI-35~38` AI Assistant 의 read-only 도구가 background run 도 조회할 수 있는지 결정 (PRD 2 §10.9 "직계 자식 실행 (sub-workflow 1 level)" 정책의 background 적용 여부)

### 3. 프론트엔드 통합

- [ ] Run Results 드로어의 Background 노드 상세 — 본문 실행 결과 섹션 추가 (현재 Background 노드는 메인 흐름의 노드와 동일 카드만 표시)
- [ ] Execution 상세 페이지에서 Background 본문 실행을 별도 섹션으로 표시 (`spec/5-system/4-execution-engine.md` §3.3 마지막 줄 — "Execution 상세 화면에서 Background 실행 결과를 별도 섹션으로 표시")
- [ ] 단위 테스트 + storybook (옵션)

### 4. spec 갱신

- [ ] `spec/4-nodes/1-logic/12-background.md` §하단 모니터링 API 미구현 노트 → ✅ 갱신, API 시그니처 링크
- [ ] `spec/2-navigation/14-execution-history.md` 또는 `spec/3-workflow-editor/3-execution.md` 에 Background 본문 표시 섹션 추가

### 5. 매뉴얼

- [ ] `frontend/src/content/docs/02-nodes/logic.mdx` 등 Background 노드 안내 페이지에 모니터링 API / Run Results 본문 섹션 사용법 추가

### 6. REVIEW

- [ ] `ai-review` 실행 → API Contract / Side Effect / Security 중심 (권한 거부 회귀 잠금 필수)

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
