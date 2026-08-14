# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md

## 발견사항

- **[CRITICAL]** §6.2 `execution.waiting_for_input` webhook 페이로드 예시가 같은 문서의 "채널별 봉투" normative 규칙 및 실제 구현과 어긋남
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 "페이로드 — `execution.waiting_for_input`" (jsonc 예시 블록, `### 6.2` 하단)
  - 위반 규약: 본 문서 자신의 §6 도입부 "채널별 봉투 — 셋이 서로 다르다 (normative)" 절 — webhook 채널의 wire 는 `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: { …SSE 와 같은 flat 객체 } }` 형태여야 한다고 명시(§6 는 스스로 "여기가 SoT, §6.1~§6.6 은 이 규칙을 따른다"고 선언).
  - 상세: §6.2 의 예시 JSON 은 `node`/`interaction`/`context` 를 `payload` 로 감싸지 않고 최상위(`type`/`executionId`/`triggerId`/`workflowId`/`node`/`interaction`/`context`/`timestamp`/`seq`)에 flat 하게 나열한다. 바로 다음 §6.3(`execution.completed`)·§6.4(`execution.failed`) 예시는 `"payload": { "status": ... }` 로 정확히 `payload` 래퍼를 사용하고 "webhook 봉투 기준. SSE 는 payload 래퍼 없이 안쪽 객체가 그대로 온다" 주석까지 붙여 규칙을 따른다 — 즉 같은 §6 안에서 이벤트별로 봉투 구조가 다르게 문서화되어 있다. 실제 구현도 `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` 의 `enqueue({ eventBody: { type, executionId, triggerId, workflowId, seq, payload: event.payload, timestamp } })` 에서 **모든** outbound 이벤트(waiting_for_input 포함)를 `payload` 로 감싸 발송한다(`notification-webhook.processor.ts` 가 그 `eventBody` 를 그대로 `JSON.stringify` 해 전송). 즉 §6.2 예시는 정식 규약(§6 도입부)과도, 실제 wire 와도 어긋난다 — 이 예시를 그대로 구현/파싱하는 외부 통합자는 실패한다.
  - 제안: §6.2 JSON 블록을 §6.3/§6.4 와 동일 구조로 재작성한다 — 바깥 봉투 `{ type, executionId, triggerId, workflowId, seq, timestamp }` + `payload: { node, interaction, context }`. §6.3 의 "webhook 봉투 기준. SSE 는 payload 래퍼 없이…" 주석도 동일하게 부착해 §6 도입부 규칙과의 정합을 드러낸다. (SSE 필드명 매핑 blockquote 는 그대로 유지 가능 — 그건 별개의 필드명 치환 규칙이다.)

- **[WARNING]** §6.2 `interaction.{submitUrl,streamUrl,statusUrl,cancelUrl}` 예시가 버전 세그먼트(`/v1/`)를 URL 경로에 포함하고, 문서 나머지 부분과 다른 가상 도메인을 사용
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2, `interaction.submitUrl`/`streamUrl`/`statusUrl`/`cancelUrl` 4줄
  - 위반 규약: `spec/5-system/2-api-convention.md` §1 "기본 원칙" 표 — "버전 | URL 경로에 포함하지 않음 (Accept 헤더 또는 단일 버전 운영)"
  - 상세: 예시 URL 이 `https://api.clemvion.ai/v1/executions/{id}/interact` (streamUrl/statusUrl/cancelUrl 동형)로 적혀 있다. 그러나 같은 문서 §4.1(Webhook 호출 응답 확장)의 `interaction.endpoints` 객체와 §5 전역이 일관되게 정의하는 실제 엔드포인트는 `/api/external/executions/{id}/interact` (버전 세그먼트 없음, `external` 세그먼트 포함, 상대경로)다. `api.clemvion.ai` 도메인과 `/v1/` prefix 는 `spec/**` 전체에서 이 4줄에만 등장하며(grep 결과 0건 추가 발견), 다른 어떤 spec 문서도 별도 공개 게이트웨이 도메인/버저닝 정책을 정의하지 않는다. 즉 stale 한 초안 잔재로 보이며, api-convention.md 의 명시적 "URL 버저닝 금지" 규칙과 직접 충돌한다.
  - 제안: §4.1 의 `endpoints` 객체와 동일한 상대경로(`/api/external/executions/{id}/...`)로 정정하거나, 실제로 별도 공개 게이트웨이 도메인이 존재한다면 그 사실을 §1(개요)이나 §Rationale 에 명시하고 api-convention.md §1 에 예외 조항을 추가한다.

- **[INFO]** "Conversation Thread §4.4.6" 인용이 실제로는 WebSocket 프로토콜 문서의 절을 가리킴 (오귀속 인용)
  - target 위치: `spec/5-system/14-external-interaction-api.md` 라인 472, 673 (두 곳 모두 동일 문구: `[Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md)`)
  - 위반 규약: 직접적 정식 규약 위반은 아니나 "문서 구조 규약"(정확한 SoT 인용) 관점의 인접 이슈
  - 상세: `spec/conventions/conversation-thread.md` 에는 `## 4. 영속화` 아래 하위 절 번호가 없다(§4.1~4.6 부재). 실제 `#### 4.4.6 \`messages[].source\` 마커` 는 `spec/5-system/6-websocket-protocol.md` 소속 헤딩이다. 링크 target 은 `conversation-thread.md` 만 가리키고 있어 그 문서 안에는 대응 앵커가 없다 — jsonc 주석 안 문자열이라 `spec-link-integrity` 빌드 가드(코드펜스는 markdown AST 링크로 파싱되지 않음)는 통과하지만, 사람이 읽을 때는 소유 문서가 잘못 표시된다.
  - 제안: `[WS §4.4.6](../5-system/6-websocket-protocol.md#446-messagessource-마커) / [Conversation Thread §5.1](../conventions/conversation-thread.md#51-messages-모드-매핑)` 로 두 SoT 를 분리 표기.

## 확인했으나 문제 없음 (positive findings — 재작업 방지용 기록)

- frontmatter (`id`/`status: partial`/`pending_plans`/`code:`) 는 `spec/conventions/spec-impl-evidence.md` §2·§3 스키마를 정확히 준수 — `pending_plans` 경로(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 실존, `code:` glob 8개 모두 실 파일/디렉토리에 매치.
- §8.4 Rate Limit 의 Redis 키(`eia:rl:interact:<executionId>` 등)는 `spec/conventions/redis-keys.md` §3 인벤토리와 정확히 일치.
- §Rationale R8 "캐시 키 스코프"의 `interaction:idempotency:<executionId>:<route>:<key>` 도 redis-keys.md 인벤토리와 일치.
- §7.1 의 `secretRef: "secret://triggers/{triggerId}/notification-signing"` 은 `spec/conventions/secret-store.md` §1 URI scheme(kebab-case name)을 정확히 따름.
- 트리거 시크릿/토큰 회전 액션명(`notification_secret_rotated`/`chat_channel_bot_token_rotated`/`interaction_token_revoked`)은 `spec/conventions/audit-actions.md` §3 레지스트리와 일치(과거분사, resource dot-prefix).
- 응답 DTO 배치(`dto/responses/*-response.dto.ts`, `InteractAckDto`/`ExecutionStatusDto`/`RefreshTokenResponseDto`)와 커스텀 Bearer scheme(`interaction-token`) 사용은 `spec/conventions/swagger.md` §5-1·§2-1 을 정확히 따르며, 표준 패턴에서 벗어나는 지점(§10.1)은 근거와 함께 명시적으로 문서화되어 있음.
- URL 명명(`/api/external/executions/:executionId/...`, `/api/triggers/:id/notification/rotate-secret` 등)은 `spec/5-system/2-api-convention.md` §2.2 의 복수형·kebab-case·RPC-style sub-channel 예외 규칙과 일치(후자는 api-convention.md 자체에 동일 예시로 등재되어 있어 이미 동기화됨).
- `null` vs 키 생략 표현(§5.3 `currentNode`/`result`/`error` = null, `context.conversationThread` = 키 생략)은 api-convention.md §5.4 규칙과 일치하며, 그 문서가 EIA 를 실사례로 직접 인용함.
- 문서 구조(frontmatter → `## Overview (제품 정의)` → 본문 §1~§12 → `## Rationale`)는 CLAUDE.md/SKILL.md 가 권장하는 3섹션 구성을 준수.

## 요약

`spec/5-system/14-external-interaction-api.md` 는 최근 다수의 docs(spec) PR 로 이미 상당히 정제되어 있어 명명 규약·frontmatter·Redis 키·secret-store URI·audit action·swagger DTO 패턴 등 대부분의 정식 규약 항목은 이미 정확히 SoT 와 정합한다. 다만 §6 "API 명세 — Outbound Notification" 내부에서 **동일 섹션이 스스로 선언한 "채널별 봉투(normative)" 규칙을 §6.2 (`waiting_for_input`) 예시만 따르지 않고**(§6.3/§6.4 는 따름), 실제 구현(`notification-fanout.service.ts`)과도 어긋나는 CRITICAL 결함이 하나 있다 — 이는 §6 도입부가 최근 "네 문서가 각자 필드를 나열하던" 문제를 해소하며 신설된 규칙인데, 그 리팩터가 종결 이벤트(§6.3~§6.5)에만 적용되고 waiting_for_input(§6.2)은 소급 갱신에서 누락된 것으로 보인다. 부수적으로 같은 예시 블록의 URL 이 `/v1/` 버전 세그먼트 + 존재하지 않는 도메인을 써 api-convention.md §1 을 위반하는 WARNING 도 함께 있다. 이번 --impl-prep 검토의 실제 착수 대상(§6 종결 이벤트의 `error`/`durationMs`/`result.outputs` 구현)과는 직접 겹치지 않으나, 같은 §6 절 안의 인접 결함이므로 함께 정정할 가치가 있다.

## 위험도

MEDIUM
