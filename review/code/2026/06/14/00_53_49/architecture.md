# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** `extractFormTitle` 과 `extractFormFields` 의 dual-shape 처리 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `extractFormTitle` 함수
  - 상세: `formConfig` 의 두 shape (`{ title }` 직접 / `{ config: { title } }` nodeOutput wrapping)를 해석하는 로직이 `extractFormFields` 와 구조적으로 동일한 패턴을 중복 구현한다. 현재는 두 함수가 각각 독립적으로 `root` → `root.config` 연쇄를 순회한다. 지금 두 함수만 있어 실질적 문제는 없지만, shape 가 세 번째 wrapping 수준이 생기거나 config shape 정의가 바뀌면 두 곳을 동시에 수정해야 한다.
  - 제안: 공통 shape-resolver 헬퍼(`resolveFormConfigRoot(formConfig): Record<string,unknown> | null`)를 내부 함수로 추출하고, `extractFormFields` / `extractFormTitle` 이 이를 재사용하도록 리팩터링. 단, 변경 범위가 작아 급하지 않음 — INFO 수준.

### 발견사항 2
- **[INFO]** `ChatChannelDispatcher.handle` 내 IIFE를 이용한 conditional spread
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, 라인 310–315 (변경된 코드)
  - 상세: `...(() => { const title = extractFormTitle(...); return title ? { title } : {}; })()` 패턴은 가독성을 낮추고 의도를 모호하게 한다. optional property assignment 를 표현하는 더 명확한 방법이 있다.
  - 제안: 변수를 먼저 선언한 뒤 조건부로 할당하는 방식을 사용한다. 예:
    ```ts
    const title = extractFormTitle(modalFormConfig);
    state.pendingFormModal = {
      nodeId: channelEvent.node.id,
      fields: extractFormFields(modalFormConfig),
      ...(title !== undefined && { title }),
    };
    ```
    이미 `modalFormConfig` 를 변수로 분리한 개선은 긍정적이며, 같은 맥락에서 title 도 변수로 뽑아 spread 간소화 권장.

### 발견사항 3
- **[INFO]** `botIdentity.publicKey` 가 공유 타입 `ChatChannelConfig` 에 Discord 전용 필드로 위치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/types.ts`, `ChatChannelConfig.botIdentity`
  - 상세: `publicKey?` 필드는 Discord 전용(`ed25519 public key`)이고 주석에도 `(Discord)` 라고 명기돼 있다. 현재 공유 인터페이스 내부에 provider-specific 필드가 혼재하는 패턴. 아직 provider 수가 적어 실질적 문제는 없지만, provider 가 늘어나면 공유 타입이 오염된다.
  - 제안: 장기적으로는 `providerMeta?: Record<string, unknown>` 또는 `discordMeta?: { publicKey?: string }` 같은 분리된 슬롯을 고려. 단 현재 규모에서는 BREAKING CHANGE 비용 대비 효용이 낮음 — INFO 수준 관찰.

### 발견사항 4
- **[INFO]** `openFormModal` 내 `modalKind` 분기와 title/length 처리 순서
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`, `openFormModal` 메서드
  - 상세: `modalKind === 'reply'` 분기가 early return 으로 처리되고 나머지 로직이 form modal 경로를 다루는 구조는 명확하다. 다만 `rawTitle` 의 `params.title ?? params.config.languageHints?.formModalTitle ?? '양식'` fallback chain 이 메서드 내부에 인라인으로 있어, 다른 provider(Slack 등)가 동일 계약의 `openFormModal` 을 구현할 때 동일 fallback 로직을 다시 구현하게 된다.
  - 제안: title fallback 결정 로직을 `OpenFormModalParams` 와 함께 `form-mode.ts` 의 shared 헬퍼나 `types.ts` 의 유틸로 분리 검토. 단 현재는 Discord 단일 구현이므로 시기상조 — INFO.

### 발견사항 5
- **[INFO]** `languageHints` 가 `Record<string, string>` open type으로 선언된 상태에서 `formModalTitle` 키 참조
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/types.ts`, `ChatChannelConfig.languageHints`
  - 상세: `languageHints` 는 `Record<string, string>` open map 이며 jsdoc 에 known key 들이 나열되어 있으나 `formModalTitle` 은 jsdoc에 미등재이다. `openFormModal` 에서 `params.config.languageHints?.formModalTitle` 로 접근하는데, TypeScript 는 임의 string key 에 `string | undefined` 를 반환하므로 타입 에러는 없지만 공식 계약(jsdoc 열거)에 키가 누락됐다.
  - 제안: `languageHints` jsdoc 에 `formModalTitle` 과 `replyModalTitle`, `replyModalLabel` 키를 추가해 계약을 완전하게 기술. 코드 변경 없이 문서만 보완 가능.

---

## 요약

이번 변경은 Discord chat-channel 어댑터의 세 가지 gap(§3.1 publicKey 캐시, §3.3 modal title 동적화 및 TEXT_INPUT 길이 제약, §5.1(b) Reply 버튼 확인) 을 spec-sync 범위 내에서 처리한다. 아키텍처 관점에서 전체 레이어 책임 분리는 잘 유지되어 있다 — `form-mode.ts` 는 provider-invariant 정규화 전담, `chat-channel.dispatcher.ts` 는 이벤트 fan-out 및 state 갱신, `discord.adapter.ts` 는 Discord API 매핑으로 역할이 명확히 분리된다. `extractFormTitle` 추가는 `extractFormFields` 와 동일한 dual-shape 처리 패턴을 따르며 일관성이 있다. 소규모 개선 관찰사항(IIFE 대신 단순 변수 spread, provider-specific 필드의 공유 타입 오염 가능성, languageHints jsdoc 갱신 필요)은 모두 INFO 수준이며 현재 구조를 차단하는 CRITICAL/WARNING 사항은 없다.

## 위험도

NONE
