# Cross-Spec 일관성 검토 — spec/data-flow/8-notifications.md (impl-done)

## 검토 개요

- 검토 모드: `--impl-done` (diff-base `origin/main`, HEAD 워킹트리 = 구현 반영본)
- target 문서: `spec/data-flow/8-notifications.md`
- 변경 핵심: `background_failed` 알림의 딥링크(`resource_type/resource_id=workflow`)와
  per-run attribution(`background_run_id` 컬럼, migration V107)을 분리. 종전에는
  `resource_type='background_run'` / `resource_id=backgroundRunId` (또는 옛 `execution`/`executionId`
  fallback) 를 함께 써서 팝오버 딥링크가 404 나던 선존 결함을 해소.

target 문서와 아래 관련 spec 영역을 교차 확인했다:

- `spec/1-data-model.md` §2.19 (Notification 엔티티)
- `spec/2-navigation/_layout.md` §3.1 (알림 팝오버 딥링크 계약)
- `spec/4-nodes/1-logic/12-background.md` (Background 노드, 본문 모니터링 API `notifications` 필드)
- `spec/5-system/6-websocket-protocol.md` §4.4 (`notification.new` WS emit payload)
- `spec/data-flow/3-execution.md` (`execution_failed`/`background_failed` cross-reference, 격리 원칙)
- `spec/2-navigation/4-integration.md` §11.2 (다른 알림 type 의 attribution 방식, 참고용)
- `codebase/backend/migrations/` (V107 신규, V047 과의 네이밍 유사성 각주)
- 실제 구현 코드 (`notifications.service.ts`, `notification.entity.ts`, `notification-response.dto.ts`,
  `background-execution.processor.ts`, `background-runs.service.ts`, `websocket.service.ts`) — 위 절대경로
  워킹트리 기준으로 직접 Read/Grep 확인.

## 발견사항

교차 영역 모순은 발견되지 않았다. 확인된 정합 지점은 다음과 같다:

- **데이터 모델 정합** — `spec/1-data-model.md` §2.19 는 이미 `background_run_id` 필드를 반영해 target
  문서(§2.1)와 동일한 문구("딥링크와 분리", "REST 미노출 `select:false`")로 기술되어 있다. 엔티티 코드
  (`notification.entity.ts`) 의 `@Column({ name: 'background_run_id', ..., select: false })` 도 동일.
- **API 계약(딥링크) 정합** — `spec/2-navigation/_layout.md` §3.1 의 deep-link 매핑 표는 이미
  `execution_failed`·`background_failed`·`schedule_failed` 3종을 모두 `/workflows/<resource_id>`
  (resource_id = workflow id) 로 규정하고 있어 target 문서의 주장과 완전히 일치한다. 옛
  `background_run`/`execution` resource_type 표기는 어디에도 잔존하지 않는다(target 의 Rationale 에서만
  "과거 결함" 으로 역사적 언급).
- **REST 비노출 정합** — `notification-response.dto.ts` 에는 `backgroundRunId` 필드가 없고,
  `notifications.service.ts` 의 `emitNew()` 도 WS emit payload 에 `id/type/title/message/resourceType/
  resourceId` 만 화이트리스트로 싣는다 — `spec/5-system/6-websocket-protocol.md` §4.4 의
  `notification.new` payload 정의(`{ id, type, title, message, resourceType, resourceId }`, backgroundRunId
  없음)와 정확히 일치한다.
- **Background 노드 spec 정합** — `spec/4-nodes/1-logic/12-background.md` 의 본문 모니터링 API
  `notifications` 필드 설명이 이미 "연관 판정은 `background_run_id` 컬럼(V107)" 으로 갱신되어 있어
  target 문서 §2.1/Rationale 과 상호 참조가 일관된다.
- **격리 원칙 정합** — 신규 e2e(`execution-failed-notification.e2e-spec.ts`)가 인용하는
  "top-level 실행만 `execution_failed` 발사, Background 본문 실패는 `background_failed` 만" 원칙은
  `spec/data-flow/3-execution.md` (격리 서술) 및 target 문서 §1.1 `execution_failed`/`background_failed`
  행의 `!parentExecutionId` 게이트 서술과 상호 모순 없다.
- **마이그레이션 파일 규약** — V107 은 `.conf` 파일을 동봉하지 않는데, `codebase/backend/migrations/README.md`
  §4 규약상 `.conf` 는 `CREATE INDEX CONCURRENTLY` 등 비-트랜잭션 모드가 필요한 마이그레이션에만
  필요하다. V107 은 자체 주석대로 신규 nullable 컬럼(대상 row 0건)이라 파샬 인덱스 생성이 메타데이터
  lock 만으로 즉시 끝나 트랜잭션 내 처리가 가능 — `.conf` 미동봉이 규약 위반이 아니다(실측: 107개
  마이그레이션 중 34개만 `.conf` 보유, 나머지는 기본 트랜잭션 모드).
- **명명 유사성 각주** — V107 주석과 target 문서 Rationale 모두 컬럼명 `background_run_id` 가 V047 의
  `node_execution` 부분 인덱스명(`idx_node_execution_background_run_id`, `meta.backgroundRunId` 경로)과
  표기가 유사하나 별개 테이블/목적임을 명시적으로 각주 처리해, 향후 검토자의 오인 가능성을 낮췄다.

CRITICAL/WARNING 등급의 항목은 없다.

## 요약

이번 변경은 `background_failed` 알림의 딥링크(workflow 단위)와 per-run attribution(backgroundRun 단위)을
컬럼 분리로 해소한 좁은 범위의 스키마 보강이며, `spec/1-data-model.md`, `spec/2-navigation/_layout.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/6-websocket-protocol.md`, `spec/data-flow/3-execution.md`
등 관련 영역이 모두 사전에 동기화되어 있어 데이터 모델·API 계약(딥링크 라우팅)·상태 전이·REST 노출 범위 어디에서도
교차 영역 모순이 발견되지 않았다. 신규 컬럼이 REST/WS 어느 표면에도 노출되지 않는다는 target 의 주장도 실제
DTO·WS emit 코드로 확인했다. 마이그레이션 파일 구성(`.conf` 부재)도 기존 컨벤션에 부합한다.

## 위험도

NONE
