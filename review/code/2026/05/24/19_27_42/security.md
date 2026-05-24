# 보안(Security) 리뷰 결과

리뷰 일시: 2026-05-24
대상 PR: trigger-create-multi-provider-ui (Slack / Discord provider 추가)
핵심 점검 관점: Slack signing secret / Discord public key plaintext 입력 → SecretResolver.store 흐름, SS-SE-01 보장 여부

---

## 발견사항

### [CRITICAL] SS-SE-01 위반 — botToken + inboundSigningPlaintext plaintext 가 DB JSONB 에 일시 기록됨

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` lines 128-139 (`create` 메서드), lines 186-193 (`update` 메서드)
- **상세**:
  `mergeExternalConfig(config, notification, interaction, chatChannel)` 는 `chatChannel` DTO 객체 전체를 `config.chatChannel` 에 그대로 할당한다 (line 423: `if (chatChannel !== undefined) next.chatChannel = chatChannel`). 이 시점의 `ChatChannelConfigDto` 에는 `botToken` (plain Telegram/Slack/Discord bot token) 과 `inboundSigningPlaintext` (Slack signing secret / Discord public key) 가 포함되어 있다.

  그 결과 `this.triggerRepository.save(trigger)` (line 139) 가 호출될 때 `trigger.config` JSONB 컬럼에 이 두 plaintext 가 **DB 에 영구 기록**된다. `setupChatChannel` (line 144) 이 나중에 plaintext 를 strip 하고 ref 만 남기는 `triggerRepository.update` 를 별도로 호출하지만, 최초 `save` 와 `setupChatChannel` 내부의 `update` 사이에 짧게나마 plaintext 가 JSONB 에 존재한다.

  더 심각한 것은 `setupChatChannel` 이 예외를 던지면 fallback 경로(line 549-561)가 `internalCfg` (이미 strip된 config) 로 다시 `update` 하므로 정상 복구되지만, **최초 `save` 시 기록된 JSONB row 가 DB WAL / 슬로우쿼리 로그 / DB 레플리카 등 다양한 채널에 유출될 수 있다**. 또한 `chatChannelAdapterRegistry.has(provider)` 가 false 여서 setupChatChannel 이 조기 return 하는 경우(line 437-440)에는 `setupChatChannel` 내의 strip 로직 자체가 실행되지 않아 plaintext 가 DB 에 **영구적으로** 남는다.

  spec/conventions/secret-store.md §5.5 의 SS-SE-01 ("plaintext 는 config 에 흘러가지 않음") 이 명백히 위반된다.

- **제안**:
  `mergeExternalConfig` 에 chatChannel 을 전달하기 전, 또는 `mergeExternalConfig` 내부에서 chatChannel 의 plaintext 필드 (`botToken`, `inboundSigningPlaintext`) 를 반드시 제거하고 저장해야 한다. 구체적으로는:

  ```ts
  // create / update 공통 — mergeExternalConfig 호출 전에 plaintext 제거
  const { botToken: _bt, inboundSigningPlaintext: _isp, ...safeChannel } =
    chatChannel as ChatChannelConfigDto & { botToken?: string; inboundSigningPlaintext?: string };
  const mergedConfig = this.mergeExternalConfig(config ?? {}, notification, interaction,
    chatChannel ? safeChannel as ChatChannelConfigDto : undefined);
  ```

  이렇게 하면 최초 `save` 시점부터 plaintext 가 JSONB 에 들어가지 않고, `setupChatChannel` 이 ref 를 채워 넣는 패턴이 유지된다.

---

### [WARNING] `inboundSigningPlaintext` DTO 최소 길이 검증 부재 — @ApiPropertyOptional minLength 와 @IsString/@MaxLength 불일치

- **위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` lines 185-198
- **상세**:
  `@ApiPropertyOptional` 의 `minLength: 32` 는 Swagger 문서 힌트이지만, 실제 class-validator 데코레이터는 `@IsString()` 과 `@MaxLength(128)` 만 선언되어 있다. `@MinLength(32)` 가 없으므로 DTO 레이어에서 길이 하한 검증이 수행되지 않는다.
  
  결과적으로 1~31 자의 `inboundSigningPlaintext` 가 DTO 통과 후 `assertInboundSigningPlaintextByProvider` 에서 regex 검증으로 걸러지므로 최종 차단은 되지만, 방어 심층화(defense-in-depth) 관점에서 DTO 단에도 `@MinLength(32)` 를 추가하는 것이 일관성과 보안 강도를 높인다.
- **제안**: `@MinLength(32)` 를 `@MaxLength(128)` 와 함께 선언. 또한 Slack(32) 과 Discord(64) 가 요구하는 최소 길이의 공통 하한(32)을 DTO 단 MinLength 로 명시.

---

### [WARNING] `ownerEmailVerified=false` inbound 회귀 차단 테스트 제거 — 보안 불변조건 lock-in 케이스 삭제됨

- **위치**: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` (diff: "owner.emailVerified=false" 케이스 전체 삭제), `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` (`ownerEmailVerified` 옵션 삭제)
- **상세**:
  PR #303 (chat-channel-e2e-hardening) 에서 "inbound webhook 은 public route — workspace owner 의 emailVerified 와 무관" 이라는 보안 불변조건을 e2e 로 lock-in 하기 위해 `ownerEmailVerified=false` 케이스를 추가했다. 이번 PR 에서 해당 테스트와 fixture 옵션을 모두 제거한다.
  
  현재 코드에서 실제 보안 회귀가 발생한 것은 아니나, 미래에 누군가가 inbound 처리 경로에 `owner.emailVerified` 검사를 잘못 추가할 경우 이를 자동으로 탐지하는 안전망이 없어진다. plan/complete/chat-channel-unverified-owner-e2e.md 가 명시한 존재 이유("회귀 차단")가 사라진 것이다.
- **제안**: 삭제 이유를 PR 본문 또는 plan 에 명시하고, inbound 가 emailVerified 와 무관하다는 invariant 가 다른 방식(코드 주석 또는 다른 e2e 테스트)으로 보존되는지 확인해야 한다. 삭제가 필수적이지 않다면 해당 케이스를 유지하는 것이 권장된다.

---

### [INFO] `assertInboundSigningPlaintextByProvider` 의 regex 는 `/i` flag 를 허용 — 대문자 hex 도 통과

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` lines 292, 301
- **상세**:
  Slack (`/^[a-f0-9]{32}$/i`) 과 Discord (`/^[a-f0-9]{64}$/i`) 검증 regex 에 case-insensitive flag(`/i`)가 붙어 있어 `A1B2...` 형태의 대문자 hex 도 허용된다. Slack signing secret 과 Discord public key 는 실제로 소문자 hex 로 발급되므로 대문자 입력이 들어오면 외부 provider 와의 서명 검증 실패(HMAC mismatch)로 이어질 수 있다.
  
  이것은 보안 취약점이라기보다는 입력 정규화 누락이지만, 서비스 가용성 영향이 있다. 서명 검증 실패 시 webhook 인증이 안 되어 trigger 가 degraded 상태로 빠질 수 있다.
- **제안**: `/i` flag 를 제거하고 입력을 소문자로 강제하거나(`.toLowerCase()` 후 regex 체크), 소문자만 허용(`/^[a-f0-9]{32}$/`)하도록 변경.

---

### [INFO] `formData` 크기 cap (`FORM_SUBMITTED_MAX_BYTES`) 제거 — LLM 토큰 DoS 방어 제거

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (diff: `capFormDataBytes` 헬퍼 및 호출 코드 전부 삭제), `ai-agent.handler.spec.ts` (관련 테스트 삭제)
- **상세**:
  PR #301 ai-review 가 "formData 크기 제한 없어 토큰 DoS 잠재 위험"을 식별하여 PR #302 에서 10KB cap 이 도입되었으나, 이번 PR 에서 해당 cap 이 전면 제거된다. 이는 plan/complete/ai-agent-formdata-size-limit.md 에서 정식으로 도입한 보안 강화를 역행하는 것이다.
  
  사용자가 textarea 에 수백KB 텍스트를 입력해 LLM tool_result 로 그대로 직렬화되면 token 비용 폭주 및 context window 초과 위험이 재발한다. 엄밀한 의미의 인증/인가 취약점은 아니나 DoS(Denial-of-Service)에 해당하며, 사용자별 과금 구조가 있는 경우 금전적 피해로도 이어질 수 있다.
- **제안**: 제거 이유를 PR 에 명시해야 한다. 의도적인 제거라면 대체 cap 로직(예: presentation layer 의 1MB cap 이 커버한다는 논거)을 문서화할 것. 그렇지 않다면 cap 을 복원해야 한다.

---

### [INFO] 에러 메시지에 provider 이름 직접 노출 — 정보 과다 공개 가능성 낮음

- **위치**: `triggers.service.ts` line 440: `` `TriggersService: chatChannel.provider="${chatChannelCfg.provider}" 미등록 — setupChannel skip` ``
- **상세**:
  이 문자열은 `this.logger.warn`(서버 측 로그)에만 기록되며 클라이언트 응답에 노출되지 않는다. 현재 코드상 실제 취약점이 아니나, 향후 에러 핸들러 변경으로 이 메시지가 클라이언트에 전달될 경우 등록된 provider 목록이 노출될 수 있다. LOW 위험.
- **제안**: logger 메시지는 현행 유지 가능. 단, 클라이언트용 BadRequestException 의 message 에는 provider 값을 포함하지 않는 기존 패턴을 유지할 것.

---

## 요약

이번 PR 의 가장 심각한 보안 문제는 **CRITICAL** 등급으로, `create` / `update` 경로에서 `mergeExternalConfig` 가 `chatChannelConfigDto` 전체를 config JSONB 에 병합한 뒤 DB 에 저장(`triggerRepository.save`)하므로 `botToken` 과 `inboundSigningPlaintext` (Slack signing secret / Discord ed25519 public key) plaintext 가 DB 에 일시적으로 기록된다. 이는 spec SS-SE-01 을 위반하며 특히 adapter registry 미등록 상태에서는 strip 로직이 아예 실행되지 않아 plaintext 가 영구 잔존한다. `sanitizeChatChannelForResponse` 가 응답 strip 을 올바르게 수행하고, `setupChatChannel` 내부의 plaintext 제거 및 secret store 이관 로직은 구조적으로 타당하나, DB 최초 저장 시점에 plaintext 를 배제하지 않는 타이밍 갭이 핵심 결함이다. 아울러 PR #302 에서 도입한 formData 10KB cap 이 이번 PR 에서 제거되어 LLM 토큰 DoS 방어가 제거된 점, 그리고 `ownerEmailVerified=false` 보안 불변조건 회귀 차단 테스트가 삭제된 점도 보안 강도 관점에서 후퇴에 해당한다.

---

## 위험도

**CRITICAL**

STATUS: OK
