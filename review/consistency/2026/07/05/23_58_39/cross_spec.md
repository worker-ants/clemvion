### 발견사항

- **[INFO]** `execution-engine §10.1` `logUsage` 타입 시그니처가 `api` 식별 필드를 누락 (stale 미러)
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §4.1 표 (5행 "Usage 로깅" — `logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?, api?})` 및 "`api` 식별 정보 동반 의무")
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §10.1 `IntegrationsService.logUsage(params: {...})` TS 시그니처 — `integrationId` / `nodeExecutionId` / `workflowId` / `status` / `durationMs` / `error?` 만 나열하고 `api?` 필드가 없음
  - 상세: target(0-common.md)과 실제 코드(`integration-handler-base.ts` `IntegrationUsageParams`)는 `api.{label,method,path}` 를 필수로 정의하지만, execution-engine 문서의 참조용 TS 시그니처는 이 필드가 도입되기 전 버전 그대로 남아있다. 직접 모순은 아니나(둘 다 "무엇이 필수인지" 를 규정하는 SoT 성격이 다름 — execution-engine 은 개요, 0-common 이 상세), 신규 독자가 execution-engine 만 보고 `api` 전달을 빠뜨릴 위험이 있다.
  - 제안: `spec/5-system/4-execution-engine.md` §10.1 코드 블록에 `api?: { label?, method?, path? }` 필드를 추가해 0-common.md §4.1 과 동기화 (target 자체 수정 범위 밖 — 별도 spec-sync 항목으로 등록 권장).

### 요약
target(`spec/4-nodes/4-integration/0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`)은 데이터 모델(`1-data-model.md` §2.10/§2.10.1 Integration·IntegrationUsageLog), API 계약(`2-navigation/4-integration.md` §9.3 activity API·§10.4 에러 매핑), 에러 코드 vocabulary(`5-system/3-error-handling.md`, `conventions/chat-channel-adapter.md` §3.1 `DB_*`/`HTTP_BLOCKED`/`ERROR_PORT_FALLBACK` 매핑), 실행 엔진 계약(`5-system/4-execution-engine.md` §10 Integration Handler 계약), 노드 출력 컨벤션(`conventions/node-output.md` Principle 3/7/9/11)과 대조했을 때 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 구조적 충돌이 발견되지 않았다. HTTP/DB/Email 3-node 의 SSRF 차단 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)·메시지 일반화 정책·`ALLOW_PRIVATE_HOST_TARGETS` 공유 플래그는 서로 대칭적으로 정합하며, 관련 문서 간 상호 참조(0-common ↔ 각 노드 문서 ↔ 2-navigation/4-integration.md ↔ 1-data-model.md ↔ chat-channel-adapter.md)도 최신 상태로 갱신되어 있다. 유일하게 발견된 것은 execution-engine §10.1 의 참조용 TS 시그니처가 이후 도입된 `api` 필드를 미러하지 못한 경미한 문서 드리프트(INFO)뿐이며, 이는 target 자체의 결함이 아니라 이전 변경(INT-US-05)에서 남은 잔재다.

### 위험도
NONE
