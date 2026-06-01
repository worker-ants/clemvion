# Cross-Spec 일관성 검토 결과

- target: `spec/7-channel-web-chat/2-sdk.md`
- 모드: `--spec`
- 검토일: 2026-06-02

---

## 발견사항

### [WARNING] `wc:command` 페이로드 목록에 `show`/`hide` 누락
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §3 postMessage 프로토콜 표 (`wc:command` 행)
- **충돌 대상**: 같은 문서 §1 메서드 목록 (`show`/`hide` 나열), `codebase/packages/web-chat-sdk/src/types.ts` `ClemvionChatMethod` 유니온, `codebase/packages/web-chat-sdk/src/index.ts` 반환 객체 (`show: () => cmd("show")`, `hide: () => cmd("hide")`)
- **상세**: `2-sdk.md` §3 표의 `wc:command` 페이로드 설명은 `open`/`close`/`sendMessage(text)`/`updateProfile`/`shutdown` 5개만 열거하고 `show`/`hide` 를 빠뜨렸다. 그러나 §1 에서는 메서드로 `show`/`hide`/`open`/`close` 를 모두 나열하고, 구현 코드(index.ts 94-97행)는 `show`/`hide` 명령도 `wc:command` payload 로 전송한다. 표가 실제 프로토콜보다 좁아 혼란을 유발한다.
- **제안**: `2-sdk.md` §3 표의 `wc:command` 페이로드 열을 `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 으로 갱신.

### [WARNING] `show`/`hide` vs `open`/`close` 의미 정의 없음
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §1 메서드 목록
- **충돌 대상**: `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계 (collapsed ↔ expanded 만 묘사, `show`/`hide` 개념 없음)
- **상세**: target 이 `open`/`close`/`show`/`hide` 4가지 메서드를 정의하지만 차이가 spec 어디에도 설명되지 않는다. `1-widget-app.md` 상태기계는 `open` → 패널 전개, `close` → 런처로 복귀만 다루며 `show`/`hide` 는 언급이 없다. 구현(index.ts)도 두 쌍을 구별 없이 `wc:command` 로 전송할 뿐 의미 분기가 없다. 일반적으로 `open`/`close` = 패널 노출, `show`/`hide` = 위젯 전체(런처 포함) visibility 로 추정되지만 확인 불가.
- **제안**: `2-sdk.md` §1 에 `show`/`hide` vs `open`/`close` 의미 차이를 명시하고, `1-widget-app.md` 상태기계에도 해당 상태 전이를 반영. 의도가 같다면 중복 메서드를 통합.

### [WARNING] `on()` 반환값 — spec·타입 정의와 구현 불일치
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §2 npm 예제 및 §R3 ("on() 의 해제 함수 반환")
- **충돌 대상**: `codebase/packages/web-chat-sdk/src/index.ts` 100행 (`on: (event, callback) => bridge.on(event, callback)`) / `codebase/packages/web-chat-sdk/src/bridge.ts` `WidgetBridge.on()` 반환 타입 `void`
- **상세**: spec 과 `types.ts` 의 `ChatInstance.on()` 은 `Unsubscribe`(해제 함수) 반환을 선언하지만, `index.ts` 의 실제 구현은 `bridge.on()` 의 반환값을 그대로 전달하고 `bridge.on()` 은 `void` 를 반환한다. 타입 선언과 런타임 값이 불일치해 SPA cleanup 패턴(`const un = chat.on('message', f); un();`)이 동작하지 않는다.
- **제안**: `bridge.ts` `WidgetBridge.on()` 이 `Unsubscribe` 를 반환하도록 수정하고, `index.ts` `on` 핸들러가 그 반환값을 전달하게 변경. 코드 수정이므로 developer 역할 범위.

### [WARNING] `off()` — spec·타입 정의 있으나 구현 누락
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §1 메서드 목록 및 §2 예제 (`chat.off('unread')`)
- **충돌 대상**: `codebase/packages/web-chat-sdk/src/index.ts` `boot()` 반환 객체 (93-103행) — `off` 키 없음
- **상세**: spec §1 은 `off(event, cb?)` 를 공식 메서드로 나열하고, `types.ts` `ChatInstance` 도 `off(event, cb?)` 를 선언한다. 그러나 `index.ts` 의 실제 반환 객체에는 `off` 가 없어 TypeScript 컴파일러가 `ChatInstance` 인터페이스 불충족 오류를 낼 수 있다(또는 타입 캐스팅으로 숨겨진 상태). spec 약속 vs 구현 불일치.
- **제안**: `WidgetBridge` 에 `off(event, cb?)` 를 구현하고 `index.ts` 반환 객체에 노출. 코드 수정이므로 developer 범위.

### [INFO] `BootConfig.locale` 필드가 `0-architecture.md` 배포 표에 미반영
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` §4 `BootConfig.locale?: 'ko' | 'en'`
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md` §4 배포 설정 표
- **상세**: `0-architecture.md` §4 의 런타임 주입 필드 설명에 `locale` 이 언급되지 않는다. `bridge.ts` `resolveIframeTarget` 은 `locale` 을 iframe URL query param 으로 전달하도록 구현되어 있어 실제 동작은 있지만 architecture spec 에는 기록이 없다.
- **제안**: `0-architecture.md` §4 표에 `locale` 을 boot config 런타임 주입 필드로 추가(동기화).

### [INFO] `npm scope` 확정 — `0-overview.md` §6.3 로드맵 행에 패키지명 미기재
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md` 서두 주석 및 §R2
- **충돌 대상**: `spec/0-overview.md` §6.3 로드맵 "임베드형 웹채팅 위젯 + SDK" 행 (패키지명 미기재)
- **상세**: `2-sdk.md` 와 `_product-overview.md` 는 `@workflow/web-chat` 으로 일치하며 `plan/in-progress/eia-sdk-publish.md §결정 #3` 과도 정합한다. `0-overview.md` §6.3 항목에 패키지명이 없어 정보가 불완전하나 모순은 아니다.
- **제안**: `0-overview.md` §6.3 해당 행에 `@workflow/web-chat` 패키지명을 괄호로 병기.

---

## 요약

`spec/7-channel-web-chat/2-sdk.md` 는 같은 영역의 `0-architecture.md`, `3-auth-session.md`, `4-security.md` 와 정의 충돌 없이 대체로 일관된다. npm scope, EIA 매핑, postMessage origin 검증, BootConfig 필수 필드 등 주요 계약은 정합한다. 그러나 (1) `wc:command` 페이로드 표에 `show`/`hide` 가 누락된 spec 내부 불일치, (2) `show`/`hide` vs `open`/`close` 의 의미 미정의가 `1-widget-app.md` 상태기계와 충돌, (3) `on()` 반환값 및 `off()` 미구현으로 인해 spec 약속이 `codebase/packages/web-chat-sdk` 구현에 반영되지 않은 상태이다. 세 번째 항목은 spec→코드 추적성 파이프라인 전체에서 WARNING 수준이며, developer 역할 즉시 수정이 필요하다.

---

## 위험도

MEDIUM
