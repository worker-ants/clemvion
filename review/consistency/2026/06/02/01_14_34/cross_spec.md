# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat/2-sdk.md` (draft)
검토 일시: 2026-06-02

---

## 발견사항

### [CRITICAL] npm 패키지명 단독 확정 선언 — `eia-sdk-publish.md` 미결 상태와 직접 모순

- **target 위치**: draft 문서 상단 callout (`> **npm scope 확정**: 패키지명은 @workflow/web-chat — eia-sdk-publish.md §결정 #3 에서 … 2026-06-02`), §2 섹션 헤딩 및 코드 예시 (`@workflow/web-chat`)
- **충돌 대상**:
  - `plan/in-progress/eia-sdk-publish.md` — `§사용자 결정 사항` 3번 항목("Package scope: (a) `@workflow/sdk` 현재 일관성 / (b) `@clemvion/sdk` 외부 브랜드")이 여전히 미결. `§결정` 섹션 자체가 파일에 존재하지 않는다.
  - `spec/7-channel-web-chat/_product-overview.md` §4 표 — `@clemvion/web-chat`(잠정) 표기 유지
  - `spec/7-channel-web-chat/0-architecture.md` §4 — `@clemvion/web-chat` 잠정 + `eia-sdk-publish.md` 결정 종속
- **상세**: draft 는 `eia-sdk-publish.md §결정 #3` 을 이미 완료된 결정으로 인용해 `@workflow/web-chat` 을 확정 표기한다. 그러나 실제 plan 파일에는 해당 결정이 기록된 §결정 섹션이 없고, 의사결정 선택지(a/b)가 미선택 상태로 남아 있다. draft 가 확정으로 선언한 상태에서 _product-overview.md 와 0-architecture.md 는 여전히 잠정(`@clemvion/web-chat`)을 가리키므로, 세 파일이 동시에 SoT 가 될 수 없는 직접 모순이다.
- **제안**:
  1. `eia-sdk-publish.md` 에 `§결정 사항` 표를 실제로 작성하고 결정 #3 을 확정한 뒤 draft 를 반영하거나,
  2. draft 상단 callout 을 기존 잠정 표기(`@workflow/web-chat` (잠정, eia-sdk-publish.md §결정 #3 확정 종속))로 되돌리고 _product-overview.md·0-architecture.md 와 동기화한다.
  두 경우 모두 `_product-overview.md` §4 표의 `@clemvion/web-chat`(잠정) 도 함께 갱신해야 일관된다.

---

### [WARNING] `wc:command` postMessage 에 `show`/`hide` 추가 — 기존 spec 미정의 커맨드

- **target 위치**: draft §3 postMessage 프로토콜 표, `host → iframe` `wc:command` 행
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md` (현행) §3 `wc:command` — `open`/`close`/`sendMessage(text)`/`updateProfile`/`shutdown` 만 정의
- **상세**: draft 는 `wc:command` 페이로드에 `show`/`hide` 를 추가한다. 현행 spec 은 이 두 커맨드를 `wc:command` 로 iframe 에 전달하는 경로를 정의하지 않는다. `show`/`hide` 의 의미("런처 가시성 토글, 위젯 자체를 페이지에서 숨김")는 draft §1 에 새로 도입된 구분이므로, iframe 내부(위젯 SPA)가 이 커맨드를 수신해 런처 DOM 을 숨기는 처리가 `1-widget-app.md` 상태기계에 명시되지 않았다.
- **제안**: `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계에 `show`/`hide` 커맨드 수신 전이(예: `show` → 런처 표시, `hide` → 런처 숨김, `hide` 상태에서 `open` 무효)를 추가해야 양 spec 이 정합된다. draft 단독으로 `wc:command` 를 확장하면 1-widget-app 상태기계와 어긋난다.

---

### [WARNING] 현행 `off()` 미정의 공개 API 추가 및 `on()` 반환 타입 변경

- **target 위치**: draft §1 (`off(event, cb?)` 설명), §2 코드 예시 (`unsubscribe()`, `chat.off('unread')`), §5 `ChatInstance` 타입 (`on()` 반환 `Unsubscribe`, `off()` 메서드)
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md` (현행) §1·§2 — `on(event, cb)` 는 반환값 미정의, `off()` 미존재. 현행 코드 예시에서 `chat.on(...)` 반환값을 캡처하지 않음.
- **상세**: draft 는 공개 인스턴스 타입에서 `on()` 이 `Unsubscribe` 를 반환하고 `off()` 를 추가 메서드로 정의한다. 이는 기존 코드 예시(`chat.on('message', ...)` 반환값 없음)와의 하위 호환성 변경이다. 직접 모순보다는 기존 타입 계약 확장이므로 CRITICAL 이 아니나, 구현이 이미 진행 중인 경우 인터페이스 불일치가 발생할 수 있다.
- **제안**: draft 채택 시 `1-widget-app.md` 의 host bridge 설명에도 `on()` 반환 함수 해제 패턴을 동기화 기재하고, 향후 구현 spec 에서 타입 변경을 명시적으로 안내한다.

---

### [WARNING] `data-global` loader 속성 — 현행 "(구현 단계 검토)" 에서 확정 spec 으로 격상

- **target 위치**: draft §1 (`data-global` 속성으로 전역명 재지정 설명)
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md` (현행) §1 — "(전역명 충돌 방지 패턴은 구현 단계 검토)" 로 미결 표기
- **상세**: 현행 spec 은 전역명 충돌 방지 패턴을 "구현 단계 검토" 로 명시해 결정을 미뤘다. draft 는 이를 `data-global` 속성 방식으로 구체 확정한다. 이 자체는 동일 문서 내 갱신이므로 타 spec 과 직접 모순은 없으나, 확정 전 구현(loader.js)이 다른 방식을 이미 선택했다면 충돌이 된다. 현재 코드 파일(`codebase/packages/web-chat-sdk/`) 구현 상태와의 정합 확인 필요.
- **제안**: 구현 착수 전이면 draft 내용으로 확정해도 무방하나, 이미 구현된 경우 코드와 spec 을 동기화해야 한다.

---

### [INFO] `_product-overview.md` 의 npm scope 잠정 표기와 동기화 필요

- **target 위치**: draft 전체 (`@workflow/web-chat` 확정 표기)
- **충돌 대상**: `spec/7-channel-web-chat/_product-overview.md` §2 ("(b) `@clemvion/web-chat`(잠정 scope) npm"), §4 표 ("`@clemvion/web-chat`(잠정)")
- **상세**: CRITICAL 항목에서 파생. npm scope 가 실제로 확정되면 `_product-overview.md` 두 곳도 갱신해야 한다.
- **제안**: npm scope 확정 시 `_product-overview.md` §2, §4 를 `@workflow/web-chat` 으로 일괄 갱신.

---

### [INFO] `0-architecture.md` 의 npm scope 잠정 표기와 동기화 필요

- **target 위치**: draft 전체 (`@workflow/web-chat` 확정 표기)
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md` §4 ("**npm scope** (`@clemvion/web-chat` 잠정) 도 미확정 — eia-sdk-publish.md 결정 종속")
- **상세**: 동일 영역 내 문서 간 표기 불일치. CRITICAL 항목 해결 후 함께 갱신.
- **제안**: npm scope 확정·`eia-sdk-publish.md` 결정 기록 완료 후 `0-architecture.md §4` 의 잠정 표기 제거.

---

## 요약

target draft(`spec/7-channel-web-chat/2-sdk.md`)의 주요 변경 내용(npm scope 확정, `show`/`hide` 커맨드 추가, `off()`/`Unsubscribe` 패턴 추가, `data-global` 확정, `ChatInstance` 공개 타입 계약 신설)은 대부분 기존 spec 과 직접 모순되지 않는 확장이다. 단, npm 패키지명(`@workflow/web-chat`) 을 확정된 사실로 선언한 부분이 `plan/in-progress/eia-sdk-publish.md`(미결) · `_product-overview.md` · `0-architecture.md`(모두 `@clemvion/web-chat` 잠정 표기 유지) 와 직접 모순된다. 이 CRITICAL 항목은 `eia-sdk-publish.md` 에 실제 결정을 기록하거나 draft 를 잠정 표기로 되돌려야 해소된다. `wc:command` 에 `show`/`hide` 추가는 `1-widget-app.md` 상태기계 갱신 없이 단독 적용하면 두 문서 간 책임 공백이 발생하므로 함께 갱신이 필요하다.

## 위험도

HIGH
