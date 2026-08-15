# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 방법
- `spec/conventions/**` 전수 목록 확보 후, target 문서(`spec/5-system/14-external-interaction-api.md`, 전문 번들됨)가 실제로 참조·의존하는 규약 문서를 식별해 교차 검증:
  `swagger.md`, `error-codes.md`, `redis-keys.md`, `secret-store.md`, `audit-actions.md`, `interaction-type-registry.md`, `node-output.md`, `migrations.md`.
- `2-api-convention.md`(spec 본문, conventions 는 아니나 target 이 응답 포맷 근거로 직접 인용)도 대조군으로 함께 확인.
- 의심 지점은 코드(HEAD 워크트리, 절대경로)로 직접 대조 — 예: `EIA_EXECUTION_STATUS_VALUES` 리터럴 파일 실존 여부.
- `3-error-handling.md`/`6-websocket-protocol.md`/`12-webhook.md`/`15-chat-channel.md`/`4-execution-engine.md` 등은 컨텍스트 예산 초과로 프롬프트에 본문이 없어 이번 검토에서 직접 대조하지 못했다(정식 규약 파일 자체가 아니라 target 이 참조하는 형제 spec 이므로 본 리뷰의 1차 대상은 아님).

## 발견사항

없음 — `spec/conventions/**` 위반으로 분류할 CRITICAL/WARNING 항목을 찾지 못했다.

교차 검증한 세부 근거:

- **DTO/응답 규약 (`swagger.md`)**: §10.1 이 `access-token` 대신 `interaction-token` Bearer scheme 을 쓰는 이유를 §2-1 규약을 인용해 명시적으로 근거를 남기며 편차를 정당화한다. §5.1/§5.4 ack body(`InteractAckDto`)는 §5-2 공용 래퍼 헬퍼 규약과 일치. `dto/responses/*-response.dto.ts` 파일 배치(§10 구현 파일 구조)도 §5-1 규칙과 일치. `ExecutionStatusDto.status` / `InteractAckDto.currentStatus` 가 같은 6값을 공유하는 사례는 §5-1 이 요구하는 `*.literal.ts` 분리 대상인데, 실제로 `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` (`EIA_EXECUTION_STATUS_VALUES`)가 존재해 규약을 그대로 구현하고 있음을 코드로 확인했다 (target §10 파일 구조 목록에는 `...`로 생략돼 있었으나 실제로는 준수 중).
- **§5.3 `context` 의 `oneOf`/판별자 미사용**: `discriminator` 를 쓰지 않고 `oneOf`+키 존재 판별로 명시한 서술(§5.3 blockquote)이 `swagger.md` §1-4 Rationale("discriminator 는 판별자가 sound 할 때만")과 정확히 일치.
- **에러 코드 명명 (`error-codes.md`)**: target 전역에서 사용하는 코드(`VALIDATION_ERROR`, `TOKEN_*` 6종, `STATE_MISMATCH`, `EXECUTION_TERMINATED`, `RATE_LIMITED`, `TOO_MANY_CONNECTIONS`, `MESSAGE_TOO_LONG`, `WEBCHAT_IDLE_TIMEOUT`, `EXECUTION_QUEUE_WAIT_TIMEOUT`, `RESUME_*` 등)이 모두 `UPPER_SNAKE_CASE`이며 의미 기반 명명 원칙(§1)에 부합. `WEBCHAT_IDLE_TIMEOUT`(§R19)는 도메인 prefix 권장(§1)에도 맞고, `Chat Channel` 모듈과의 네이밍 혼동을 피하려 `CHANNEL_` 이 아닌 `WEBCHAT_` 을 택했다는 근거까지 명시.
- **Redis 키 (`redis-keys.md`)**: target §8.4 가 나열한 `eia:rl:interact:<executionId>` / `eia:rl:status:<executionId>` / `eia:notif:rl:<triggerId>` 는 `redis-keys.md` §3 전역 인벤토리에 동일하게 등재되어 있고 상세 SoT 포인터도 서로 정확히 가리킨다.
- **Secret Store (`secret-store.md`)**: target §7.1 의 `secret://triggers/{triggerId}/notification-signing`(+`.v2` grace 접미)는 `secret-store.md` §1 예시 표와 정확히 일치.
- **감사 액션 (`audit-actions.md`)**: target §3.1 EIA-NX-12/§3.3 EIA-AU-07 이 기록하는 `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 는 `audit-actions.md` §3 레지스트리("2026-08-11 구현")에 그대로 등재.
- **Interaction Type Registry**: target §5.3/§6.2 의 외부 3값(`form`/`buttons`/`ai_conversation`)과 내부 4값(`ai_form_render` 포함) 매핑 서술이 `interaction-type-registry.md` §1.1 각주("내부 4값 ↔ EIA 외부 3값 매핑")와 완전히 일치.
- **문서 구조 규약**: `# Spec: ...` → `## Overview (제품 정의)` → 본문 → `## Rationale` 순서가 형제 문서(`12-webhook.md`, `13-replay-rerun.md`, `15-chat-channel.md`)와 동형이며 CLAUDE.md/SKILL.md 의 3섹션 권장을 따른다. 파일명 `14-...`도 인접 번호(12/13/15) 체계와 일관.

## 요약

`spec/5-system/14-external-interaction-api.md` 는 명명(에러 코드/Redis 키/secret ref/audit action)·출력 포맷(응답 봉투, DTO 래퍼, oneOf vs discriminator)·문서 구조(Overview/본문/Rationale)·API 문서 규약(Swagger bearer scheme 편차의 명시적 근거) 전 축에서 `spec/conventions/**` 를 이례적으로 촘촘하게 인용·정합시키고 있으며, 의심스러워 보이는 편차(예: 별도 `interaction-token` Bearer scheme, `context` 의 `oneOf`-only, `TOKEN_REFRESH_FORBIDDEN` 의 403 예외)는 모두 해당 규약의 근거 절을 직접 인용해 정당화한다. 코드 대조(예: `execution-status.literal.ts` 실존)로 재확인한 항목도 규약을 실제로 준수하고 있었다. 이번 검토에서 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 다만 `3-error-handling.md`/`6-websocket-protocol.md`/`12-webhook.md`/`15-chat-channel.md`/`4-execution-engine.md` 등 target 이 참조하는 형제 spec 본문이 컨텍스트 예산 초과로 이번 프롬프트에 없었으므로, 그 문서들과의 상호 정합(예: WS §4.6 매핑 표, error-handling §1.4 코드 카탈로그)은 이번 회차의 검증 범위 밖이다 — 별도 라운드나 직접 Read 로 보강 권장.

## 위험도

NONE
