# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md` (--impl-done)

## 검토 방법 메모

이번 라운드(`--impl-done`, diff-base `origin/main`)의 target spec 파일 diff 는 사실상 1줄
(§6 필드 집합 표의 `result.cancelledBy` 행 — "경로 1곳 누락" → "2026-08-15 해소, 종결 emit
타입 파사드로 필수 필드화")이며, 실제 변경 몸통은 코드(`execution-event-emitter.service.ts`
신규 `emitTerminalExecution` 파사드 + `execution-engine.service.ts`/`retry-turn.service.ts`
11개 호출부 이관)다. 직전 라운드(`review/consistency/2026/08/15/17_20_28/cross_spec.md`,
`--impl-prep`)가 이미 20여 개 교차 참조를 실측 대조했고, 이번 라운드는 그 결과가 여전히
유효한지 재확인하는 데 집중했다 — target 본문 자체(§3~§12·Rationale)는 이번 diff 로
바뀌지 않았으므로 직전 라운드의 미해결 WARNING 2건·INFO 1건이 그대로 유효한지, 그리고
신규 코드(타입 파사드)가 새 cross-spec 표면을 여는지 검증했다.

재확인 대상: `spec/1-data-model.md` §2.2 Workspace.settings, `spec/5-system/12-webhook.md`
§inline-auth 폐지(V066), `spec/5-system/4-execution-engine.md`(§8 큐 대기 타임아웃·§7.5
rehydration), `spec/conventions/node-cancellation.md`(`finalizeGuarded`),
`spec/conventions/redis-keys.md` §3, `spec/data-flow/15-external-interaction.md` §2.2,
`spec/6-websocket-protocol.md`(경로: `5-system/6-websocket-protocol.md`) §4.6. 실제 코드
(`idempotency.interceptor.ts`, `triggers.service.ts`, `retry-turn.service.ts`,
`execution-event-emitter.service.ts`, `execution-engine.service.ts`)를 `Read`/`grep` 로
직접 열어 spec 서술과 대조했다.

## 발견사항

- **[WARNING]** (직전 라운드 승계, 미해결) outbound 서명 알고리즘 내부 저장 필드명이 §7.1
  자신의 JSONB 예시와 자기모순이며, 폐기 선언된 webhook 필드명을 재사용
  - target 위치: §3.1 EIA-NX-03 (`... trigger config 에 보관하되 (hmacAlgorithm: 'sha256')`)
    vs §7.1 Trigger 엔티티 확장 JSONB 예시 (`"signing": { "algorithm": "hmac-sha256", ... }`)
  - 충돌 대상: `spec/5-system/12-webhook.md` (§167) — `trigger.config` 의 inline 필드
    `authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm` 은 `V066__trigger_config_strip_inline_auth.sql`
    로 제거됐고 "잔존 row 에 남아 있어도 코드는 무시한다"고 명시
  - 상세: EIA-NX-03 은 "내부 저장은 bare form(`hmacAlgorithm: 'sha256'`), 외부 노출만
    prefix form" 이라는 전제를 세우지만, 바로 아래 §7.1 이 보여주는 실제
    `Trigger.config.notification.signing.algorithm` 필드는 이미 prefix form(`'hmac-sha256'`)을
    그대로 저장한다 — 같은 문서 안에서 자기모순이다. 실제 구현도 §7.1 쪽이 맞다: 이번
    라운드에 `codebase/backend/src/modules/triggers/triggers.service.ts:634`
    (`hmacAlgorithm: _hmacAlgorithm` — 읽어서 **버리는** 값, `void _hmacAlgorithm`)과
    `triggers.service.spec.ts:916/983`(`signing: { algorithm: 'hmac-sha256', ... }`)를 직접
    대조 확인했다 — `hmacAlgorithm` 이라는 식별자는 코드에 실존하지만 **V066 이 폐기한 legacy
    입력을 파싱해서 버리는 자리**일 뿐, EIA-NX-03 이 말하는 "내부 저장 필드"가 아니다.
    즉 EIA-NX-03 서술은 자기모순일 뿐 아니라 사실관계도 틀렸다.
  - 제안: EIA-NX-03 의 괄호 서술을 §7.1 실제 스키마(`signing.algorithm: 'hmac-sha256'`)에
    맞춰 정정. bare-form 내부 필드가 정말 필요하면 `12-webhook.md` 가 이미 폐기 선언한
    `hmacAlgorithm` 대신 다른 이름(예: `notificationSigningAlgorithm`)을 쓰고 §7.1 예시도
    동기화.

- **[WARNING]** (직전 라운드 승계, 미해결) `notification_url_allow_pattern` 워크스페이스 설정
  필드가 `1-data-model.md` §2.2 `Workspace.settings` SoT 인벤토리에 미등재된 채 다른
  미구현 필드와 달리 "미구현 (Planned)" 표기 없이 실재하는 것처럼 서술
  - target 위치: §8.1 SSRF 방지(`워크스페이스 단위 allowlist/blocklist 설정 가능
    (workspace_settings.notification_url_allow_pattern)`), §3.1 EIA-NX-10
  - 충돌 대상: `spec/1-data-model.md` §2.2 `Workspace.settings` — known-keys 인벤토리는
    `timezone` / `interactionAllowedOrigins` / `maxConcurrentExecutions` 셋만 camelCase 로
    등재하며 각 키의 소유 spec·편집 API 를 명시. `notification_url_allow_pattern` 은 (a) 이
    인벤토리에 없고 (b) 형제 키와 달리 snake_case 라 같은 JSONB blob 안에서 명명 컨벤션도
    어긋난다. 코드베이스에서도 `notification_url_allow_pattern`/`notificationUrlAllowPattern`
    참조를 찾지 못했다 — SSRF 검증 로직(`8.1`) 자체는 사설 IP·loopback·메타데이터 IP 차단은
    구현돼 있으나, "워크스페이스 단위 allowlist" 옵션 자체가 미구현으로 보인다.
  - 제안: `1-data-model.md` §2.2 에 정식 등재(camelCase 통일) 하거나, 아직 미구현이면
    target §8.1/§3.1 EIA-NX-10 에 다른 항목과 동일하게 "**미구현 (Planned)**" 표기를 추가.

- **[INFO]** (직전 라운드 승계, 미해결) §11 WS↔REST 명령 매핑 표가 권위 표(WS §4.6)의
  부분집합만 미러링
  - target 위치: §11 "WebSocket 명령 ↔ 외부 명령 매핑" 표
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.6 "외부 표면 매핑" — 본 spec §11
    이 "이 표와 정합해야 한다"고 스스로 권위를 선언
  - 상세: WS §4.6 은 `execution.retry_last_turn`(외부 미노출·향후 노출 예정)·`auth.refresh`
    (외부는 `/refresh-token` 사용)·`subscribe`/`unsubscribe`(execution 토큰이 implicit 구독)
    세 행을 포함하지만 target §11 표에는 없다(`retry_last_turn` 은 §3.2 EIA-IN-02 본문
    prose 로만 별도 언급). 값의 모순은 아니고 표의 완전성 차이.
  - 제안: §11 표에 누락 3행을 추가하거나, 표 상단에 "완전한 목록은 WS §4.6 이 SoT, 본 표는
    EIA 활성 명령만 발췌" 캐비엇 명시.

- **[INFO]** (참고, 조치 불요) 이전 라운드 WARNING #4(`TerminalEmitPayload` 신규 타입명이
  기존 `TerminalErrorPayload` 와 한 단어 차이로 혼동 우려)는 이번 구현에서 **해소됨**을 확인
  - target 위치: (spec 서술 없음 — 구현 산출물)
  - 근거: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    가 실제로 `TerminalEventPayload`(포함관계가 드러나는 이름)로 명명했고, JSDoc 이
    "`TerminalErrorPayload`(에러 봉투)를 **포함하는** 관계다 — 이름을 한 단어 차이로 두면
    둘을 혼동한다" 고 그 관계를 명시적으로 남겼다. 직전 라운드 naming_collision 리뷰의 제안이
    그대로 반영됨.

## 대조하여 충돌 없음을 확인한 항목 (이번 라운드 추가 실측)

- `spec/conventions/redis-keys.md` §3 인벤토리와 `spec/data-flow/15-external-interaction.md`
  §2.2 는 `interaction:idempotency:<executionId>:<route>:<key>` 형태를 target §R8("캐시 키
  스코프")과 동일하게 유지 — `idempotency.interceptor.ts` 의 실제 `REDIS_KEY_PREFIX`/`redisKey`
  조합(`interaction:idempotency:${executionId}:${route}:${rawKey}`, `route = context.getHandler().name`
  → `interact`|`cancel`)과 세 문서·코드가 정합.
- `spec/conventions/node-cancellation.md` §2.4 (`finalizeGuarded`) 의 "선점 시 저장·이벤트
  emit 모두 skip, 이미 동일 target 상태면 멱등 emit" 서술은 이번 PR 로 이관된
  `retry-turn.service.ts` `failRetryExecution`/`completeRetryExecution` 의 실제 분기와
  일치 — 신규 `emitTerminalExecution` 파사드 도입이 이 가드 계약을 변경하지 않았다.
- `emitTerminalExecution` 이 조립하는 wire(`status`/`durationMs`/`error`/`result.cancelledBy`)는
  target §6 "종결 이벤트의 필드 집합" 표·§6.5 "user cancel 은 error 키 부재" 규칙과 정확히
  일치(코드 주석이 §6.5 를 직접 인용하며 그 규칙을 구현).

## 요약

target(`14-external-interaction-api.md`)의 이번 라운드 diff 는 §6 필드 집합 표 1줄
("cancelledBy 경로 1곳 누락" → "해소")뿐이고, 그 서술은 실제 코드(`emitTerminalExecution`
판별 union 이 `cancelledBy` 를 필수 필드로 강제)와 정합함을 확인했다. cross-spec 관점의
실질 리스크는 이번 diff 가 아니라 **직전 라운드부터 이어지는 두 WARNING**(outbound HMAC
알고리즘 내부 저장 필드명이 §7.1 자신의 예시·`12-webhook.md` 의 V066 폐기 선언과 어긋남,
`notification_url_allow_pattern` 워크스페이스 설정 필드가 `1-data-model.md` SoT 인벤토리에
미등재)이며 둘 다 이번 라운드에도 손대지 않아 여전히 유효하다. 두 건 모두 코드 대조로
사실관계까지 재확인했다(HMAC 필드는 실제로 legacy 필드를 파싱해 버리는 자리일 뿐이고,
allow-pattern 필드는 코드베이스에 구현 흔적이 없다). 문서 정정 수준으로 닫을 수 있어 이
작업(종결 emit 타입 파사드)을 막을 cross-spec CRITICAL 은 없다.

## 위험도

LOW
