# Testing Review — trigger-create-multi-provider-ui

리뷰 일자: 2026-05-24

---

## 발견사항

### [WARNING] `inboundSigningPlaintext` DTO MinLength 검증 미테스트 — 실 동작 불일치 위험
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` L197 + `trigger-dto-validation.spec.ts`
- 상세: `inboundSigningPlaintext` 필드에 `@MaxLength(128)` 는 선언돼 있으나 `@MinLength(32)` 는 없다. `@ApiPropertyOptional` 의 `minLength: 32` 는 Swagger 문서 표기일 뿐 class-validator 검증에 영향을 주지 않는다. 결과적으로 DTO 계층에서 빈 문자열 `""` (길이 0) 이 통과되고, service 단의 `assertInboundSigningPlaintextByProvider` 가 `typeof plaintext !== 'string' || plaintext.length === 0` 검사로 잡는다. 이 두 계층 사이의 동작 차이를 검증하는 테스트가 없다. `trigger-dto-validation.spec.ts` 는 `chatChannel` 필드 전체를 테스트하지 않는다.
- 제안: `trigger-dto-validation.spec.ts` 에 `ChatChannelConfigDto` 의 `inboundSigningPlaintext = ""` (empty string) 이 DTO 단에서 통과되는지 / service 단에서 차단되는지 명시적으로 확인하는 케이스 추가. 또는 `@MinLength(32)` 데코레이터를 추가해 DTO 단 자체 차단으로 일관성 확보.

### [WARNING] `discord — plaintext 누락 → 400` e2e 케이스 없음
- 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` L202-247
- 상세: `slack` describe block 에는 "plaintext 누락 → 400" 케이스가 있지만 (L164-179), `discord` describe block 에는 "valid plaintext → 201" 과 "잘못된 hex64 형식 → 400" 만 있고 **"discord + plaintext 완전 누락 → 400"** 케이스가 없다. unit 테스트(`triggers.service.spec.ts` L845 근처) 에는 `discord — 잘못된 hex 64 형식` 케이스가 있지만, `plaintext` 자체가 없는 경우(`undefined`)를 e2e 에서 검증하지 않는다. `assertInboundSigningPlaintextByProvider` 에서 slack/discord 를 동일 분기로 처리하므로 실제 버그 위험은 낮지만, e2e 레벨 coverage gap 이다.
- 제안: `discord` describe block 에 `chatChannel: { provider: 'discord', botToken: '...' }` (inboundSigningPlaintext 없음) → 400 케이스 추가. slack 과 대칭적 커버리지.

### [WARNING] `ownerEmailVerified=false` 회귀 테스트 의도적 삭제 — 대체 coverage 없음
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` (삭제된 it 케이스), `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` (삭제된 `ownerEmailVerified` 옵션)
- 상세: PR #303 에서 추가된 "owner.emailVerified=false trigger 의 inbound (PING) → 200 + signing skip" 케이스가 이 PR 에서 제거됐다. plan 파일(`chat-channel-unverified-owner-e2e.md`) 에 따르면 이 케이스는 "chat-channel inbound 는 owner.emailVerified 와 무관" 이라는 설계 invariant 를 회귀 차단하기 위해 명시적으로 추가된 것이었다. 제거 사유가 리뷰 대상 diff 어디에도 명시되지 않았다. 해당 invariant 의 회귀 차단이 다른 테스트로 이관됐는지 확인 불가.
- 제안: 제거 사유를 PR body 에 명시하거나, 해당 invariant 를 커버하는 다른 테스트가 있다면 그 위치를 주석으로 인용. 없다면 재추가 필요.

### [INFO] `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` 삭제 — 대응 spec §12.7 rollback 여부 불명확
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (삭제), `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` (formData cap 테스트 전체 삭제)
- 상세: `ai-agent.handler.ts` 에서 `capFormDataBytes` 헬퍼와 `FORM_SUBMITTED_MAX_BYTES` 상수가 제거됐고, `ai-agent.handler.spec.ts` 에서 formData 크기 cap 관련 테스트 3건(cap 미만 unchanged / cap 초과 truncate + 메타 / 비-string 필드 보존)이 삭제됐다. `plan/complete/ai-agent-formdata-size-limit.md` 도 삭제됐다. PR #301 ai-review security INFO 후속으로 구현 후 완료 처리까지 마쳤던 기능이 이 PR 에서 롤백됐다. 의도적 롤백이라면 spec/4-nodes/3-ai/1-ai-agent.md §12.7 도 동반 제거·수정 필요하다 (테스트 관점 외 spec 정합성 이슈).
- 제안: formData cap 기능 롤백 여부와 사유를 PR 설명에 명시. spec §12.7 동반 제거·수정 여부 확인.

### [INFO] `ChatChannelConfigDto.inboundSigningPlaintext` DTO 단위 테스트 완전 부재
- 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- 상세: 신규 필드 `inboundSigningPlaintext` 의 `@IsOptional`, `@IsString`, `@MaxLength(128)` 데코레이터를 검증하는 DTO 단위 테스트가 없다. 기존 `trigger-dto-validation.spec.ts` 는 `authConfigId` 변환만 다루고 있다. 서비스 단 검증이 주된 방어선이므로 unit 테스트로 커버되지만, DTO 계층의 독립 검증이 부재하면 데코레이터 변경 시 회귀를 늦게 발견할 수 있다.
- 제안: `ChatChannelConfigDto` 에 대한 class-validator 검증 케이스를 `trigger-dto-validation.spec.ts` 또는 별도 `chat-channel-config-dto.spec.ts` 에 추가. 최소 케이스: `inboundSigningPlaintext` MaxLength(128) 초과 시 validation 에러 발생 여부.

### [INFO] `triggers.service.spec.ts` — create 경로의 provider-issued plaintext 테스트 없음 (update 만 있음)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` L735-908
- 상세: provider-issued inbound-signing unit 테스트 describe block (`L735`) 의 모든 케이스가 `service.update(...)` 를 호출한다. `service.create(...)` 경로에서 slack/discord `inboundSigningPlaintext` 처리를 검증하는 unit 케이스가 없다. e2e (`chat-channel-trigger-create.e2e-spec.ts`) 가 create 경로를 커버하지만, service 단 unit 커버리지 gap 이다. `assertChatChannelInputSafe` 는 create/update 공용이므로 실제 버그 위험은 낮다.
- 제안: `service.create` 에서 slack `inboundSigningPlaintext` valid/invalid 케이스 1~2건 추가해 create 경로 unit 커버리지 확보. 낮은 우선순위이나 문서화 가치 있음.

### [INFO] e2e `chat-channel-trigger-create.e2e-spec.ts` — `inboundSigningPlaintext` 가 응답 config 에 없음 검증이 slack 만 명시적 (`not.toHaveProperty`)
- 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` L156-161 vs L222-226
- 상세: slack 의 성공 케이스(L156-161)는 `inboundSigningPlaintext` 와 `inboundSigningRef` 모두 응답에 없는지 `not.toHaveProperty` 로 명시적으로 검증한다. discord 성공 케이스(L222-226)는 `inboundSigningPlaintext` 만 확인하고 `inboundSigningRef` 부재를 검증하지 않는다. discord 는 `inboundSigningRef` 가 설정될 수 있음에도 응답에서 strip 되는지 확인하지 않는다.
- 제안: discord 성공 케이스에 `expect(chatChannel).not.toHaveProperty('inboundSigningRef')` 추가해 slack 과 대칭적 검증.

### [INFO] `CHAT_CHANNEL_PROVIDERS` enum 확장 ('slack', 'discord' 추가) — DTO validation spec 미갱신
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` L48, `trigger-dto-validation.spec.ts`
- 상세: `CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord']` 로 확장됐으나, `trigger-dto-validation.spec.ts` 에는 `provider` enum 값 검증 테스트(유효/무효 값)가 없다. e2e 에서 `whatsapp` 같은 미등록 provider → 400 을 검증하나(L250-262), 이는 DTO 단 `@IsIn(CHAT_CHANNEL_PROVIDERS)` 수준의 검증이다.
- 제안: DTO 단에서 provider enum 검증 unit test 추가. 특히 `'whatsapp'` 같은 무효값이 class-validator 수준에서 reject 되는지 확인.

---

## 요약

핵심 변경인 slack/discord provider 분기의 `inboundSigningPlaintext` 처리는 unit 7케이스 (service spec `L735-908`) 와 e2e 8케이스 (create e2e) 로 핵심 경로가 커버되어 있다. e2e 테스트는 외부 API mock 없이 의도적으로 진입 가드(status code + plaintext strip)만 검증하는 경계가 명확하게 문서화돼 있다. 그러나 세 가지 중요한 gap 이 있다: (1) PR #303 에서 명시적으로 추가된 `ownerEmailVerified=false` 회귀 차단 케이스가 이 PR 에서 제거됐으며 대체 coverage 가 없다. (2) discord + plaintext 완전 누락 경로의 e2e 커버리지가 없다. (3) `inboundSigningPlaintext` 의 DTO 단 MinLength 미선언으로 인해 DTO와 service 두 계층 사이의 검증 책임이 비대칭인데 이를 확인하는 테스트가 없다. `ai-agent.handler.ts` 의 `capFormDataBytes` rollback 이 의도된 결정이라면 대응 spec과 계획 상태도 함께 정리될 필요가 있다.

---

## 위험도

MEDIUM

STATUS: OK
