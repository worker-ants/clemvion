# 부작용(Side Effect) 리뷰

검토 일자: 2026-05-24
대상 PR: trigger-create-multi-provider-ui (chat-channel slack/discord 지원 + 생성 모달 UI)

---

## 발견사항

### [INFO] setupChatChannel — SecretResolver.rotate 2회 호출 (botToken + inboundSigningPlaintext)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` setupChatChannel() 내 lines 457–484
- 상세: 이전 구현에서 `setupChatChannel` 은 botToken 을 위한 `secrets.rotate` 를 1회만 호출했다. 변경 후에는 provider-issued plaintext(`inboundSigningPlaintext`)가 존재하면 `inboundSigningRef`에 대해 추가로 `secrets.rotate`를 1회 더 호출한다. 즉 slack/discord 인 경우 항상 secret_store 에 2건의 rotate(write) 부작용이 발생한다. 이 자체는 의도된 동작(spec/conventions/secret-store.md §5.5 (b))이며, 멱등성이 보장된 UPSERT 연산이다. 단, `setupChannel` 어댑터 호출이 그 이후 실패하면 secret_store 에 2건이 잔류한 채 trigger 상태는 `degraded`가 된다. 기존에는 botToken 1건만 잔류했으나 이제 inboundSigningRef 도 추가로 잔류한다. `remove()` 경로에서 `deleteByPrefix("secret://triggers/${id}/")` 로 일괄 삭제되므로 누수 차단은 기존과 동일. INFO 수준.
- 제안: 현 동작 유지 가능. 다만 setupChannel 실패 시 "secret_store row 2건 잔류" 사실을 코드 주석(SUMMARY#24 하단)에 명시해 두면 향후 유지보수 시 혼란을 줄일 수 있다.

---

### [INFO] setupChatChannel — triggerRepository.update 호출 경로 증가 (성공/실패 양쪽)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` setupChatChannel() 성공 분기(line 529) + 실패 fallback 분기(line 553)
- 상세: 이번 변경 자체가 이 `update` 호출을 새로 도입한 것은 아니다. 그러나 `internalCfg` 구성 로직에 `providerIssuedStored ? { inboundSigningRef } : {}` 분기가 추가되어, 실패 경로의 `fallbackConfig` 도 `inboundSigningRef`가 조건부로 포함된다. 이 부작용은 설계 의도에 부합하며(SS-SE-01: ref 만 config 에 보관), 변경 범위도 `chatChannel` JSONB 키 안으로 국한된다. 외부 상태(global variable, env, 파일시스템)에 부작용은 없음. INFO 수준.
- 제안: 변경 없이 유지 가능.

---

### [INFO] create()/update() — setupChatChannel 후 findOne 재조회 추가
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` create() line 148–151, update() line 200–203
- 상세: `setupChatChannel` 이 `triggerRepository.update` 로 DB를 직접 갱신한 뒤, in-memory `saved` 객체는 stale 상태가 된다. 이를 해소하기 위해 `findOne` 재조회를 추가했다. 이 재조회는 새로운 DB read 부작용을 의도적으로 도입하며, 응답에 `hasBotToken/inboundSigningRef` 가 정확히 반영되는 것을 보장한다. `findOne` 실패(null) 시 기존 `sanitizeChatChannelForResponse(saved)` 경로로 자동 fallback(`if (refreshed)` 가드)하므로 stale 응답이 반환될 수 있으나, 이 경우는 trigger가 생성 직후 삭제된 극단적 race condition 이며 기능 장애는 아니다. 의도된 부작용. INFO 수준.
- 제안: 현 구현 유지. null fallback 이 stale 응답을 반환할 수 있다는 점을 주석으로 명시하면 가독성이 높아진다.

---

### [INFO] assertChatChannelInputSafe — chatChannel.inboundSigning 차단 메시지 변경 (공개 API 응답 메시지 변경)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` line 250
- 상세: `inboundSigning` 필드가 입력된 경우의 400 에러 메시지 문자열이 변경됐다. 이전: `"외부 입력은 허용되지 않습니다."` → 이후: `"provider-issued (Slack signing secret / Discord public key) 입력은 inboundSigningPlaintext 를 사용하세요."`. 에러 `code: 'VALIDATION_ERROR'` 는 동일하다. 이 메시지를 파싱해 분기 처리하는 클라이언트가 있다면 영향을 받을 수 있으나, 현재 `ERROR_KO` 테이블에 미등록이므로 자동화된 코드 의존 가능성은 낮다. INFO 수준.
- 제안: 현 변경 유지. message 필드 파싱 의존 클라이언트가 없음을 확인.

---

### [INFO] `CHAT_CHANNEL_PROVIDERS` 배열 확장 — enum 기반 파생 타입 전파
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` line 48
- 상세: `CHAT_CHANNEL_PROVIDERS = ['telegram'] as const` → `['telegram', 'slack', 'discord'] as const` 로 확장됐다. TypeScript 타입 `ChatChannelProvider`는 이 배열에서 파생되므로, 이 상수를 사용하는 모든 exhaustive switch/guard 로직에서 타입 체커가 `slack`/`discord` case 미처리 시 컴파일 에러를 낼 수 있다. 런타임 부작용보다는 빌드 타임 영향이 핵심이며, 실제로 어댑터 레지스트리에 slack/discord 가 이미 등록됐으므로 의도된 변경. INFO 수준.
- 제안: 현 변경 유지. CI 빌드 통과로 exhaustive 분기 누락이 없음을 확인.

---

### [INFO] inboundSigningPlaintext — DTO 필드 추가 (신규 공개 입력 채널)
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` lines 108–121
- 상세: 신규 필드 `inboundSigningPlaintext`가 DTO 에 추가됐다. Swagger 문서에 노출되며 API 클라이언트가 이 필드를 보낼 수 있게 된다. Service 단에서 `sanitizeChatChannelForResponse` 가 이 필드를 응답에서 제거하고, `setupChatChannel` 이 secret store 로 이동 후 config 에 흘리지 않는다(SS-SE-01). 필드 자체의 DB 저장 부작용은 없으나, 입력 시 `secrets.rotate` 부작용을 유발한다는 점이 DTO 주석에 기술돼 있어 계약이 명확하다. INFO 수준.
- 제안: 현 구현 유지.

---

### [INFO] frontend page.tsx — chatChannel 을 config 하위에서 top-level 로 이동
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` lines 207–238
- 상세: 이전 코드는 `config.chatChannel = chatChannel` 로 config JSONB 안에 중첩했으나, `CreateTriggerDto` 에서 `chatChannel` 은 top-level 필드다. 이번 변경이 이 잘못된 네스팅을 수정한다. 이전 동작에서는 backend 가 top-level `chatChannel` 을 받지 못해 `setupChatChannel` 이 실행되지 않는 결함이 있었다. 수정 자체는 의도된 동작 복원이다. 단, `config` 객체는 변경 없이 그대로 전송되므로 기존 `config` 기반 기능(notification, interaction 등)에 부작용 없음. INFO 수준.
- 제안: 현 변경 유지. 이전 버전의 잘못된 동작(setupChatChannel 미실행)이 e2e 에서 회귀 차단됐는지 확인 권장.

---

### [INFO] 기존 e2e 케이스 2건 삭제 — 회귀 차단 공백
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` (owner.emailVerified=false 케이스 삭제), `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` (`ownerEmailVerified` 옵션 삭제)
- 상세: PR #303 에서 추가된 "owner.emailVerified=false trigger 의 inbound PING → 200" e2e 케이스와 헬퍼 옵션이 삭제됐다. 이 케이스는 inbound webhook 이 owner 인증 상태와 무관함을 lock-in 하는 회귀 차단 목적이었다. 삭제 사유가 diff 에 명시되지 않아 의도 파악이 어렵다. 해당 invariant 를 대체하는 테스트가 없다면 향후 누군가 inbound 처리에 `emailVerified` 검사를 추가할 때 회귀 차단 공백이 생긴다. 기능 부작용은 아니지만 테스트 커버리지 부작용. INFO 수준.
- 제안: 삭제 사유를 commit/PR body 에 명시하거나, 동등한 회귀 차단 테스트를 다른 위치에 보존할 것을 권장.

---

### [INFO] ai-agent.handler.ts — capFormDataBytes / FORM_SUBMITTED_MAX_BYTES 제거 (export 삭제)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` lines 222–321 삭제
- 상세: `capFormDataBytes` 함수와 `FORM_SUBMITTED_MAX_BYTES` 상수가 export 로 노출돼 있었으나 완전히 제거됐다. 이 export 를 import 하던 `ai-agent.handler.spec.ts` 도 해당 import 와 관련 테스트 3건이 함께 제거됐다. 이 변경은 `plan/complete/ai-agent-formdata-size-limit.md`(삭제됨)가 구현한 formData 크기 cap 기능 자체를 롤백하는 것이다. `formData` 전체가 LLM tool_result 에 다시 무제한 전달된다. 이 PR 의 주 목적(multi-provider UI) 과 별개로 기존 보안 강화 기능이 되돌아가는 부작용이 발생한다. 해당 계획 문서가 `plan/complete`로 이동된 이후 이를 revert 한 것으로, 의사결정 근거가 diff 에 없다.
- 제안: formData cap 롤백 사유를 PR body 에 명시할 것. 사용자 입력 textarea 대용량 입력에 의한 token 비용 폭주 위험이 재발한다는 점을 인지하고 결정했는지 확인 필요.

---

## 요약

이번 변경의 핵심 부작용은 모두 의도적이다. `setupChatChannel` 내에서 `secrets.rotate` 가 기존 1회에서 최대 2회(botToken + inboundSigningPlaintext)로 증가하고, `triggerRepository.update` 의 config JSONB 구성에 `inboundSigningRef` 조건부 포함이 추가됐다. create()/update() 에서 `findOne` 재조회를 추가해 stale 응답 회귀를 수정한 것도 의도된 부작용이며 안전하다. 전역 변수, 환경 변수, 파일시스템 부작용은 없고, 네트워크 호출(어댑터 `setupChannel`, slack `auth.test`, discord `GET /applications/@me`)은 기존 패턴과 동일하다. 우려되는 사항은 두 가지다. 첫째, `plan/complete/ai-agent-formdata-size-limit.md` 가 구현했던 formData 10KB cap 기능 전체(capFormDataBytes + FORM_SUBMITTED_MAX_BYTES + 테스트 3건)가 이 PR 에서 조용히 롤백됐으며, 이에 대한 명시적 사유가 없다. 둘째, PR #303 에서 추가된 `owner.emailVerified=false` 회귀 차단 e2e 케이스가 삭제됐는데 대체 커버리지가 확인되지 않는다.

---

## 위험도

LOW

STATUS: OK
