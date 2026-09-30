---
id: "CLE-WEBCHAT-SDK"
title: "웹채팅 SDK"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-WCSDK-001", "REQ-WCSDK-002", "REQ-WCSDK-003", "REQ-WCSDK-004", "REQ-WCSDK-005", "REQ-WCSDK-006", "REQ-WCSDK-007", "REQ-WCSDK-008", "REQ-WCSDK-009", "REQ-WCSDK-010", "REQ-WCSDK-011", "REQ-WCSDK-012", "REQ-WCSDK-013", "REQ-WCSDK-014", "REQ-WCSDK-015", "REQ-WCSDK-016", "REQ-WCSDK-017", "REQ-WCSDK-018", "REQ-WCSDK-019", "REQ-WCSDK-020", "REQ-WCSDK-021", "REQ-WCSDK-022", "REQ-WCSDK-023", "REQ-WCSDK-024", "REQ-WCSDK-025", "REQ-WCSDK-026", "REQ-WCSDK-027", "REQ-WCSDK-028"]
basis_superseded: false
parent: "CLE-WEBCHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT"]
area: "CLE-WEBCHAT"
content_hash: "ba30534da37eae4edde9a15f6871a4a4ae7f774ce5653b6497796689fa3fc678"
read_as: "approved"
task: null
source_paths: ["spec/7-channel-web-chat/2-sdk.md"]
mirror_sha256: "7a6ae88b2a1e63e06088ffdf7f59ed35b6c878d5b259937b2960fef8c6ce4123"
etag: "sha256-e7e1655d81fb2448edb3e0c6730e9142d6fb06c6721159d7fb09055641465034"
---
> 구현 상태: 구현됨 · 원문: `spec/7-channel-web-chat/2-sdk.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 호스트 페이지가 웹채팅 위젯을 넣고 조작하는 웹채팅 SDK(`@workflow/web-chat`, `ClemvionChat`)의 표면을 정한다. 비개발자용 설치 스크립트(install snippet)와 스니펫 로더(`loader.js`), 개발자용 npm 패키지, iframe 주입과 생애주기, 호스트 페이지와 iframe 사이의 postMessage 프로토콜(`wc:*`), 공개 JS API(`boot`·`open`·`close`·`show`·`hide`·`updateProfile`·`resetSession`·`shutdown`), 부팅 설정(`BootConfig`) 스키마, 제어 인스턴스(`ChatInstance`) 타입을 다룬다.

패키지 이름은 `@workflow/web-chat` 이다. EIA 클라이언트 SDK(`@workflow/sdk`)와 같은 `@workflow/*` scope 로 맞췄다(2026-06-02). 배포 정책은 따로 정하기 전까지 내부 전용이다.

범위 밖 주제는 링크로 대신한다. 명령에 따른 위젯 상태 변화는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md), 위젯 세션과 토큰은 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md), origin 검증과 `apiBase` 스킴 검증의 보안 근거는 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md), 설치 스크립트를 만들어 주는 운영자 화면은 [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)이 정한다.

## 요구사항

- REQ-WCSDK-001 WHEN 호스트 페이지가 설치 스크립트를 실행하면 THE SYSTEM SHALL `loader.js` 를 async 로 붙이기 전에 `ClemvionChat` 큐 스텁을 동기로 설치해 로더가 오기 전의 호출을 `.q` 에 담는다.
- REQ-WCSDK-002 WHEN 로더가 로드되면 THE SYSTEM SHALL 큐 스텁에 쌓인 호출을 다시 실행한다.
- REQ-WCSDK-003 WHEN 호스트 페이지가 `ClemvionChat(method, payload)` 를 부르면 THE SYSTEM SHALL `boot`·`shutdown`·`show`·`hide`·`open`·`close`·`sendMessage`·`updateProfile`·`on`·`off` 를 처리한다.
- REQ-WCSDK-004 WHEN 공개 메서드를 노출하면 THE SYSTEM SHALL `resetSession` 을 `ClemvionChat` 전역 메서드와 `ChatInstance` 에 넣지 않고 `wc:command` 로만 받는다.
- REQ-WCSDK-005 WHEN 로더 `<script>` 에 `data-global` 속성이 있으면 THE SYSTEM SHALL 그 이름으로 전역을 만든다.
- REQ-WCSDK-006 IF 지정한 전역 이름이 이미 큐가 아닌 객체로 쓰이고 있으면 THE SYSTEM SHALL 콘솔 경고를 남기고 부팅을 멈춘다.
- REQ-WCSDK-007 WHEN `on(event, cb)` 을 부르면 THE SYSTEM SHALL 구독 해제 함수를 돌려준다.
- REQ-WCSDK-008 WHEN `off(event, cb)` 를 부르면 THE SYSTEM SHALL 그 핸들러만 해제한다.
- REQ-WCSDK-009 WHEN `cb` 없이 `off(event)` 를 부르면 THE SYSTEM SHALL 그 이벤트의 핸들러를 모두 해제한다.
- REQ-WCSDK-010 WHEN 로더가 위젯을 띄우면 THE SYSTEM SHALL iframe 하나만 주입하고 런처는 iframe 안 위젯이 그리게 한다.
- REQ-WCSDK-011 WHEN npm 패키지를 빌드하면 THE SYSTEM SHALL 같은 코어를 ESM·UMD 모듈과 타입 정의로 내보내고 `loader.js` 는 그 코어의 IIFE 얇은 래퍼로 만든다.
- REQ-WCSDK-012 WHEN 호스트 페이지와 iframe 이 메시지를 주고받으면 THE SYSTEM SHALL 메시지 `type` 에 `wc:` 접두를 붙인다.
- REQ-WCSDK-013 WHEN 메시지를 받으면 THE SYSTEM SHALL 양방향 모두 `event.origin` 을 검증한다.
- REQ-WCSDK-014 WHEN 위젯이 첫 `wc:boot` 를 받으면 THE SYSTEM SHALL 그 origin 을 호스트 origin 으로 고정하고 이후 같은 origin 의 메시지만 받는다.
- REQ-WCSDK-015 WHILE 대화가 진행되는 동안 THE SYSTEM SHALL 토큰과 대화 내용을 iframe 안에만 두고 호스트 페이지로 보내지 않는다.
- REQ-WCSDK-016 WHEN 위젯이 숨김(`visible=false` 또는 호스트 `hide`)이나 차단 상태가 되면 THE SYSTEM SHALL `wc:resize { width: 0, height: 0, state: 'collapsed' }` 를 보낸다.
- REQ-WCSDK-017 WHEN 호스트가 `wc:resize` 를 받으면 THE SYSTEM SHALL iframe 크기를 페이로드의 `width`·`height`·`state` 에 맞춘다.
- REQ-WCSDK-018 WHEN 호스트가 iframe 을 배치하면 THE SYSTEM SHALL `position:fixed; bottom:0` 과 위치에 맞는 `left:0` 또는 `right:0`, `z-index: appearance.zIndex ?? 2147483000` 으로 뷰포트 모서리에 고정한다.
- REQ-WCSDK-019 WHEN 위젯이 대화 이벤트를 알리면 THE SYSTEM SHALL `wc:event { name, data }` 로 `open`·`close`·`message`·`unread`·`conversationStarted`·`conversationEnded` 를 보낸다.
- REQ-WCSDK-020 WHEN `conversationEnded` 를 보내면 THE SYSTEM SHALL `data.reason` 을 닫힌 enum 이 아닌 열린 문자열로 싣는다.
- REQ-WCSDK-021 WHEN 위젯이 `resetSession` 명령을 받으면 THE SYSTEM SHALL 확립된 대화면 이전 실행에 best-effort `cancel` 을 보내고 SSE 를 닫고 위젯 세션을 비운 뒤 새 실행을 시작한다.
- REQ-WCSDK-022 WHEN 호스트가 `wc:boot` 를 다시 보내면 THE SYSTEM SHALL 마지막 `wc:boot` 의 설정을 적용한다.
- REQ-WCSDK-023 IF 다시 받은 `wc:boot` 의 `triggerEndpointPath` 가 같으면 THE SYSTEM SHALL 진행 중인 실행을 다시 시작하지 않는다.
- REQ-WCSDK-024 IF 다시 받은 `wc:boot` 의 `apiBase` 가 바뀌었으면 THE SYSTEM SHALL 위젯 세션을 복원하지 않고 버린 뒤 새로 시작한다.
- REQ-WCSDK-025 IF 다시 받은 `wc:boot` 의 `locale` 만 바뀌었으면 THE SYSTEM SHALL UI 언어를 바꾸지 않는다.
- REQ-WCSDK-026 WHEN 부팅 설정 스키마를 정의하면 THE SYSTEM SHALL 인증 토큰 필드를 넣지 않고 토큰은 웹훅 `202` 응답으로만 받는다.
- REQ-WCSDK-027 WHEN `boot()` 를 부르면 THE SYSTEM SHALL `ChatInstance` 제어 인스턴스를 돌려준다.
- REQ-WCSDK-028 WHEN `shutdown()` 을 부르면 THE SYSTEM SHALL iframe 과 리스너를 정리하고 인스턴스를 폐기한다.

## 설치 스크립트와 스니펫 로더

비개발자는 아래 설치 스크립트를 호스트 페이지에 붙인다. 운영 콘솔의 설치 스크립트 생성기와 사용자 가이드도 이 형태를 따른다.

```html
<script>
  (function(d,s){
   // 큐 스텁: loader.js(async) 로드 전 ClemvionChat 호출을 .q 에 버퍼링 → 로더가 다시 실행.
   // 없으면 아래 boot 가 async 로더보다 먼저 실행돼 `ReferenceError: ClemvionChat is not defined`.
   window.ClemvionChat=window.ClemvionChat||function(){(window.ClemvionChat.q=window.ClemvionChat.q||[]).push(arguments)};
   var j=d.createElement(s);j.async=1;
   j.src="https://<widget-cdn-base>/web-chat/v1/loader.js";  // 위젯 배포 주소(배포 환경 설정)
   d.head.appendChild(j);})(document,"script");
</script>
<script>
  ClemvionChat('boot', {
    apiBase: 'https://<api-base>',         // API 기준 주소(런타임 주입)
    triggerEndpointPath: 'a1b2c3-...',     // 웹채팅 트리거의 공개 웹훅 경로
    locale: 'ko',                          // 'ko' | 'en'. 위젯 고유 문구 언어. 없으면 브라우저 자동 감지 → ko
    appearance: { primaryColor: '#5B4FE9', position: 'bottom-right', zIndex: 2147483000 },
    headerTitle: 'AI 어시스턴트',
    welcome: { text: '안녕하세요! 무엇을 도와드릴까요?', suggestions: ['제품 소개를 받아볼 수 있나요?', '설치는 어떻게 하나요?'] },
    launcher: { suggestions: ['제품 소개를 받아볼 수 있나요?', '설치는 어떻게 하나요?'] },
    disclaimer: 'AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요.',
    profile: { /* optional, 호스트가 아는 사용자 식별 정보 */ }
  });
</script>
```

`<widget-cdn-base>`·`<api-base>` 는 배포 환경 설정 자리 표시자다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)). `apiBase` 에 경로를 넣을 수 있는지는 [미결 사항](#미결-사항) 참조. 웹채팅 트리거의 경로가 설치 스크립트로 공개되는 문제는 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)에서 다룬다.

- 전역 함수 `ClemvionChat(method, payload)` 가 하나뿐인 진입점이고 명령 큐 방식으로 동작한다. 메서드는 `boot`·`shutdown`·`show`·`hide`·`open`·`close`·`sendMessage`·`updateProfile`·`on(event, cb)`·`off(event, cb?)` 다.
- `resetSession` 은 `wc:command` 전용이다. 이 전역 메서드 목록과 npm `ChatInstance` 에는 넣지 않는다([postMessage 프로토콜](#postmessage-프로토콜)).
- **`show`·`hide` 와 `open`·`close` 의 차이**: `show`·`hide` 는 런처(위젯 진입점)의 가시성을 바꾼다. `hide` 는 위젯 자체를 페이지에서 숨긴다. `open`·`close` 는 대화 패널을 펼치거나 접고 런처는 그대로 둔다. 그래서 `hide` 뒤에는 `open` 해도 보이지 않으며 먼저 `show` 해야 한다. 상태 변화는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)이 정한다.
- **전역 이름 충돌 방지**: 기본 전역은 `window.ClemvionChat` 이다. 호스트 페이지에 같은 이름이 이미 있거나 위젯을 여러 개 올릴 때를 위해 로더 `<script>` 의 `data-global` 속성으로 전역 이름을 바꿀 수 있다(예: `<script ... data-global="SupportChat">` → `window.SupportChat`). 로더는 부팅 때 지정한 전역이 이미 큐가 아닌 객체로 쓰이고 있으면 콘솔 경고를 남기고 부팅을 멈춘다. 호스트 전역을 조용히 덮어쓰지 않는다. 지정하지 않으면 `ClemvionChat` 이다.
- **구독 해제**: `on(event, cb)` 은 구독 해제 함수를 돌려준다(`const un = chat.on('message', f); un();`). 같은 역할로 `off(event, cb)`(특정 핸들러 해제)와 `off(event)`(그 이벤트 전체 해제)도 있다. SPA 가 언마운트될 때(React `useEffect` cleanup 등) 핸들러가 새지 않게 한다. 설치 스크립트 전역 큐 형태 `ClemvionChat('off', { event, cb })` 도 같다.
- **`loader.js` 의 책임**: iframe 생성과 크기 적용, 호스트 페이지↔iframe 메시지 전달, 명령 큐(`boot` 전 호출 버퍼링). 런처는 별도 DOM 으로 주입하지 않고 iframe 안 위젯이 그린다. 로더는 `wc:resize`(`collapsed`↔`expanded`)에 맞춰 iframe 상자만 조절한다.

## npm 패키지 `@workflow/web-chat`

```ts
import { ClemvionChat } from '@workflow/web-chat';
const chat = ClemvionChat.boot({ apiBase, triggerEndpointPath, profile, appearance, launcher });
const unsubscribe = chat.on('message', (m) => analytics.track('chat_message', m)); // on() → 해제 함수 반환
chat.on('unread', (n) => badge.set(n));
chat.open();
chat.updateProfile({ plan: 'pro' });
// SPA 언마운트 시 핸들러 누수 방지:
unsubscribe();            // on() 반환 함수, 또는
chat.off('unread');       // 이벤트 단위 일괄 해제
chat.shutdown();
```

- 같은 코어를 모듈과 타입 정의로 내보낸다. ESM 과 UMD 를 낸다. `loader.js` 는 npm 코어의 IIFE 얇은 래퍼이며 따로 구현하지 않는다.
- 웹채팅 SDK 코어는 타입, `boot` 검증, `wc:*` 브리지, 명령 큐, iframe 주입만 구현했다. EIA 클라이언트 SDK(`@workflow/sdk`)는 아직 import 하지 않는다. `package.json` devDependencies 에 `workspace:*` 선언만 있다. 위젯은 자체 `eia-client.ts` 로 EIA 를 부른다. 웹채팅 SDK 와 `@workflow/sdk` 의 관계, BYO-UI 모드를 어느 패키지가 맡는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## postMessage 프로토콜

메시지 `type` 에는 `wc:` 접두를 붙인다. 다른 채널이나 OAuth 팝업 메시지와 섞이지 않게 하려는 것이다.

| 방향 | 메시지 type | 페이로드 |
|---|---|---|
| 호스트 → iframe | `wc:boot` | 부팅 설정 전체 |
| 호스트 → iframe | `wc:command` | `open`·`close`·`show`·`hide`·`sendMessage(text)`·`updateProfile`·`shutdown`·`resetSession` |
| iframe → 호스트 | `wc:ready` | 위젯 로드 완료 |
| iframe → 호스트 | `wc:resize` | `{ width, height, state: 'collapsed' \| 'expanded' }`. 위젯이 숨김(`visible=false` 또는 호스트 `hide()`)이나 차단 상태면 `{ width: 0, height: 0, state: 'collapsed' }` 를 보내 호스트의 iframe 상자가 자리를 차지하지 않게 한다 |
| iframe → 호스트 | `wc:event` | `{ name, data }`. `name` 은 `open`·`close`·`message`·`unread`·`conversationStarted`·`conversationEnded` 가운데 하나이고 `data` 는 이벤트별 페이로드다. `conversationEnded.data.reason` 은 닫힌 enum 이 아닌 열린 문자열이다. SSE 종료 이벤트 이름(`execution.completed`·`failed`·`cancelled`)이나 위젯 로컬 종료 사유(`user_ended` = 헤더 "대화 종료", `gone` = 410) 등이 온다. 호스트는 특정 값에 기대지 말고 "종료됨" 신호로만 써야 한다 |

- **origin 검증(필수)**: 양방향 모두 `event.origin` 을 검증한다. 방향마다 방식이 다르다. 호스트 쪽은 위젯 배포 주소에서 얻은 위젯 origin 과 같은지 본다. iframe 쪽은 호스트 origin 을 미리 알 수 없으므로 첫 `wc:boot` 의 origin 을 호스트 origin 으로 고정하고 이후 같은 origin 의 메시지만 받는다. 임베드 허용 도메인과 비교하는 임베드 검증([웹채팅 보안](CLE-WEBCHAT-SECURITY.md))과는 다른 장치다.
- 토큰과 대화 내용은 iframe 안에 두고 호스트 페이지로 보내지 않는다.
- **`resetSession` 명령**: 현재 대화를 처음부터 다시 시작한다. 위젯은 이전 실행에 best-effort `cancel` 을 보낸 뒤 SSE 를 닫고 위젯 세션(sessionStorage, [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md))을 비우고 새 실행을 시작한다(`newChat`: cancel → closeStream → clearSession → start). `cancel` 은 확립된 대화(`streaming`·`awaiting_user_message`)에서만 보내고 낙관적으로 처리한다. 실패해도 로컬 재시작을 되돌리지 않는다. 이 단계가 없으면 버려진 실행이 서버에 남아 입력을 기다린다. 근거와 경계 사례는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)에 있다. 운영 콘솔 라이브 미리보기의 "새 세션" 버튼이 이 명령으로 시나리오를 반복 시험한다. 위젯 안에서 대화 종료 뒤 "새 대화 시작" 과 같은 동작을 호스트가 원하는 때에 일으키는 경로다. `wc:command` 전용이라 npm `ChatInstance` 와 `ClemvionChat` 전역 메서드로는 노출하지 않는다. 호스트가 직접 `wc:command{ action:'resetSession' }` 를 postMessage 한다(운영 콘솔 미리보기 등).
- **`wc:boot` 재전송(멱등 재설정)**: 호스트는 iframe 을 다시 만들지 않고 `wc:boot` 을 다시 보내 부팅 설정(외형·콘텐츠)을 바꿀 수 있다. 위젯은 마지막 `wc:boot` 의 설정을 적용한다. 같은 `triggerEndpointPath` 로 다시 부팅하면 진행 중인 실행을 중복으로 시작하지 않는다(즉시 시작 가드와 세션 복원, [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)).
  - 예외: `apiBase` 가 바뀐 재부팅. 위젯 세션은 발급 주소에 묶여 있어 복원하지 않고 버린 뒤 새로 시작한다([웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)). 같은 `triggerEndpointPath` 라도 주소가 다르면 "중복 시작 없음" 보장 대상이 아니다. 옛 주소의 토큰을 새 주소로 보내지 않는 것이 먼저다.
  - `locale` 은 부팅 때 한 번 정하므로 재전송만으로는 UI 언어가 바뀌지 않는다. iframe 을 다시 마운트해야 한다.
  - 운영 콘솔 라이브 미리보기는 외형 폼이 바뀌면 이 경로로 다시 보낸다. 인스턴스나 `locale` 이 바뀔 때만 iframe 을 다시 마운트한다.
  - 첫 `wc:boot` 의 origin 만 호스트로 고정되므로 재전송도 같은 origin 에서 와야 한다.
- **`wc:resize` 호스트 처리(필수)**: 호스트(로더·WidgetBridge)는 `wc:resize` 를 받으면 iframe 요소의 크기를 페이로드(`width`·`height`·`state`)에 맞춘다. `collapsed`(런처만)와 `expanded`(패널 펼침)를 오갈 때 iframe 상자가 따라 바뀌지 않으면 클릭 영역과 스크롤이 깨진다.
- **호스트 iframe 모서리 고정(필수)**: 위치와 쌓임 순서는 `appearance` 를 따른다. 호스트는 iframe 을 `position:fixed; bottom:0;` 과 (`bottom-left` 면 `left:0`, 그 밖 기본 `bottom-right` 면 `right:0`), `z-index: appearance.zIndex ?? 2147483000` 으로 뷰포트 모서리에 고정한다. 오프셋을 주지 않으면 `position:fixed` iframe 이 본문 끝의 정적 위치(화면 밖)에 박혀 위젯이 보이지 않는다. 위젯이 iframe 안에서 런처와 패널을 `bottom/side:16px` 여백으로 띄우므로 iframe 은 모서리에 딱 붙인다(0).

## 부팅 설정 스키마

```ts
interface BootConfig {
  apiBase: string;                  // API 기준 주소(정의는 미결 사항 참조). http(s) 스킴만 받는다. 어기면 그 필드만 무시하고 부팅은 계속한다(웹채팅 보안)
  triggerEndpointPath: string;      // 공개 웹훅 경로. 인증 토큰은 boot 에 넣지 않는다. 웹훅 202 가 실행 단위 토큰을 발급한다
  locale?: 'ko' | 'en';             // 위젯 UI 언어. 명시 → 브라우저 자동 감지 → ko
  appearance?: { primaryColor?: string; position?: 'bottom-right' | 'bottom-left'; zIndex?: number };  // 색·위치만(현 단계)
  headerTitle?: string;             // 봇 표시 이름(콘텐츠)
  welcome?: { text?: string; suggestions?: string[] };
  launcher?: { suggestions?: string[] };
  disclaimer?: string;
  profile?: Record<string, unknown>;
}
```

- `apiBase` 스킴 검증 규칙과 근거는 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md)이 정한다.
- **`locale` 은 위젯 UI 언어 선택자다.** 부팅 설정·쿼리·운영 콘솔([웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md))을 거쳐 위젯에 전달되고 위젯이 부팅 때 한 번 정해 위젯 고유 문구(위젯 로컬 catalog)를 그 언어로 그린다. 결정 순서는 명시 `locale` → 브라우저 `navigator.language`(자동 감지) → `ko` 이며 기준은 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)이다. 없거나 지원하지 않는 값이면 `ko` 다(하위 호환). 번역 범위는 위젯 고유 문구뿐이다. 운영자 콘텐츠(`headerTitle`·`welcome`·`disclaimer` 등)와 AI 본문은 입력 언어 그대로 그린다. 콘텐츠 현지화는 [웹채팅](CLE-WEBCHAT.md)의 비목표다. 이 `locale` 은 위젯 UI 언어일 뿐이며 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)의 안내 문구 언어(`languageLocale`, 서버가 보내는 메시지 언어)와 다르다.

## 제어 인스턴스 타입

`boot()` 가 돌려주는 제어 인스턴스다. 설치 스크립트 전역 함수도 같은 메서드로 보낸다. 공개 메서드 계약의 타입 기준은 이 블록이며 위 설명과 예시가 다르면 이 블록이 우선한다.

```ts
type Unsubscribe = () => void;
type WidgetEvent =
  | 'open' | 'close' | 'message' | 'unread'
  | 'conversationStarted' | 'conversationEnded';

interface ChatInstance {
  open(): void;                                  // 대화 패널 펼침
  close(): void;                                 // 대화 패널 접힘(런처 유지)
  show(): void;                                  // 위젯(런처) 표시
  hide(): void;                                  // 위젯(런처) 숨김
  sendMessage(text: string): void;
  updateProfile(profile: Record<string, unknown>): void;
  on(event: WidgetEvent, cb: (payload: unknown) => void): Unsubscribe;  // 반환: 구독 해제 함수
  off(event: WidgetEvent, cb?: (payload: unknown) => void): void;       // cb 생략 시 이벤트 전체 해제
  shutdown(): void;                              // iframe·리스너 정리(인스턴스 폐기)
}
```

`sendMessage` 를 받은 위젯이 상태별로 어떻게 처리하는지는 아직 정해지지 않았다([웹채팅 위젯](CLE-WEBCHAT-WIDGET.md#미결-사항)).

## 미결 사항

- **API 기준 주소(`apiBase`)의 정의**: 이 문서의 부팅 설정 스키마와 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)는 `apiBase` 를 EIA 가 서빙되는 API origin 으로 적는다. [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)은 `NEXT_PUBLIC_API_URL` 에서 `/api` 를 떼어 값을 만든다. [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)은 위젯 세션을 발급 주소와 비교할 때 "`apiBase` 는 `/api` 같은 경로를 포함하는 것이 정상" 이라며 경로를 보존한다. 현재 구현은 위젯 `eia-client.ts` 가 `apiBase` 뒤에 `/api/hooks/…`·`/api/external/…` 를 붙인다(`joinUrl(apiBase, '/api/hooks/${endpointPath}')`). 그래서 `/api` 를 넣으면 `/api/api/…` 가 된다. 한편 `api-base.ts` 주석은 경로 포함이 정상이라고 적는다. origin(리버스 프록시 prefix 는 허용, `/api` 는 제외)으로 정의를 하나로 할지, 세션 문서의 예시를 "`/api` 가 아닌 경로 prefix" 로 바꿀지 결정 필요. 끝 슬래시만 정규화하는 규칙은 어느 쪽이든 유지할 수 있다.
- **EIA 클라이언트 SDK(`@workflow/sdk`) 재사용과 BYO-UI 모드**: [웹채팅](CLE-WEBCHAT.md)의 구성 요소 표는 웹채팅 SDK 의 EIA 호출이 `@workflow/sdk` 를 재사용한다고 적는다. 원문 개요와 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)의 BYO-UI 모드 절은 웹채팅 SDK 가 headless client primitive 를 노출해 BYO-UI 를 가능하게 한다고 적는다. 반면 이 문서의 npm 패키지 절 원문은 웹채팅 SDK 코어가 `@workflow/sdk` 를 import 하지 않으며 BYO-UI headless client 는 `@workflow/sdk` 를 직접 쓰는 경로로 이미 충족되고 웹채팅 SDK 코어에 `@workflow/sdk` 를 배선(triggerWebhook·SSE)하는 것은 현 시점 비목표이고 필요하면 별도 계획으로 착수한다고 적는다. [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)은 이 "미배선" 을 BYO-UI headless 에 한정된 것으로 설명한다. 현재 구현은 위젯이 자체 `eia-client.ts` 로 EIA 를 부르고 웹채팅 SDK 는 `@workflow/sdk` 를 쓰지 않는다. 어느 서술을 기준으로 할지 결정 필요.

## 구현 위치

- `codebase/packages/web-chat-sdk/**` (웹채팅 SDK·스니펫 로더·샘플)
- `codebase/channel-web-chat/src/widget/host-bridge.ts` 호스트 페이지↔iframe `wc:*` 전송 계층
- `codebase/channel-web-chat/src/widget/use-session-generations.ts` `wc:boot` 재전송 계약("마지막 `wc:boot` 의 설정을 적용")의 위젯 쪽 정본. 부팅 시도 세대 발급(`beginBootAttempt`)과 나중 시도가 앞선 시도를 대체하는지 판정(`cannotApplyConfig`·`isAttemptStale`)한다. 이 세대는 설정 적용 경합만 가른다. 재로드 표면 되감기 방어는 세대가 아니라 세션 확립 여부를 기준으로 하는 다른 축이다([웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md))
- `codebase/channel-web-chat/src/widget/use-widget.ts` 그 판정을 쓰는 곳(`applyConfig`)
- 심볼을 옮기면 이 목록도 함께 옮긴다. 경로 존재만 검사하는 도구는 계약이 아직 그 자리에 있는지 묻지 않는다.

## Rationale

### 설치 스크립트와 npm 을 둘 다 준다 (하나만 주기 기각)

CDN 설치 스크립트와 npm 을 모두 주되 코어는 하나다(`loader.js` 는 npm 코어의 IIFE 래퍼). 비개발자는 빌드 없이 설치 스크립트를, 개발자는 npm 으로 타입·프로그래밍 제어·사용자 식별 통합을 쓴다. npm 만 주면 비개발자가 빠지고 설치 스크립트만 주면 SPA 통합·타입·이벤트 개발 경험이 약해진다. 둘 다 주는 것이 적용 범위가 가장 넓다. npm scope 는 `@workflow/sdk` 와 같게 `@workflow/web-chat` 이다.

### 구독 해제와 전역 이름 재지정 (SPA 에 안전하게 붙이기)

`on()` 만 있고 해제 수단이 없으면 SPA(특히 React `useEffect`)가 다시 마운트될 때마다 핸들러가 쌓여 메모리가 새고 중복 호출이 난다. SPA 통합 피드백으로 정리 패턴을 분명히 해 달라는 요구가 확인돼 해제 수단을 넣었다. `on()` 이 해제 함수를 돌려주고 `off()` 도 두는 것은 EventEmitter·addEventListener 같은 표준 양식과 맞고 호스트가 편한 정리 방식을 고를 수 있게 한다.

전역 이름은 `ClemvionChat` 하나로 고정하지 않고 `data-global` 로 바꿀 수 있게 했다. 호스트 전역 오염, 같은 이름 충돌, 여러 위젯 동시 탑재를 깨뜨리지 않고 허용하기 위해서다. 기본값은 단순하게 `ClemvionChat` 을 유지한다. 이미 쓰이는 이름이면 조용히 덮어쓰지 않고 경고와 중단으로 안전하게 처리한다.

### `show`·`hide` 와 `open`·`close` 를 두 축으로 나눈다

위젯 제어를 런처 가시성(`show`·`hide`)과 패널 펼침(`open`·`close`)으로 나눈 것은 호스트가 "위젯을 페이지에서 완전히 숨김"(예: 특정 라우트에서 비표시)과 "런처는 두고 대화창만 접음" 을 따로 제어해야 하기 때문이다. 한 축(`open`·`close`)으로 합치면 "런처도 숨기고 싶다" 를 표현할 수 없다. 상세 상태 전이는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)이 정한다. 공개 메서드 계약의 타입 기준은 [제어 인스턴스 타입](#제어-인스턴스-타입) 블록이며 설명과 예시는 보조다(다르면 타입 블록이 우선).

### 설치 스크립트의 큐 스텁은 빼면 안 된다

설치 스크립트의 첫 블록은 `loader.js` 를 async 로 붙인다. 그래서 같은 페이지의 동기 `ClemvionChat('boot', …)` 호출이 로더보다 먼저 실행될 수 있다. 호출을 `.q` 에 담는 큐 스텁(`window.ClemvionChat=window.ClemvionChat||function(){(…q…).push(arguments)}`)을 `boot` 호출 전에 동기로 설치해야 하고 로더(`installGlobal`)가 로드되면 큐를 다시 실행한다. 스텁을 빼면 `Uncaught ReferenceError: ClemvionChat is not defined` 가 난다. 이 문서의 예시, 운영 콘솔의 설치 스크립트 생성기, 사용자 가이드가 모두 이 스텁을 넣어야 한다. 세 곳에서 스텁이 빠지는 일이 실제로 있었다(2026-06-25 복원).

### `locale` 을 예약해 두었다가 켰다

`BootConfig.locale` 은 v1 에서 예약 필드였다. 쿼리·`wc:boot`·설정 상태로 실려 다니지만 렌더에는 쓰지 않았다(한국어 전용). 운영 콘솔 폼 필드이자 공개 SDK 계약이라 지우지 않고 "영어 위젯 지원을 시작하면 UI 언어 선택자로 켠다" 고 예약했다. 2026-07-12 결정으로 그 활성화를 실행했다. 위젯이 부팅 때 `locale` 을 한 번 정해(명시 → 브라우저 자동 감지 → `ko`) 위젯 고유 문구를 위젯 로컬 catalog(ko·en)로 그린다([웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)). v1 의 "예약" 은 처음부터 영구 결정이 아닌 범위 경계였으므로 예약된 경로의 실행이지 결정 번복이 아니다. 필드를 지우지 않은 판단은 이제 "이미 활성인 계약" 으로 자연스럽게 이어진다. 번역 범위는 위젯 고유 문구뿐이다.
