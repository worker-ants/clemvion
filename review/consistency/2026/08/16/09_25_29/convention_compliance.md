# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

## 방법론 메모 (중요 — 먼저 읽을 것)

`_prompts/convention_compliance.md` 번들은 `spec/conventions/` 하위 문서 대부분을 **컨텍스트 예산 초과로
본문 생략** 처리했다 — 특히 이번 target 문서가 실제로 인용하는 `swagger.md`·`error-codes.md`·
`redis-keys.md`·`secret-store.md`·`conversation-thread.md`·`execution-context.md`·
`interaction-type-registry.md`·`node-cancellation.md`·`node-output.md`·`cross-node-warning-rules.md`·
`data-hydration-surfaces.md` 가 전부 "본문 생략됨" placeholder 로만 실렸다 (`audit-actions.md` 와
cafe24 카탈로그 일부만 본문이 실제로 실림). 번들 안에서 예산을 소비한 것은 이 리뷰와 무관한
`cafe24-api-catalog/**` 필드 카탈로그 268개 파일이다.

번들만 보고 판정했다면 이번 target 문서가 인용하는 핵심 규약 본문이 전혀 없는 상태에서
"위반 없음" 을 냈을 것이고 이는 거짓 음성이다. 이 리포트는 번들 대신 **저장소의 실제
`spec/conventions/*.md` 파일을 직접 읽어** 대조했다. 프롬프트 조립 harness 의 예산 배분(관련
없는 카탈로그가 관련 있는 규약 본문을 밀어내는 구조)은 별도로 점검이 필요하다.

---

## 발견사항

### [WARNING] `interaction.triggerToken` 이 SecretResolver 를 경유하지 않고 JSONB 평문 보관
- target 위치: §7.1 Trigger 엔티티 확장, 각주 (`> config.notification.signing.secretRef 의 plaintext 는 ...`)
- 위반 규약: `spec/conventions/secret-store.md` Overview — "모든 도메인 모듈 (chat-channel /
  external-interaction / 향후 cafe24·OAuth 등) 은 본 convention 의 `SecretResolver` 를 경유해
  secret 을 읽고 쓴다."
- 상세: 같은 모듈(`external-interaction`)의 `notification.signing.secretRef` 는
  `secret://triggers/{triggerId}/notification-signing` 형태로 `SecretResolver` 를 정확히 경유하고
  (secret-store.md §1 URI Scheme 예시와 문자 그대로 일치 — 준수), 바로 옆 필드인
  `interaction.triggerToken`(`itk_*`, per_trigger 영구 토큰) 은 "현재 JSONB 평문 (향후 secret store
  통합 검토)" 로 명시돼 있다. secret-store.md 의 적용 범위 선언은 예외를 두지 않으며, `itk_*` 도
  "trigger 가 만드는 모든 execution 에 적용되는 영구 토큰" 으로 leak 시 파급력이 notification
  signing secret 과 동급이다(§8.3 에서도 "trigger 별로 분리되어 서로 다른 trigger 의 토큰을
  cross-validate 할 수 없다"고 민감도를 인정). `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  를 grep 해도 이 항목은 추적되지 않는다 — spec 본문에 "향후 검토" 로만 남아 있고 실제로 좇는
  plan 이 없다.
- 제안: (a) `interaction.triggerToken` 을 `secret://triggers/{triggerId}/interaction-token` 슬롯으로
  옮겨 secret-store.md 를 완전히 준수하도록 spec 을 갱신하고 구현 plan 을 신설하거나, (b) 지금처럼
  평문 유지가 의도된 예외라면 secret-store.md §1 "비대상" 절(현재 `AuthConfig.config` 만 명시)에
  `interaction.triggerToken` 을 명시적으로 등재하고 그 이유(예: opaque 토큰이라 자체가 이미
  revoke-가능한 비밀이라 별도 암호화 계층이 불필요하다는 등)를 Rationale 에 남긴다. 현재처럼
  "향후 검토" 한 줄로 두면 규약과 spec 서술이 계속 어긋난 채로 남는다.

### [INFO] 리뷰 harness 의 `--impl-prep` 번들 예산이 target 이 실제로 인용하는 규약 본문을 통째로 생략
- target 위치: (target 문서 자체가 아니라 이번 검토에 쓰인) `_prompts/convention_compliance.md`
- 위반 규약: 해당 사항 없음 — 프로세스/harness 이슈
- 상세: 위 "방법론 메모" 참조. `spec/5-system/14-external-interaction-api.md` 본문이 명시적으로
  cross-link 하는 규약 문서 11개 전부가 번들에서 "본문 생략됨 — 컨텍스트 예산 초과" placeholder
  로만 남았다. 실제로 예산을 다 쓴 것은 target 과 무관한 `cafe24-api-catalog/**` 268개 파일이다.
  이 review 는 직접 파일을 읽어 대조했지만, 같은 harness 로 도는 다른 세션은 placeholder 만 보고
  "위반 없음" 으로 오판할 위험이 있다 (기존에 기록된 `--spec` 모드의 동일 증상과 같은 원인 계열).
- 제안: target 문서가 명시적으로 참조하는 `spec/conventions/*.md` 파일을 cafe24/makeshop API
  카탈로그보다 먼저 번들에 넣거나, 카탈로그류를 별도 optional 섹션으로 분리해 예산에서
  후순위로 미루는 조립 로직 변경을 별도 harness 티켓으로 남길 것.

---

## 검토 결과 요약 (위반 없음으로 확인된 주요 항목)

다음은 직접 대조한 결과 **정식 규약과 일치**함을 확인한 항목들이다(재발 방지를 위해 기록):

- **문서 구조**: `## Overview (제품 정의)` → 본문(§3~§12) → `## Rationale` 3섹션 구성이 CLAUDE.md 의
  권장 구조를 그대로 따름. 파일명 `14-external-interaction-api.md` 도 `5-system/` 폴더의 기존
  numeric-prefix 관례(`12-webhook.md`, `13-replay-rerun.md`, `15-chat-channel.md`)와 일치.
- **에러 코드 명명**: `VALIDATION_ERROR`/`STATE_MISMATCH`/`TOKEN_REVOKED`/`WEBCHAT_IDLE_TIMEOUT` 등
  전부 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 따르며, WS 내부 코드와
  EIA 외부 코드의 의도적 분리(§R13)도 `error-codes.md` 의 "표면별 코드명" 원칙과 정합.
- **에러 응답 봉투**: §5.1 의 `{ error: { code, message, requestId, details } }` 형식이
  `2-api-convention.md §5.3` 템플릿과 완전히 일치(사실 그 문서가 EIA §5.3 을 실사례로 인용).
- **부재 표현(`null` vs 키 생략)**: §5.3 의 `currentNode`/`result`/`error`=`null`,
  `conversationThread`=키 생략 선택이 `2-api-convention.md §5.4` 의 두 기준 (a)/(b) 를 정확히
  따르고, 그 문서 자체가 이 사례를 선례로 인용.
- **Redis 키 네이밍**: `eia:rl:interact:<executionId>` 등 3개 키가 `redis-keys.md §3` 인벤토리에
  이미 등재된 값과 문자 그대로 일치.
- **secret URI scheme**: `secret://triggers/{triggerId}/notification-signing` 이
  `secret-store.md §1` 예시와 일치(단, 위 WARNING 참조 — 형제 필드는 미준수).
- **감사 액션 명명**: `trigger.notification_secret_rotated`/`trigger.interaction_token_revoked` 가
  `audit-actions.md §3` 레지스트리·`1-auth.md §4.1` 카탈로그 양쪽에 이미 등재된 값과 일치.
- **Swagger 규약**: §10.1 이 `swagger.md §2-1` 의 `interaction-token` Bearer scheme 신설 규칙,
  `@Public()` 표기 규칙(§2-1), 응답 DTO 위치(`dto/responses/*-response.dto.ts`, §5-1), `oneOf`
  무판별자 패턴(§1-4)을 모두 정확히 따름 — 특히 §1-4 의 "discriminator 는 판별자가 sound 할 때만"
  이라는 규칙 자체가 이 spec 의 `context` 필드 사례를 근거로 만들어졌다(순환 검증이 아니라 동일
  설계 결정의 양면).
- **interactionType 3값 매핑**: `interaction-type-registry.md §1.1` 이 EIA 의 4→3 값 통합
  (`ai_form_render`→`ai_conversation`)을 명시적으로 이 spec 을 SoT 로 인용하며 정합.
- **URL 구조**: `/api/external/executions/:id/*` prefix 분리(§R11)와 sub-channel action
  (`/interact`, `/cancel`, `/refresh-token`)이 `2-api-convention.md §2.2` 의 RPC-style sub-channel
  예외(선례 `/api/auth/workspaces/:id/switch`)와 같은 형태.

---

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)는 명명·출력 포맷·문서 구조·API 문서화
규약 전반에서 매우 높은 준수 수준을 보인다 — 다수의 conventions 문서(`swagger.md`,
`error-codes.md`, `redis-keys.md`, `interaction-type-registry.md`, `2-api-convention.md`)가 오히려
이 spec 의 특정 대목을 규칙의 근거 사례로 직접 인용할 정도로 상호 정합이 깊다. 유일하게 실질적인
간극은 `interaction.triggerToken` 이 같은 모듈의 다른 secret 과 달리 `SecretResolver` 를 우회해
JSONB 평문으로 남아 있는 점이며, spec 스스로 "향후 검토" 로 인지하고 있으나 추적 plan 이 없어
WARNING 으로 등재한다. 별도로, 이번 검토에 쓰인 `--impl-prep` 프롬프트 번들이 target 이 실제로
인용하는 규약 문서 11개를 전부 예산 초과로 생략한 점은 이 리뷰의 신뢰도에 영향을 주는 harness
이슈로 기록해 둔다(직접 원본을 읽어 보완했으므로 이번 리포트 자체의 결론에는 영향 없음).

## 위험도

LOW
