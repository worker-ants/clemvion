# 신규 식별자 충돌 검토 — spec/7-channel-web-chat/2-sdk.md

## 발견사항

- **[INFO]** `ChatInstance.on()` 반환 타입 — spec vs 코드 미일치
  - target 신규 식별자: `on(event, cb)` → 구독 해제 함수 반환 (spec §1 · §2 모두 명시)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/packages/web-chat-sdk/src/types.ts` `ChatInstance` 인터페이스 — `on(event: WidgetEvent, cb: ...): void` (반환 타입 `void`)
  - 상세: spec 은 `on()` 이 `Unsubscribe` (해제 함수)를 반환한다고 명시하나, `types.ts` 의 `ChatInstance` 인터페이스는 `void` 반환으로 선언돼 있다. `Unsubscribe` 타입은 같은 파일에 정의돼 있으나 `ChatInstance.on` 시그니처에 연결되지 않았다. npm 소비자가 `const un = chat.on(...)` 패턴을 사용하면 TypeScript 타입 에러가 발생한다.
  - 제안: `types.ts` 의 `ChatInstance.on` 반환 타입을 `Unsubscribe` 로 변경.

- **[INFO]** `off()` 시그니처 — spec 에 공식 API 로 명시, `ChatInstance` 인터페이스에 누락
  - target 신규 식별자: `off(event, cb?)` / `off(event)` — spec §1 §2 모두 명시
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/codebase/packages/web-chat-sdk/src/types.ts` — `ChatInstance` 에 `off` 선언 없음. `ClemvionChatMethod` union 에는 `'off'` 포함, `index.ts` 구현체에도 `off` 있음.
  - 상세: 의미 충돌은 없으나 공개 인터페이스 타입에 누락. npm 소비자가 타입 안전하게 `chat.off(...)` 호출 불가.
  - 제안: `ChatInstance` 에 `off(event: WidgetEvent, cb?: (payload: unknown) => void): void` 추가.

- **[INFO]** `wc:resize` payload `state: 'expanded'` — Graph RAG 의 `origin: 'expanded'` 와 단어 공유
  - target 신규 식별자: `wc:resize` 메시지 페이로드 `state: 'collapsed' | 'expanded'`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/channel-web-chat-followups-1feff2/spec/5-system/10-graph-rag.md` — KB 그래프 청크 origin 마커 `'seed' | 'expanded'`
  - 상세: 도메인이 완전히 다르다(postMessage payload vs KB 검색 메타). 런타임·코드 충돌 없음. 조치 불필요.
  - 제안: 조치 불필요.

## 요약

target 문서(`spec/7-channel-web-chat/2-sdk.md`)가 도입하는 식별자(`web-chat-sdk` frontmatter id, `BootConfig` 인터페이스, `ClemvionChat` 전역명, `wc:*` postMessage 네임스페이스, `@workflow/web-chat` npm 패키지명)는 기존 spec·코드베이스에서 동일 식별자가 다른 의미로 쓰이는 사례가 없다. `BootConfig` 는 해당 패키지(`codebase/packages/web-chat-sdk`) 내에서만 사용되며, `wc:` 네임스페이스는 Chat Channel(server-side) 및 내부 WebSocket 프로토콜과 겹치지 않는다. 발견된 INFO 2건은 식별자 충돌이 아닌 spec 이 명시한 `on()` 반환 타입과 `off()` 메서드가 `ChatInstance` TypeScript 인터페이스에 반영되지 않은 spec↔코드 타입 서명 미일치다.

## 위험도

LOW
