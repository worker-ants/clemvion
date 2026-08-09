# 신규 식별자 충돌 검토 — spec/5-system/

## 방법

target(`spec/5-system/` 17개 파일, ~11,300줄)과 번들에 함께 포함된 기존 참조 영역
(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/*`, `spec/conventions/*`,
총 ~25,500줄)을 대상으로 다음을 기계적으로 대조했다:

- 요구사항 ID 토큰(`[A-Z]{2,6}-[A-Z]{0,4}-?[0-9]{2,3}` 형, 예: `EIA-RL-06`/`CCH-SE-01`/`RR-PL-07`) —
  표-행·헤딩 정의 위치를 전수 추출해 동일 ID 가 서로 다른 내용으로 재정의되는지 확인
- API 엔드포인트(`| METHOD | /path | 설명 |` 표-행 138건) — method+정규화 path(`:id`→`:param`)로
  그룹핑해 target/reference 전역 중복 탐지
- 환경변수(`WEBAUTHN_*`, `MCP_*`, `EIA_*` 계열, `EXPRESSION_ENV_ALLOWLIST`, `S3_BUCKET` 등) —
  전역 grep 으로 재정의 여부 확인
- WS/webhook 이벤트명(`execution.*`, `document:graph_*` 등) — 정의처(§)와 참조처(매핑 표) 구분
- BullMQ 큐 이름(`execution-run`/`execution-continuation`/`background-execution`/
  `document-embedding`/`agent-memory-extraction`/`cafe24-token-refresh`/`makeshop-token-refresh`) —
  전역 유일성 확인
- 감사 액션(`user.*`/`auth_config.*`) — `conventions/audit-actions.md` 카탈로그와 대조
- 파일 경로 — `spec/5-system/` 내부 및 spec 전체 basename 중복 스캔

## 발견사항

- **[INFO]** graph-rag 그래프 엔드포인트가 두 문서에 나란히 정의됨(SoT 포인터 부재)
  - target 신규 식별자: 없음(신규 아님) — `spec/5-system/10-graph-rag.md §5.1~5.2` 의
    `POST /api/knowledge-bases/:id/documents/:docId/re-extract`,
    `POST /api/knowledge-bases/:id/re-extract`,
    `GET/DELETE /api/knowledge-bases/:id/entities[/​:entityId]`,
    `GET/DELETE /api/knowledge-bases/:id/relations[/​:relationId]`,
    `GET /api/knowledge-bases/:id/graph/stats`,
    `GET /api/knowledge-bases/:id/graph/visualization` (총 9개 endpoint)
  - 기존 사용처: `spec/2-navigation/5-knowledge-base.md §3 API` 표에 동일 method+path 가
    "(graph 모드)"/"(graph 모드, P1)"/"(graph 모드, P2)" 주석과 함께 재열거됨
  - 상세: 두 표의 설명은 의미상 일치(재추출/entity·relation CRUD/그래프 통계·시각화)하며 실제
    충돌은 없다. 다만 `spec/5-system/1-auth.md` 가 `/api/auth-configs/*`·`/api/workspaces/:id/invitations`
    등 인접 도메인 엔드포인트에 대해 "OO 문서 표가 단일 SoT" 라고 명시적으로 표기하는 동일
    패턴을, `10-graph-rag.md §5` 와 `5-knowledge-base.md §3` 사이에는 두지 않았다 — 두 표
    중 어느 쪽이 SoT 인지 문서상 선언이 없어 향후 한쪽만 수정되면(예: entity 삭제 CASCADE 범위
    변경) 조용히 드리프트될 위험이 있다.
  - 제안: `10-graph-rag.md §5` 또는 `5-knowledge-base.md §3` 중 하나에
    "그래프 엔드포인트의 단일 SoT 는 이 표다" 포인터 한 줄을 추가해, 이미 이 코드베이스가
    다른 곳(auth-configs, invitations)에서 쓰는 SoT-포인터 컨벤션과 일치시킬 것을 제안한다.
    (동작 변경 아님 — 순수 문서 참조 보강.)

그 외 5개 검토 관점에서는 충돌 후보를 찾지 못했다:

- **요구사항 ID**: `EIA-*`/`CCH-*`/`RR-*`/`WH-*`/`AGM-*`/`ND-AG-*`/`NF-OB-*` 등 도메인별
  prefix 가 서로 겹치지 않고, 동일 ID 가 두 곳에서 서로 다른 내용으로 정의된 사례 없음
  (테이블-행 정의 기준 전수 조사, 헤딩 정의도 함께 확인).
- **엔티티/타입명**: `WebAuthnCredential`/`InteractAckDto`/`FormValidationError`/
  `MessageTooLongError` 등 신규 타입은 각각 단일 정의처만 가짐. "ExecutionContext"(엔진
  in-memory)와 EIA 응답의 `context` 필드는 표현이 비슷하지만 문서가 이미 "in-memory
  ExecutionContext 는 park 시 소멸" 처럼 명시적으로 구분해 서술하고 있어 혼동 위험이 낮다.
- **환경변수/설정키**: `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/
  `WEBAUTHN_ALLOW_FALLBACK`, `MCP_ALLOW_INSECURE_URL`/`MCP_MAX_CONCURRENT_CONNECTIONS`/
  `MCP_CONNECT_TIMEOUT_MS`, `EXPRESSION_ENV_ALLOWLIST`, `AI_RETRY_STATE_TTL_MINUTES`,
  `EXECUTION_RUN_DLQ_*`/`CONTINUATION_DLQ_*`, `INTERACTION_JWT_SECRET`, `ALLOW_HTTP_HOOKS`,
  `S3_BUCKET` 모두 다른 의미로 재사용된 곳 없음. `WORKER_HEARTBEAT_TIMEOUT` 은 에러 코드명이
  실제 heartbeat 채널을 암시하나, `3-error-handling.md` 가 "그런 채널은 신설하지 않는다" 고
  스스로 명시적으로 각주 처리한 기존 결정(PR4 재정의)이라 새 충돌이 아니다.
- **이벤트/메시지명**: `execution.*` WS 이벤트 카탈로그는 `6-websocket-protocol.md`
  가 정의처이고, `14-external-interaction-api.md` 의 동일 이름 등장은 "매핑되는 WS 명령"
  표로 명시된 참조일 뿐 재정의가 아니다. BullMQ 큐 이름은 전부 고유하며
  `16-system-status-api.md` 는 "큐 목록의 단일 진실은 data-flow/0-overview.md §4" 라고
  스스로 SoT 를 명시한다.
- **파일 경로**: `spec/5-system/` 17개 파일명은 넘버링 컨벤션(`N-slug.md`)을 그대로 따르고
  spec 전체에서 basename 충돌은 `_product-overview.md`/`0-common.md`(도메인별 표준 진입
  문서, 의도된 반복)와 cafe24/makeshop API 카탈로그의 `store.md`/`product.md` 류(별도
  provider 카탈로그, 의도된 병렬 구조 — 기존 프로젝트 결정)뿐이다.
- 감사 액션 `user.email_changed`/`auth_config.*` 는 `spec/conventions/audit-actions.md` 의
  도메인별 분류 레지스트리(§3)와 정확히 일치.

## 요약

`spec/5-system/` 전체(17개 파일)를 요구사항 ID·엔드포인트·환경변수·이벤트명·큐명·감사
액션·파일 경로 7개 축으로 기존 참조 영역(overview/data-model/navigation/conventions)과
전수 대조했다. 이 spec 영역은 이미 다수의 cross-audit·spec-sync plan 을 거친 성숙한
코퍼스로, SoT 포인터 컨벤션(예: "OO 표가 단일 SoT")이 광범위하게 채택돼 있어 진짜 신규
식별자 충돌은 발견되지 않았다. 유일한 발견은 graph-rag 엔드포인트 그룹이 `10-graph-rag.md`
와 `2-navigation/5-knowledge-base.md` 양쪽에 내용 일치 상태로 병렬 정의돼 있으나 SoT 포인터가
없다는 문서 위생 이슈(INFO)이며, 동작·계약상 충돌은 아니다.

## 위험도

LOW
