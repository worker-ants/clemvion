## 발견사항

### [CRITICAL] npm 패키지명 `@workflow/web-chat` — 기존 spec/코드에서 `@clemvion/web-chat`(잠정)으로 선언 중

- **target 신규 식별자**: `@workflow/web-chat` (target 문서 §2, 제목 상단 주석, Rationale R2)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` (현 파일, 기존 버전) — `@clemvion/web-chat` (잠정 표기)
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/_product-overview.md` §2, §4 — `@clemvion/web-chat(잠정 scope)` 두 곳에서 명시
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md` §4 — `@clemvion/web-chat 잠정` 표기
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/package.json` line 2 — `"name": "@clemvion/web-chat"` (코드 실제 적용값, `//name` 코멘트로 잠정 표기 중)
- **상세**: target 문서는 `@workflow/web-chat` 으로 scope 를 확정·기록하고 있으나, 기존 spec 3파일과 package.json 은 여전히 `@clemvion/web-chat` (잠정) 으로 되어 있다. target 이 단방향으로만 반영되면 동일 패키지를 두 이름으로 지칭하는 분기가 발생한다.
- **제안**: target 문서 변경과 함께 `_product-overview.md`, `0-architecture.md`, `codebase/packages/web-chat-sdk/package.json` 의 `@clemvion/web-chat` 표기를 모두 `@workflow/web-chat` 으로 동시 일괄 교체해야 한다. plan `channel-web-chat-impl.md` §진입조건 주석("spec sync 는 followup C-2 에서 일괄 처리")과 일치하므로 해당 followup 에서 반드시 처리.

---

### [WARNING] `ChatInstance` 인터페이스 — `on()` 반환 타입 변경 (기존 `void` → `Unsubscribe`)

- **target 신규 식별자**: `type Unsubscribe = () => void` + `on(...): Unsubscribe` (target 문서 §5)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/types.ts` line 62 — `on(event: WidgetEvent, cb: (payload: unknown) => void): void`
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/loader.ts` line 50 — `instance?.on(...)` 반환값 미사용 (void 가정)
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/index.ts` line 100 — `bridge.on(...)` 반환 void
- **상세**: target 은 `on()` 이 구독 해제 함수(`Unsubscribe`)를 반환해야 한다고 명세하지만, 기존 코드의 `ChatInstance.on()` 은 `void` 반환이고 `bridge.on()` 도 반환값이 없다. API 표면이 다르므로 호스트 코드가 target 명세를 신뢰하고 `const un = chat.on(...)` 패턴을 사용하면 실제로는 `undefined` 를 얻는다. `Unsubscribe` 타입명 자체는 codebase 내 다른 충돌 없음.
- **제안**: spec 변경에 맞춰 `types.ts` 의 `ChatInstance.on()` 반환 타입을 `Unsubscribe` 로 변경하고, `bridge.on()` 도 해제 함수를 반환하도록 구현 업데이트 필요.

---

### [WARNING] `off()` 메서드 — 기존 `ClemvionChatMethod` 열거·`ChatInstance` 인터페이스에 미존재

- **target 신규 식별자**: `off(event, cb?)` 메서드 — `ChatInstance` 멤버 및 전역 큐 dispatch 대상 (`ClemvionChat('off', ...)`) (target 문서 §1·§5)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/types.ts` — `ClemvionChatMethod` 열거에 `"off"` 없음, `ChatInstance` 에 `off()` 없음
  - `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/loader.ts` — `createGlobalApi` dispatch `switch` 에 `"off"` case 없음
- **상세**: target 이 `off()` 를 공개 인스턴스 타입 계약과 전역 함수 dispatch 양쪽에 정의하지만, 기존 코드에는 전혀 없는 신규 메서드이다. `off` 라는 이름이 기존 `on` 과 의미상 쌍이어서 spec 완성 후 구현도 추가돼야 한다.
- **제안**: spec 확정 후 `types.ts` `ChatInstance` 에 `off(event: WidgetEvent, cb?: ...) → void` 추가, `ClemvionChatMethod` 열거에 `"off"` 추가, `createGlobalApi` switch 에 `"off"` case 추가.

---

### [WARNING] `wc:command` payload — `show`/`hide` action 추가 (기존 spec vs 기존 코드 불일치)

- **target 신규 식별자**: `wc:command` 페이로드 action 열거에 `show`/`hide` 추가 (target §3)
- **기존 사용처**:
  - 기존 spec `2-sdk.md` §3 (현 파일, 이전 버전): `wc:command` action 목록 `open`/`close`/`sendMessage(text)`/`updateProfile`/`shutdown` — `show`/`hide` 없음
  - `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/host-bridge.ts` — `wc:command` 수신 핸들러에 `show`/`hide` case 미존재
- **상세**: target 은 `wc:command` 에 `show`/`hide` action 을 추가했는데, 기존 spec 및 iframe 측 `host-bridge.ts` 에는 이 두 action 이 없다. 동일 메시지 `type` 에 대한 action 목록 확장이므로 명시적 충돌은 아니나, iframe 측 handler 가 `show`/`hide` case 를 구현하지 않으면 수신 후 무시된다.
- **제안**: target 명세 확정 후 `codebase/channel-web-chat/src/widget/host-bridge.ts` 의 `wc:command` 핸들러에 `show`/`hide` case 추가 및 테스트 보강.

---

### [INFO] `data-global` 속성 — 신규 HTML 속성 이름, 기존 spec/코드 충돌 없음

- **target 신규 식별자**: loader `<script data-global="...">` 속성을 통한 전역명 재지정 (target §1)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/loader.ts` — `installGlobal` 함수는 현재 `win.ClemvionChat` 하드코딩, `data-global` 읽기 없음
- **상세**: 충돌은 없다. 기존 `installGlobal` 함수 시그니처가 `(win?, bootFn?) → GlobalApi` 인데, target 명세는 `script[data-global]` 을 읽어 전역 이름을 결정하는 로직 추가를 요구한다.
- **제안**: 구현 단계에서 `loader-entry.ts` 에서 `document.currentScript?.dataset.global` 을 읽어 전달하는 경로 추가. 기존 `installGlobal` 시그니처 확장 필요.

---

### [INFO] `@workflow/web-chat` 과 `@workflow/sdk` — 같은 scope 다른 패키지, 충돌 없음

- **target 신규 식별자**: `@workflow/web-chat` (npm scope `@workflow/*` 아래 신규 패키지)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/packages/sdk/package.json` — `"name": "@workflow/sdk"` (EIA 클라이언트)
- **상세**: 두 패키지는 같은 scope 이지만 이름이 다르고 의존 방향(`web-chat → sdk`)이 명확하다. 충돌 없음.

---

## 요약

target 문서(`spec/7-channel-web-chat/2-sdk.md`)가 도입하는 신규 식별자 중 가장 시급한 충돌은 npm 패키지 scope 불일치다 — target 은 `@workflow/web-chat` 으로 확정 기록하지만 기존 spec 3파일(`_product-overview.md`, `0-architecture.md`, 현 `2-sdk.md`)과 `package.json` 은 `@clemvion/web-chat`(잠정)을 그대로 유지하고 있어 두 이름이 동시에 SoT 역할을 한다. 이 분기는 plan `channel-web-chat-followups.md` §7-b followup C-2 에서 반드시 일괄 해소해야 한다. 그 외에는 `on()` 반환 타입(`void → Unsubscribe`)과 신규 `off()` 메서드·`wc:command` action 확장이 기존 구현과 갭을 형성하지만, 이는 새 spec 확정에 따른 구현 업데이트 대상이며 다른 영역 식별자와의 의미 충돌은 없다. postMessage `wc:*` 이름과 `ChatInstance`/`BootConfig`/`WidgetEvent` 타입명은 해당 도메인(`web-chat-sdk/`, `channel-web-chat/`) 내에서만 사용되어 다른 영역과 충돌하지 않는다.

## 위험도

MEDIUM

STATUS: OK
