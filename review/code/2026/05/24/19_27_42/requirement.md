# 요구사항(Requirement) 리뷰 결과

검토 일자: 2026-05-24
대상: trigger-create-multi-provider-ui 워크트리 변경 (주 SoT: spec/4-nodes/7-trigger/providers/_overview.md §1 + secret-store.md §5.5 + providers/{slack,discord}.md §6)

---

## 발견사항

### [CRITICAL] 워크트리가 main 의 PR #305 (spec §12.7 formData cap) + PR #306 (emailVerified e2e) 를 누락 — 머지 시 두 기능 회귀

- **위치**: 파일 4 (`ai-agent.handler.spec.ts`), 파일 5 (`ai-agent.handler.ts`), 파일 6 (`chat-channel-discord.e2e-spec.ts`), 파일 8 (`e2e-chat-channel-fixture.ts`), 파일 18 (`plan/complete/ai-agent-formdata-size-limit.md` 삭제), 파일 19 (`plan/complete/chat-channel-unverified-owner-e2e.md` 삭제)
- **상세**: 본 워크트리는 `04e678f1` (PR #304) 에서 분기했다. 이후 main 에는 PR #305 (`feat(ai-agent): render_form formData 크기 cap — 10KB + per-field truncate, spec §12.7`) 와 PR #306 (`test(e2e): chat-channel inbound 가 owner.emailVerified 무관함을 lock-in`) 이 머지됐다. 워크트리는 두 PR 을 포함하지 않으므로, 리뷰 대상 PR 을 그대로 main 에 머지하면:
  1. `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` / `formDataTruncation` 코드가 삭제되어 spec §12.7 이 구현에서 사라진다.
  2. Discord e2e `'owner.emailVerified=false trigger 의 inbound (PING) → 200'` 케이스와 `e2e-chat-channel-fixture.ts` 의 `ownerEmailVerified` 옵션이 사라진다.
  spec §12.7은 "10KB cap + string 필드 균등 truncate + formDataTruncation 메타" 를 명시하므로 삭제는 spec 위반이다. PR #305 와 #306 의 코드가 이 워크트리에 cherry-pick 또는 rebase 로 포함되어야 한다.
- **제안**: 이 PR 을 머지하기 전에 main 을 기반으로 `git rebase main` 을 수행하거나 PR #305 / #306 커밋을 cherry-pick 해 두 기능을 워크트리에 통합할 것.

---

### [CRITICAL] inboundSigningPlaintext plaintext 가 최초 triggerRepository.save 시 config JSONB 에 기록됨 — SS-SE-01 위반

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` `create()` 메서드 (line ~128-144) 및 `update()` 메서드 (line ~185-192)
- **상세**: `create()` 의 흐름:
  1. `mergeExternalConfig(config, notification, interaction, chatChannel)` — `chatChannel` DTO 객체 (inboundSigningPlaintext 포함) 를 그대로 `mergedConfig.chatChannel` 에 삽입
  2. `triggerRepository.save({config: mergedConfig})` — inboundSigningPlaintext plaintext 가 **DB JSONB 컬럼에 기록**
  3. `setupChatChannel(saved, chatChannel)` — 여기서야 botToken / inboundSigningPlaintext 를 destructure 로 제거하고 sanitizedCfg 로 `triggerRepository.update` 수행

  즉 2번과 3번 사이에 `trigger.config.chatChannel.inboundSigningPlaintext` plaintext 가 DB 에 존재하는 시간 창이 발생한다. SS-SE-01 은 "plaintext 는 application 메모리 안에서만 존재. DB query / SQL parameter / log / metric 에 일절 노출 금지" 를 필수 요구사항으로 명시한다.

  unit test (line 885 `'slack — plaintext 가 trigger.config 에 흘러가지 않음'`) 은 `triggerRepository.update` 의 두 번째 호출만 확인하므로 최초 `triggerRepository.save` 의 기록을 검출하지 못한다.

  참고: `botToken` 도 동일 경로를 거치므로 pre-existing 이슈이나, `inboundSigningPlaintext` 는 이번 변경에서 신규 도입되어 같은 패턴이 복제된다.

- **제안**: `create()` / `update()` 에서 `mergeExternalConfig` 호출 전에 botToken / inboundSigningPlaintext 를 제거한 sanitized chatChannel 객체를 만들어 config 에 넣고, plaintext 는 `setupChatChannel` 에만 별도 전달하는 구조로 변경. 또는 `triggerRepository.save` 이전에 plaintext 필드를 제거하는 sanitize 단계를 추가. spec/conventions/secret-store.md §5.5 (b) 의 예시 코드도 trigger 를 먼저 save 한 뒤 plaintext 를 store → inboundSigningRef 를 set → 다시 save 하는 흐름을 보여주지만 이미 plaintext 를 저장하지 않은 상태에서 시작한다.

---

### [CRITICAL] Slack signing secret 의 `^[a-f0-9]{32}$` 형식 요구사항이 spec 에 없음

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertInboundSigningPlaintextByProvider()` (line ~293-301), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` JSDoc (line ~99)
- **상세**: 구현이 Slack signing secret 을 `^[a-f0-9]{32}$` (소문자 hex 32자) 로 강제한다. 그러나 `spec/4-nodes/7-trigger/providers/slack.md §6` 에는 signing secret 의 형식(hex 32자 등)이 명시되어 있지 않다. Slack 의 실제 signing secret 형식은 `v0:` prefix 없이 hex 32자이므로 사실적으로는 맞을 수 있으나, **spec 이 명시하지 않은 검증 규칙이 코드에 추가**됐다. 형식 요구사항이 spec 에 없으면 외부 플랫폼이 형식을 변경할 경우 spec 갱신 없이 코드가 방어선 역할을 한다는 보장이 없다. 또한 `i` flag (대소문자 무관) 로 검증하므로 대문자도 허용되나 오류 메시지는 "hex 32 chars 필요" 로만 안내한다.
- **제안**: `spec/4-nodes/7-trigger/providers/slack.md §6` (보안 섹션) 에 Slack signing secret 의 형식 (`^[a-f0-9]{32}$` 또는 32바이트 hex) 을 명시하고, Discord public key 의 형식 (`^[a-f0-9]{64}$`) 도 마찬가지로 spec 에 기록할 것 (project-planner 위임). 이 변경 전까지 코드의 형식 검증은 spec-undocumented 상태다.

---

### [WARNING] `assertInboundSigningPlaintextByProvider` 가 PATCH 경로에서도 slack/discord plaintext 를 필수 요구 — 기존 trigger update 시 회귀 가능

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` → `assertChatChannelInputSafe()` → `assertInboundSigningPlaintextByProvider()` (line ~183, ~254)
- **상세**: `assertInboundSigningPlaintextByProvider` 는 slack/discord provider 의 경우 `inboundSigningPlaintext` 가 없으면 즉시 400 을 던진다. `update()` 경로에서는 사용자가 chatChannel 의 다른 설정(예: uiMapping, rateLimitPerMinute)만 PATCH 하려 해도 provider=slack 이면 `inboundSigningPlaintext` 를 반드시 함께 보내야 한다. 이는 불필요한 re-submission 을 강제한다.

  일관성 검토 리뷰 (`review/consistency/2026/05/24/...`) 도 이 점을 WARNING 으로 지적했으나, 본 PR 은 명시적 결정 없이 구현했다. spec `15-chat-channel.md §5.4.1` 이 `inboundSigning` 에 대한 PATCH single-path 정책을 정의하지 않아 구현이 정책을 선행한다.

- **제안**: `assertInboundSigningPlaintextByProvider` 에 `isCreate: boolean` 파라미터를 추가하거나 update 경로에서는 `inboundSigningPlaintext` 가 없을 경우 검증을 skip (기존 ref 유지) 하도록 분기할 것. 또는 project-planner 에게 spec `15-chat-channel.md §5.4.1` 에 `inboundSigning` PATCH 정책을 명시할 것을 위임.

---

### [WARNING] Discord 문서 slash command 개수 불일치 — spec §3.1 에는 `start/cancel/help` 3종, 문서/구현에는 `start/cancel/help/reply` 4종

- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` (line ~646), `discord.mdx` (line ~708), `spec/4-nodes/7-trigger/providers/discord.md §3.1`
- **상세**: spec §3.1 의 `setupChannel` 코드 블록은 `options` 에 `start / cancel / help` 3개만 등록한다. 그러나 docs 는 `start / cancel / help / reply` 4종을 나열하고 spec §5.1 은 `/<prefix> reply <message>` slash command 가 v1 의 주요 reply 경로임을 명시한다. `reply` 는 spec §5.1 에 normative 하게 기술돼 있으므로 §3.1 의 `options` 배열에서 누락된 것이 spec fidelity 문제다. 이 불일치는 pre-existing (PR #300) 이지만 이번 변경의 문서 수정에서도 4종을 그대로 표기하고 있어 확인이 필요하다.
- **제안**: spec §3.1 의 `options` 배열에 `reply` sub-command 를 추가하거나, docs 의 4종 표기를 3종으로 수정할 것. project-planner 위임.

---

### [WARNING] `inboundSigningPlaintext` 가 응답에 strip 되지만 initial save 에 대한 SS-SE-01 unit test 부재

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` line ~885
- **상세**: SS-SE-01 test (`'slack — plaintext 가 trigger.config 에 흘러가지 않음'`) 는 `triggerRepository.update` (setupChatChannel 의 최종 update) 만 검사하고, `triggerRepository.save` (create() 의 최초 insert) 에 `inboundSigningPlaintext` 가 포함되는지를 검증하지 않는다. 따라서 위의 CRITICAL 항목(최초 save 시 plaintext 기록)은 test suite 로 잡히지 않는다.
- **제안**: `triggerRepository.save.mock.calls[0]` 의 config에도 `inboundSigningPlaintext` / `botToken` 이 없음을 검증하는 assertion 추가.

---

### [WARNING] Discord `setupChannel` — `GET /applications/@me` 응답의 public_key 와 사용자 입력값 불일치 시 처리 경로 불명확

- **위치**: `spec/4-nodes/7-trigger/providers/discord.md §3.1` — "사용자 입력 public_key 와 일치 확인 (불일치 시 BOT_TOKEN_INVALID error)"
- **상세**: spec §3.1 은 `GET /applications/@me` 응답의 `public_key` 와 사용자가 입력한 `inboundSigningPlaintext` 를 비교해 불일치 시 `BOT_TOKEN_INVALID` 에러를 던지도록 명시한다. 그러나 이 검증이 실제 구현(`discord.adapter.ts`)에 존재하는지 이번 변경 범위에서 확인하기 어렵다 (파일 diff 누락). 일관성 검토도 `BOT_TOKEN_INVALID` throw 코드가 backend 에 없을 수 있다고 지적했다. spec 과 구현 간 gap 이 존재할 경우 CRITICAL 로 격상될 수 있다.
- **제안**: discord.adapter.ts 의 `setupChannel` 에서 `public_key` 비교 + `BOT_TOKEN_INVALID` throw 가 구현됐는지 검증. 미구현 시 이번 PR 에 포함하거나 별 추적 항목 신설.

---

### [INFO] 프론트엔드 `formChatChannelInboundSigningPlaintext` 상태가 provider 변경 시 초기화되지 않음

- **위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` provider `<select>` onChange handler
- **상세**: 사용자가 provider 를 slack → telegram 으로 변경하면 `formChatChannelInboundSigningPlaintext` 상태의 이전 값이 그대로 유지된다. telegram 에서는 해당 필드가 전송되지 않으므로 기능 버그는 아니지만, 사용자가 다시 slack 으로 돌아올 때 이전에 입력한 signing secret 이 그대로 표시된다. 보안 민감도가 높은 필드인 점을 고려하면 provider 변경 시 초기화하는 것이 더 안전하다.
- **제안**: provider `<select>` 의 `onChange` handler 에 `setFormChatChannelInboundSigningPlaintext("")` 추가.

---

### [INFO] spec/conventions/secret-store.md §5.5 와 코드의 `inboundSigningRef` 네이밍 — `buildSecretRef` 미사용

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel()` (line ~468)
- **상세**: spec §5.5 (b) 의 예시 코드는 `buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' })` 패턴을 사용한다. 구현에서는 backtick 리터럴 `secret://triggers/${trigger.id}/inbound-signing` 을 직접 사용하고 있다. botTokenRef 도 같은 패턴을 쓰므로 신규 추가된 inboundSigningRef 도 일관성 유지 필요.
- **제안**: `buildSecretRef` helper 를 사용해 ref 를 생성하도록 변경. 기능 차이는 없으나 향후 URI scheme 변경 시 단일 지점에서만 수정하면 된다.

---

### [INFO] 클라이언트 사이드 hex 형식 검증에 `i` flag 사용 — 서버 측 오류 메시지와 대소문자 일관성 불명확

- **위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` (line ~270), `codebase/backend/src/modules/triggers/triggers.service.ts` `assertInboundSigningPlaintextByProvider()` (line ~293, ~302)
- **상세**: 양쪽 모두 `/^[a-f0-9]{32}$/i` 와 `/^[a-f0-9]{64}$/i` 로 대소문자 무관하게 검증하지만 오류 메시지와 placeholder 는 소문자만 보여준다 (예: `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`). 대문자를 입력해도 통과하나 안내 메시지는 소문자 예시만 제공한다. 기능 오류는 아니나 UX 명확성 관점에서 hex 32 / hex 64 (대소문자 허용) 로 안내하는 것이 명확하다.
- **제안**: i18n 도움말 문자열에서 "hex 32 chars" → "hex 32 chars (대소문자 무관)" 또는 오류 메시지를 소문자 변환 후 검증 (`plaintext.toLowerCase()`) 으로 통일.

---

## 요약

본 변경은 chat-channel multi-provider (telegram / slack / discord) 의 프론트엔드 UI + 백엔드 DTO / service 진입 허용을 구현하고 있으며, spec `providers/_overview.md §1` 의 세 provider 열거, `secret-store.md §5.5 (b)` 의 provider-issued plaintext 흐름, `providers/{slack,discord}.md §6` 의 `inboundSigningRef` 단일 슬롯 정책과 전반적으로 일치한다. 그러나 두 가지 CRITICAL 문제가 머지 차단 수준이다. 첫째, 워크트리가 main 에 이미 머지된 PR #305 (spec §12.7 formData cap) 와 PR #306 (emailVerified e2e) 을 포함하지 않아 그대로 머지하면 두 기능이 회귀한다. 둘째, `inboundSigningPlaintext` plaintext 가 최초 `triggerRepository.save` 시 DB JSONB 에 기록되는 시간 창이 존재해 SS-SE-01 ("plaintext 는 application 메모리 안에서만") 을 위반한다. 추가로 Slack signing secret 의 hex-32 형식 요구사항이 spec 에 명시되지 않아 코드가 spec 보다 앞서간다. PATCH 경로에서 slack/discord 의 `inboundSigningPlaintext` 를 무조건 필수로 요구하는 것도 기존 트리거 수정 시나리오에서 불필요한 부담을 준다.

---

## 위험도

CRITICAL

STATUS: OK
