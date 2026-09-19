# 신규 식별자 충돌 검토 — `plan/in-progress/connection-test-codes-and-gaps.md` (scope: `spec/2-navigation/`)

## 컨텍스트 메모

이번 impl-prep 스코프(`spec/2-navigation/`)로 번들된 target 문서 자체(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 등, `4-integration.md`는 예산 초과로 절단)는 **새 식별자를 도입하지 않는다** — 실제 변경 주체는 `plan/in-progress/connection-test-codes-and-gaps.md`(developer, `spec_impact: none`)이고, 이 plan 이 새로 만들려는 식별자(`connection-test-codes.ts`, `ConnectionTestResultCode`)가 `spec/2-navigation/4-integration.md`(연결 테스트 UI·API 를 규정하는 spec, 예산 초과로 프롬프트엔 없어 직접 `Read`)가 이미 문서화한 코드 vocabulary·기존 코드베이스의 인접 타입들과 충돌하는지가 실질 검토 대상이다.

## 발견사항

- **[WARNING]** `ConnectionTestResultCode` 가 기존 "Test-Connection" 계열 이름 4개와 한 단어장에서 순서만 바뀐 채 공존한다
  - target 신규 식별자: `ConnectionTestResultCode` (신설 예정 파일 `codebase/backend/src/modules/integrations/connection-test-codes.ts`, plan §"할 것" 1번)
  - 기존 사용처:
    - `codebase/backend/src/modules/integrations/integrations.service.ts:76` — `export interface IntegrationTestResult { … code?: string … }` (연결 테스트 결과의 **정본** 인터페이스, DB·HTTP·Email·MCP·Cafe24·MakeShop 여섯 producer 가 전부 이 shape 로 수렴)
    - `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts:19` — `export interface TestConnectionResult { … }` (MCP 전용 내부 result shape)
    - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:463` — `export class TestConnectionResultDto { … code?: string … }` (`POST /api/integrations/:id/test` 의 Swagger 응답 DTO, `IntegrationTestResult` 의 거울)
    - `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:49` — `export class ModelTestConnectionResultDto { … }` (LLM 모델 연결 테스트, 같은 패턴의 자매 DTO — 자신의 주석에서 "형제 `TestConnectionResultDto`" 로 서로를 지칭)
  - 상세: "Integration/Connection" + "Test" + "Result" + "Code/Dto" 네 낱말을 조합한 이름이 이미 넷(`IntegrationTestResult`, `TestConnectionResult`, `TestConnectionResultDto`, `ModelTestConnectionResultDto`) 존재하는 좁은 네이밍 공간에, **순서를 다시 바꾼(Connection-Test, Result-Code) 다섯 번째 이름**을 신설한다. 특히 `ConnectionTestResultCode` 와 `TestConnectionResult`/`TestConnectionResultDto` 는 "Connection"·"Test"·"Result" 세 낱말의 순서만 다르고 나머지 접미사(`Code` vs 없음/`Dto`)만 다르다 — grep·자동완성·리뷰 스킴 중 눈으로 구분하기 어렵다. 게다가 새 타입이 실제로 typing 하는 대상은 `TestConnectionResult`(MCP) 가 아니라 `IntegrationTestResult.code` 쪽이다(plan 은 DB/HTTP/Email 코드 ∪ `McpFailureCode` ∪ Cafe24·MakeShop ping 코드를 합쳐 이 필드의 타입으로 쓰려 한다) — 그런데 이름은 "Integration" 이 아니라 "Connection" 을 골라, 정작 자신이 타이핑하는 필드의 소유 인터페이스(`IntegrationTestResult`)와도 접두어가 갈린다. `database-connection-tester.ts`/`http-connection-tester.ts` 는 이미 `IntegrationTestResult` 를 import 하고 있으므로, 같은 파일에 `ConnectionTestResultCode` 까지 import 되면 "Integration…" 과 "Connection…" 두 접두어가 나란히 등장한다.
  - 제안: 새 타입명을 그 필드의 실제 소유 인터페이스에 맞춰 `IntegrationTestResultCode` (또는 최소한 `IntegrationTestResult['code']` 를 명시적으로 참조하는 이름)로 바꿔, `TestConnectionResult(Dto)`/`ModelTestConnectionResultDto` 클러스터와 낱말 순서만 다른 다섯 번째 이름을 늘리지 않는다. 파일명 `connection-test-codes.ts` 자체는 형제 파일(`database-connection-tester.ts`, `http-connection-tester.ts`, `integration-connection-test.e2e-spec.ts`)과 명명 관례가 맞아 유지 가능 — 충돌은 파일명이 아니라 **export 되는 타입명**에 있다.

- **[INFO]** 연결 테스트 코드가 노드 런타임 `ErrorCode` 와 공유/근접하는 관계는 이미 spec 이 문서화한 의도된 설계 — 재-flag 불필요
  - target 신규 식별자: plan 이 상수화하려는 `DB_HOST_BLOCKED`·`HTTP_BLOCKED`·`EMAIL_HOST_BLOCKED`(호스트 차단 3종, 노드와 **동일 문자열·동일 의미**) 및 `DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`(연결 테스트 전용, 이름이 가까운 노드 코드와 **모집합이 다름**)
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` const (`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`DB_CONNECTION_ERROR`·`HTTP_TRANSPORT_FAILED` 등, 노드 `output.error.code` namespace) + `spec/2-navigation/4-integration.md:1100-1122`(§14.1 에러 코드 vocabulary 표) + 같은 파일 `## Rationale` §"코드 이름"(1165-1168행, 2026-09-19)이 이 정확한 겹침/근접을 이미 항목별로 설명한다.
  - 상세: plan 저자 스스로 "노드 런타임 `ErrorCode`(`DB_CONNECTION_ERROR` · `HTTP_TRANSPORT_FAILED` — 이름이 가깝다)와의 혼동을 컴파일 에러로 만드는 것" 이라고 목적을 적어, 이 근접성을 인지하고 있다. spec 은 어느 코드가 **동일 의미로 공유**되는지(호스트 차단 3종)와 어느 코드가 **이름만 가깝고 의미가 다른지**(나머지 5종)를 표+Rationale 로 이미 못 박아 뒀다 — 새로 도입되는 충돌이 아니라 기존 설계를 타입으로 강제하는 작업이다.
  - 제안: 조치 불필요(참고용). 다만 `connection-test-codes.ts` 작성 시 이 두 그룹("노드와 의미 공유" vs "이름만 근접, 의미 상이")을 주석으로 갈라 두면 — spec Rationale 을 코드 쪽 SoT 에도 미러링해 — 다음 사람이 "왜 `DB_HOST_BLOCKED` 는 겹치는데 `DB_AUTH_FAILED` 는 안 겹치는가" 를 다시 조사하지 않아도 된다(선택적 권고, WARNING 아님).

- **[INFO]** Cafe24/MakeShop 의 `CAFE24_AUTH_FAILED`·`CAFE24_TRANSPORT_FAILED`·`MAKESHOP_AUTH_FAILED`·`MAKESHOP_TRANSPORT_FAILED` 도 노드 코드와 동일 문자열 — 근거 있는 재사용, 충돌 아님
  - target 신규 식별자: plan 이 union 에 포함하려는 위 4개 코드(Cafe24/MakeShop entity tester `pingConnection` 반환값)
  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md:362-396`, `spec/4-nodes/4-integration/5-makeshop.md:181-184`(노드 `output.error.code` 로 동일 이름 사용) + `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:744-747`(주석: "`executeWithRateLimit`(노드/MCP 실행 경로) 와 `pingConnection`(연결 테스트 경로) 가 같은 refresh+1회 retry 정책을 공유")
  - 상세: 코드를 직접 확인한 결과 `mapPingError`(같은 파일 174-201행)가 실제로 노드 실행과 동일한 에러 클래스(`Cafe24AuthFailedError`/`Cafe24TransportFailedError`)를 재사용해 `code` 를 채운다 — 이름만 같은 게 아니라 **판정 로직 자체가 공유**된다. DB/HTTP 축(모집합이 다름)과 달리 Cafe24/MakeShop 축은 노드-연결테스트 간 의미가 완전히 동일하도록 **의도적으로 설계**돼 있다.
  - 제안: 조치 불필요. `ConnectionTestResultCode` union 에 이 그룹을 넣을 때, 위 INFO 항목과 마찬가지로 "노드와 완전히 동일 의미(Cafe24/MakeShop/호스트차단 3종)" vs "이름만 근접(DB/HTTP 5종)" 두 그룹을 주석으로 구분해두면 세 갈래 설계가 한 파일에 뭉쳐도 다음 사람이 원인을 재추적하지 않는다.

## 요약

이번 스코프(`spec/2-navigation/`)의 target 문서 자체는 새 식별자를 도입하지 않으며, 실제 변경 주체인 `connection-test-codes-and-gaps.md` plan 이 새로 만들 상수·타입은 `spec/2-navigation/4-integration.md`(직접 Read, 프롬프트엔 예산 초과로 미포함)와 `codebase/backend/src/nodes/core/error-codes.ts`·Cafe24/MakeShop 코드를 대조한 결과 **의미 충돌은 없다** — 노드 런타임 코드와의 근접/공유 관계는 이미 spec Rationale 이 항목별로 설명한 의도된 설계다. 다만 plan 이 제안한 새 타입명 `ConnectionTestResultCode` 는 이미 존재하는 `IntegrationTestResult`·`TestConnectionResult`·`TestConnectionResultDto`·`ModelTestConnectionResultDto` 네 이름과 낱말 순서만 다른 다섯 번째 이름이라 혼동 가능성이 있어 WARNING 하나로 보고한다(리네이밍 권고, 차단 사유 아님).

## 위험도

LOW
