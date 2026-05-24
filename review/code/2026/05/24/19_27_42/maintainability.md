# 유지보수성(Maintainability) 코드 리뷰

리뷰 일자: 2026-05-24  
대상 PR: trigger-create-multi-provider-ui (Chat Channel 3 provider 지원 + AI Agent formData cap 제거)

---

## 발견사항

### [WARNING] `assertInboundSigningPlaintextByProvider` — 분기 구조가 암묵적 "기타 provider = provider-issued" 전제를 내포
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 261–309
- **상세**: 함수는 `telegram` 을 early-return 으로 처리한 뒤, 나머지(`slack` / `discord`)를 단일 블록으로 묶어 "provider-issued, 사용자 입력 필수" 로직을 적용한다. 이는 현재 `CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord']` 세 값만 있을 때는 정확하지만, 향후 `provider === 'telegram'` 이 아닌 신규 provider 가 추가될 경우 — 예를 들어 서버 발급 방식의 provider 가 추가된다면 — 그 provider 가 자동으로 "provider-issued 필수" 분기에 빠지게 된다. 이 암묵적 전제가 함수 시그니처나 주석에 충분히 명문화되어 있지 않아 실수를 유발할 수 있다.
- **제안**: slack/discord 분기를 명시적으로 열거하거나(`provider === 'slack' || provider === 'discord'`), 최종 `else` 절에 `// 알 수 없는 provider — DTO @IsIn 에서 이미 차단됨, 여기 도달 불가` 형태의 exhaustiveness guard 주석 또는 `// istanbul ignore next` 처리를 추가한다. 또는 telegram 이 아닌 provider 를 명시적으로 `const providerIssuedProviders = ['slack', 'discord'] as const` 상수로 분리해 early-exit 패턴을 대칭적으로 만든다.

---

### [WARNING] `sanitizeChatChannelForResponse` — destructure 패턴의 "사용하지 않는 변수" 냄새
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 329–351
- **상세**: 응답 strip 대상 필드들이 destructure 변수명에 `_` prefix 로 폐기된다:
  ```ts
  const {
    botTokenRef,
    inboundSigningRef: _inboundSigningRef,
    inboundSigning: _inboundSigning,
    inboundSigningPlaintext: _inboundSigningPlaintext,
    ...rest
  } = cfg.chatChannel;
  ```
  `botTokenRef` 만 실제로 사용되고 (`hasBotToken` derived 필드), 나머지 세 개는 `_` prefix 를 달아 버린다. 이 패턴은 "무엇을 제거하는가" 를 destructure 목록으로 표현해 하나의 목적(선택적 사용 + 나머지 제거)을 혼용하는 구조다. 이미 PR #300 에서도 동일 패턴이 있었지만, 이번 PR 에서 `inboundSigningPlaintext` 필드가 추가되어 목록이 4개로 늘었다. 새 provider 가 추가될 때마다 strip 목록을 직접 수정해야 해 누락 위험이 증가한다.
- **제안**: 명시적 "allow-list" 접근으로 반전시킨다 — strip 할 키 집합을 상수로 선언하고 `Object.fromEntries(Object.entries(cfg.chatChannel).filter(([k]) => !STRIP_KEYS.has(k)))` 로 처리하면 새 필드 추가 시 상수 하나만 갱신하면 된다. 또는 `hasBotToken` derive 는 별도로 수행하고 `delete` 연산자를 복사본에만 적용하는 방식도 가독성을 높인다.

---

### [WARNING] 프론트엔드 inbound-signing 섹션 — 두 개의 동일 구조 블록 중복
- **위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 473–522
- **상세**: Slack inbound-signing 입력 블록(라인 473–497)과 Discord 입력 블록(라인 498–522)이 구조적으로 완전히 동일하다. 두 블록의 차이는 `htmlFor` 값(`webhook-chat-channel-signing`으로 동일 — 추가 버그), i18n 키 suffix(`Slack` vs `Discord`), placeholder 뿐이다. 동일한 `<div>` 구조, `<Input>` props, `<p>` help text 패턴이 그대로 반복된다.
- **제안**: provider-conditional 렌더를 단일 블록으로 추출한다:
  ```tsx
  {formChatChannelProvider !== "telegram" && (
    <div>
      <Label htmlFor="webhook-chat-channel-signing">
        {formChatChannelProvider === "slack"
          ? t("triggers.chatChannel.inboundSigningLabelSlack")
          : t("triggers.chatChannel.inboundSigningLabelDiscord")}
      </Label>
      <Input ... placeholder={...} />
      <p ...>{...}</p>
    </div>
  )}
  ```
  이렇게 하면 새 provider 추가 시 조건만 수정하면 된다.

---

### [WARNING] 프론트엔드 `htmlFor` 중복 — 접근성 버그 내포
- **위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 476, 501
- **상세**: Slack 섹션과 Discord 섹션 모두 `id="webhook-chat-channel-signing"` 을 사용한다. 두 섹션은 조건부 렌더로 동시에 표시되지 않기 때문에 실제 DOM 충돌은 없지만, 동일한 id 문자열 하드코딩은 향후 두 섹션이 동시에 렌더되는 시나리오(예: multi-provider 동시 설정)나 e2e 테스트 선택자 작성 시 혼란을 준다.
- **제안**: `id` 를 `webhook-chat-channel-signing-${formChatChannelProvider}` 또는 provider-aware 상수로 구분한다.

---

### [INFO] `handleCreate` 내 클라이언트 검증 — 정규식 리터럴 인라인 중복
- **위치**: `codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 281–283
- **상세**: 
  ```ts
  const expectedHex =
    formChatChannelProvider === "slack" ? /^[a-f0-9]{32}$/i : /^[a-f0-9]{64}$/i;
  ```
  이 정규식 패턴은 백엔드 `assertInboundSigningPlaintextByProvider` (라인 292, 301) 와 `chat-channel-config.dto.ts` JSDoc (라인 98–99) 에도 동일하게 기술되어 있다. 유지보수 시 세 곳을 동시에 수정해야 한다.
- **제안**: 프론트엔드에서는 i18n 포맷 힌트 키(`inboundSigningFormatHelpSlack` 등)가 이미 정규식 설명을 포함하고 있으므로, 클라이언트 검증 중 "길이 0 여부" 만 체크하고 포맷 검증은 백엔드 400 에 의존하는 것도 단순화 방안이다. 단 UX 친절도 트레이드오프가 있으므로 결정은 팀 판단.

---

### [INFO] `setupChatChannel` — `providerIssuedPlaintext` 타입 단언 이중 적용
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 468–473
- **상세**: 
  ```ts
  const providerIssuedPlaintext = (
    chatChannelCfg as ChatChannelConfigDto & {
      inboundSigningPlaintext?: string;
    }
  ).inboundSigningPlaintext;
  ```
  `ChatChannelConfigDto` 에 `inboundSigningPlaintext?: string` 필드가 이번 PR 에서 정식 추가되었다(`chat-channel-config.dto.ts` 라인 121). 그런데 `setupChatChannel` 파라미터 타입은 여전히 `ChatChannelConfigDto` 를 받으면서 intersection 타입 캐스트를 한다. 이는 DTO 에 이미 필드가 있음에도 "없는 것처럼" 처리하는 낡은 방어 코드다.
- **제안**: `chatChannelCfg.inboundSigningPlaintext` 로 직접 접근하고 타입 단언을 제거한다.

---

### [INFO] `sanitizeChatChannelForResponse` — `Object.assign(Object.create(...))` 패턴의 가독성
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 344–351
- **상세**: prototype 체인을 보존하기 위해 `Object.assign(Object.create(Object.getPrototypeOf(trigger)), trigger, {...})` 패턴을 사용한다. 이는 기능적으로 올바르지만 의도가 한눈에 들어오지 않는다. 이 패턴이 이미 PR #300 부터 존재했고 이번 PR 에서 제거 대상 필드 하나(`inboundSigningPlaintext`)가 추가되었을 뿐이므로 이번 PR 이 도입한 문제는 아니나, 향후 변경 시 누락 위험이 있다.
- **제안**: 내부 주석 "// entity 의 메서드/getter 를 보존하기 위해 prototype 유지" 는 이미 있다. 허용 가능한 수준이나, Trigger entity 에 Getter 가 없다면 단순 객체 스프레드로 단순화하는 것을 중장기적으로 검토.

---

### [INFO] 삭제된 `capFormDataBytes` 함수 — spec §12.7 / `0-common.md §10.9` 의 동반 제거 확인됨
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (삭제), `spec/4-nodes/3-ai/1-ai-agent.md §12.7` (삭제), `spec/4-nodes/6-presentation/0-common.md §10.9` (롤백)
- **상세**: `capFormDataBytes` 함수와 `FORM_SUBMITTED_MAX_BYTES` 상수가 코드, spec, 테스트 세 계층 모두에서 일관되게 제거되었다. spec §12.7 전체 절과 `0-common.md §10.9` (4) layer 행의 `formDataTruncation` 보강이 동시에 롤백되었음을 확인. 삭제 일관성은 좋다.
- **제안**: 없음 — 단순 확인 사항.

---

### [INFO] `e2e-chat-channel-fixture.ts` — `ownerEmailVerified` 옵션 제거 후 `true` 하드코딩
- **위치**: `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` 라인 61
- **상세**: 이전에 `ownerEmailVerified?: boolean` 파라미터로 분기하던 것이 `true` 하드코딩으로 단순화되었다. 해당 파라미터가 필요했던 "owner.emailVerified=false trigger 의 inbound (PING)" e2e 케이스도 함께 제거되어 한쌍으로 정합하다. 다만 JSDoc 의 해당 옵션 설명(라인 13–17 삭제)도 함께 제거됨으로써 "inbound 는 public route — owner.emailVerified 무관" invariant 의 문서화 위치가 사라졌다.
- **제안**: 이 invariant 는 이제 코드와 e2e 케이스 어디에도 명문화되어 있지 않다. `hooks.controller.ts` 또는 `setupChatChannel` 진입 주석에 "inbound webhook 은 public route — trigger.secret 기반 검증만" 한 줄을 남기는 것을 고려한다.

---

## 요약

이번 PR 의 핵심 신규 코드(`assertInboundSigningPlaintextByProvider`, `sanitizeChatChannelForResponse` 확장, 프론트엔드 provider 선택 UI)는 전반적으로 의도가 명확하고 spec 주석이 충실하다. 가장 주목할 유지보수성 문제는 두 가지다. 첫째, `assertInboundSigningPlaintextByProvider` 가 `telegram` early-return 이후 나머지를 암묵적 "provider-issued 필수" 로 처리해 4번째 provider 추가 시 무음 오동작 가능성이 있다. 둘째, 프론트엔드의 Slack/Discord inbound-signing 입력 섹션이 동일 구조로 두 번 반복되어 향후 변경 시 한 곳만 수정하는 실수를 유발한다. `sanitizeChatChannelForResponse` 의 destructure strip 패턴도 새 필드 추가 시 누락 위험이 있어 allow-list 방식으로의 전환을 권장한다. 타입 단언 이중 적용(`setupChatChannel` 내 `inboundSigningPlaintext` 캐스트)은 DTO 정의와 어긋나는 낡은 코드로 정리가 필요하다.

---

## 위험도

MEDIUM

STATUS: OK
