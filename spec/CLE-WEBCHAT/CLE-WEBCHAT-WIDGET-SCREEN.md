---
id: "CLE-WEBCHAT-WIDGET-SCREEN"
title: "웹채팅 위젯 — 화면과 문구 다국어"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WEBCHAT-WIDGET"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT", "CLE-WEBCHAT-WIDGET"]
area: "CLE-WEBCHAT"
content_hash: "33a74bb5d9e2f809b546cb42b31b6664b03acadcc5fd6d4d6e4ad5a39f97445d"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "af33be694297fe388d155263bc85979d9380202f3bd9e3a0bea7b24ffc67c509"
etag: "sha256-144e0f98f557897dc5c90dffaf427f59dbae67aeb583cfa5a5f93ea889fc2602"
---
## 개요

이 문서는 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md) 의 하위 문서로 위젯의 화면 구조(런처 · 패널 · 표시물 렌더 · 입력창)와 위젯 고유 문구(widget chrome)의 다국어 처리를 정한다.

## 화면 구조

### 런처

접힌 상태(`collapsed`)에서는 오른쪽 아래 떠 있는 런처 버튼과 추천 질문 버블 N개(`launcher.suggestions`)를 그린다.

- 버블을 누르면 패널이 열린다. 텍스트는 워크플로우가 첫 `awaiting_user_message` 에 이르렀을 때 `submit_message` 로 보낸다. 패널을 연 직후는 `booting` 이라 위젯이 텍스트를 큐에 담아 두었다가 보낸다.
- 첫 표면이 `buttons`·`form` 이면 자유 텍스트를 제출할 수 없는 표면이므로 큐의 텍스트를 보내지 않고 버린다.
- 첫 메시지 페이로드(`firstMessage`)는 쓰지 않는다.
- 런처(위젯) 자체를 보이거나 숨기는 것은 호스트의 `show`·`hide` 로 정한다([가시성·profile 갱신·차단](CLE-WEBCHAT-WIDGET-STATE.md#가시성profile-갱신차단)).

### 패널

| UI 요소 | 데이터 출처 | 동작 |
|---|---|---|
| 헤더(봇 이름, 대화 컨트롤, 닫기) | 부팅 설정 `headerTitle`. 아바타·뒤로 버튼은 다음 단계 | "새 대화"·"대화 종료"·닫기(✕)를 그린다. 닫기는 패널을 접고 대화를 유지한다. "새 대화"·"대화 종료" 는 인라인 2단계 확인 뒤에 실행해 진행 중 대화와 기록을 잃는 실수를 막는다. 이 두 컨트롤은 대화가 확립된 뒤(`streaming`·`awaiting_user_message`)에만 표시한다. `booting`(웹훅 요청 진행 중, 위젯 세션 저장 전), 시작 전(`collapsed`·`panel`), `[ended]` 에서는 숨긴다. 이유는 [대화 상태 Rationale](CLE-WEBCHAT-WIDGET-STATE.md#헤더-대화-컨트롤은-대화-확립-후에만-보이고-종료-명령은-대기-표면에-따라-고른다) |
| 환영 메시지 | 부팅 설정 `welcome`(정적) | 패널을 열면 바로 표시한다. 워크플로우 시작 전에 클라이언트가 그린다 |
| 퀵 액션 버튼 | `waiting_for_input.buttonConfig` | 누르면 `click_button` |
| 추천 질문 | 부팅 설정 `welcome.suggestions`·`launcher.suggestions`(정적) | 누르면 `submit_message` |
| 메시지 리스트 | 1차 소스는 `waiting_for_input.conversationThread.turns` 스냅샷([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md))과 로컬 라이브 이벤트다. `ai_message.messages[]` 원본은 직접 보이지 않는다 | 대화 기록 항목의 항목 출처(`ConversationTurnSource`, 백엔드 다섯 값, [대화 스레드](../CLE-IX/CLE-IX-THREAD.md))를 말풍선 역할 둘로 줄여 그린다. `presentation_user`·`ai_user` 는 user, `ai_assistant`·`ai_tool`·`system` 은 assistant 다. 사용자 입력 마커 `[user-input]…[/user-input]` 은 지운다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)). 새로고침 복원 뒤에도 이 매핑으로 과거 user·assistant 를 구분한다. 복원 대화 스레드는 EIA 상태 조회가 영속 스냅샷으로 돌려준다 |
| Form (여러 필드) | `waiting_for_input` 의 `nodeOutput.formConfig`(없으면 `nodeOutput` 자체) | 필드를 그리고 검증한 뒤 `submit_form`. 검증 실패(`400 VALIDATION_ERROR`)와 그 밖의 실패 표시는 [명령 실패](CLE-WEBCHAT-WIDGET-STATE.md#명령-실패)를 따른다 |
| 표시물(carousel·table·chart·template) | `ai_message.presentations[]`, 표시 메시지 이벤트(`execution.message`), 복원 대화 스레드의 `turn.presentations[]` | 아래 [표시물 렌더](#표시물-렌더) |
| 입력창 | 없음 | Enter 또는 전송 버튼으로 `submit_message`. 활성 조건과 외형은 아래 [입력창](#입력창) |
| 첨부·이모지 | 없음 | v1 에서는 비활성이거나 숨긴다. Form 파일 업로드와 함께 켤 예정이다 |
| AI 면책 푸터 | 부팅 설정 `disclaimer`(정적) | 표시만 한다 |

위 표의 위젯 고유 문구(대화 컨트롤, "AI 응답 중", 확인 문구, 잘림 배너 등)는 [위젯 고유 문구 다국어](#위젯-고유-문구-다국어)의 catalog 키로 `locale` 언어에 맞춰 그린다. 표의 문구는 ko 예시다. 운영자가 넣은 콘텐츠(`headerTitle`·`welcome`·`disclaimer`)는 번역 대상이 아니다.

### 표시물 렌더

- 모든 표시물 타입을 말풍선 안에 그린다([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)).
- 렌더러는 두 모양을 모두 받는다. 하나는 표시 전용 Presentation 노드가 보내는 노드 출력 형태(`{config, output}`, [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md))다. 이 모양은 표시 메시지 이벤트 `execution.message` 의 `presentations[]` 로 온다([EIA 수신 API와 SSE §표시 메시지 이벤트](../CLE-IX/CLE-EIA-INBOUND.md#표시-메시지-이벤트)). 다른 하나는 AI 표시 도구(`render_*`)의 표시물 페이로드(`PresentationPayload`, `{type, toolCallId, renderedAt, payload}`)다. 후자는 명시된 `type` 으로 분류하고 `payload` 를 노드 출력 형태로 정규화한다. 그래서 새로고침 복원 대화 스레드의 `turn.presentations[]` 도 그대로 다시 그린다.
- `PresentationPayload.truncation`(출력 크기 한도 1MB 잘림 정보, [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md))은 `output.{rowsTruncated|itemsTruncated}` 와 같게 다룬다. 잘리면 잘리기 전 총 개수(`{itemsTotalCount|rowsTotalCount}`)와 함께 "총 N개 중 일부만 표시돼요." 를 표시한다. 메인 에디터 실행 결과([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md))와 같은 동작이다.
- table 과 carousel 은 대칭이다. table 은 `rows*`, carousel 은 `items*` 키를 읽어 각자 잘림 배너를 그린다. 총 개수가 없으면 table 은 "일부 행만 표시돼요.", carousel 은 "일부 항목만 표시돼요." 를 쓴다.
- 총 개수는 유한한 비음수 정수만 받는다. 믿을 수 없는 값으로 "총 NaN개…" 가 새지 않게 한다.
- **복원 범위 제약**: 영속 대화 스레드의 `turn.presentations[]` 는 `source: 'ai_assistant'` 에만 있어 AI 표시 도구의 표시물만 저장된다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 표시 전용 Presentation 노드의 표시물은 라이브 표시 메시지 이벤트로만 오므로 새로고침 복원 대상이 아니다.
- **Template 본문 정화**: Template 본문(`output.rendered`, 표시 도구 `render_template` 의 `content`)은 서버에서 정화하지 않은 채로 온다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#template-본문-정화-책임)). 포맷이 `html` · `markdown` 이면 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md#마크다운html-sanitize) 의 허용 목록으로 정화한 뒤 그리고 `markdown` 은 HTML 로 바꾼 뒤 정화한다. 포맷 값이 없거나 모르는 값이면 `html` 로 다룬다. `text` 포맷이거나 정화 결과가 비었거나 브라우저 밖(정적 빌드 단계)이면 태그를 해석하지 않고 글자로 보여 준다.

### 입력창

- 자유 텍스트 입력은 `awaiting_user_message` 이면서 텍스트 표면일 때만 켠다. 텍스트 표면은 `ai_conversation` 또는 `pending=null`(`ai_conversation` 도달 전의 과도 상태)이다. 즉 `buttons`·`form` 이 아닌 표면이다. 판정 기준은 `widget-state.isTextInputSurface` 다.
- `booting`·`streaming` 이거나 현재 표면이 `buttons`·`form` 이면 입력창을 끈다. 이때 사용자는 선택이나 제출로 응답한다.
- 꺼진 외형은 두 가지다. 대기 중(빈 입력, `buttons`·`form`)에는 전송 버튼을 중립 회색으로 둔다. `booting`·`streaming`(AI 처리 중)에는 스피너와 `aria-busy=true`, `aria-label="AI 응답 중"` 으로 응답 중임을 알린다. 흐린 반투명 비활성 상태가 고장처럼 보이지 않게 하려는 것이다.

## 위젯 고유 문구 다국어

위젯이 스스로 그리는 UI 문자열(대화 컨트롤, 확인, 입력창, 상태·에러, 표시물 잘림 배너, aria-label 등)을 ko·en 두 언어로 낸다. 부팅 설정의 `locale`([웹채팅 SDK](CLE-WEBCHAT-SDK.md))로 방문자 언어에 맞춘다.

**방식: 위젯 로컬 경량 catalog**

- 위젯은 별도 정적 export 번들이라 메인 앱의 `frontend/src/lib/i18n/dict` 를 가져올 수 없다. 그래서 위젯 로컬 문자열 catalog `{ ko, en }` 와 `t(key, params?)` 를 둔다. 파라미터 보간은 제품 전체와 같게 `{{name}}` 이중 중괄호를 쓴다.
- ko·en 의 leaf key 집합이 같아야 한다. 위젯 로컬 parity 테스트로 강제한다.
- 메인 앱 dict 체계와 물리적·개념적으로 분리된 자체 catalog 다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)의 적용 범위). 문체 원칙(ko 해요체, en 정중·간결)은 함께 따른다.

**언어 결정**(부팅 때 한 번 정해 고정)

1. 명시한 `BootConfig.locale` 이 `ko`·`en` 이면 그 값을 쓴다.
2. 없으면 브라우저 `navigator.language`(Accept-Language)를 본다. `en*` 이면 `en`, 그 밖은 `ko` 다.
3. 마지막 기본값은 `ko` 다. 기존 위젯이 늘 한국어였으므로 하위 호환이다.

부팅 때 한 번 정해 위젯 전체에 고정한다. 위젯 안에서 언어를 바꾸는 토글은 비목표다. `locale` 을 바꾸려면 `wc:boot` 재전송이 아니라 iframe 을 다시 마운트해야 한다([웹채팅 SDK](CLE-WEBCHAT-SDK.md), [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)). 이 `locale` 은 위젯 UI 언어이며 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)의 안내 문구 언어(`languageLocale`)와 다르다.

**번역 대상은 위젯 고유 문구다.** 전체 목록과 키는 위젯 문구 catalog(`codebase/channel-web-chat/src/lib/i18n/catalog.ts`)에 있다. `resolveLocale` 과 ko·en parity 테스트도 위젯 로컬 catalog(`src/lib/i18n/`)에 있다.

- 대화 컨트롤("새 대화"·"대화 종료"·닫기·"새 대화 시작"), 2단계 확인 문구, 입력창 placeholder, 전송·"AI 응답 중" aria-label, 상태·에러(`GENERIC_ERROR_MESSAGE`, 명령 실패 안내), form "선택"·"제출", carousel 이전·다음, chart 범례, table·carousel 잘림 배너("총 N개 중 일부만 표시돼요.", table 무개수 "일부 행만 표시돼요.", carousel 무개수 "일부 항목만 표시돼요."), 런처 "채팅 열기"·안 읽음 배지.
- 경계 규칙 (1): 위젯에 하드코딩한 기본값(예: `headerTitle` 이 없을 때 쓰는 "AI 어시스턴트")은 위젯 고유 문구라 번역한다. 운영자가 넣은 값은 번역하지 않는다.
- 경계 규칙 (2): 이미 영어인 위젯 고유 문구(chart aria-label `pie chart` 등)도 ko 키를 새로 만들어 parity 를 맞춘다.
- 경계 규칙 (3): Form 검증 실패 문구(`details[].message`)는 백엔드 페이로드라 번역 대상도 ko·en parity 대상도 아니다([명령 실패](CLE-WEBCHAT-WIDGET-STATE.md#명령-실패)).

**비대상**: 운영자 제공 콘텐츠(`headerTitle`·`welcome`·`launcher.suggestions`·`disclaimer`), 백엔드가 보낸 페이로드(표시물·form 의 `label`), AI 생성 본문. 위젯은 입력 언어 그대로 그린다.

## 구현 위치

- `codebase/channel-web-chat/src/lib/i18n/` (위젯 로컬 catalog · `resolveLocale` · parity 테스트)

## Rationale

### 표시물 렌더는 두 모양을 모두 받고 복원 범위는 대화 스레드 저장 범위를 따른다

렌더러는 표시 전용 Presentation 노드의 `{config, output}` 과 AI 표시 도구의 `PresentationPayload{type, toolCallId, renderedAt, payload, truncation?}` 을 모두 받는다. 후자는 명시된 `type` 으로 분류하고 `payload` 를 정규화하므로 새로고침 복원 대화 스레드의 `turn.presentations[]` 도 라이브와 같게 다시 그린다. `truncation` 은 `payload` 밖 최상위에 있어서 흡수하지 않으면 1MB 잘림 표시가 사라진다. [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)이 이 값을 `output.{rowsTruncated|itemsTruncated}` 와 같은 정보로 정하므로 `output` 으로 흡수해 똑같이 다룬다. 잘리기 전 총 개수(`{itemsTotalCount|rowsTotalCount}`)도 같은 경로로 흡수해 잘림 배너에 함께 보인다(메인 에디터 실행 결과와 같은 동작). 흡수만 하고 쓰지 않으면 죽은 필드가 된다. table 은 `output.{rowsTruncated|rowsTotalCount}`, carousel 은 `output.{itemsTruncated|itemsTotalCount}` 를 각각 `truncated`·`totalCount` 로 옮긴다. 총 개수는 유한한 비음수 정수만 받는다.

렌더러가 복원 표시물을 무시한다는 제약은 없다(2026-07-10 실측). 없는 제약을 적어 두면 이미 있는 변환기를 다시 만들게 되고 진짜 제약이 가려진다. 진짜 복원 제약은 표시 전용 Presentation 노드의 표시물이 대화 스레드에 저장되지 않기 때문이다([표시물 렌더](#표시물-렌더)의 복원 범위 제약). 이것을 대화 스레드에 실으려면 백엔드 항목 출처 enum 이나 대화 기록 항목 필드를 넓혀야 해서 v2 검토 사안이며 [웹채팅](CLE-WEBCHAT.md)의 비목표에 올렸다.

### `locale` 을 켜서 위젯 고유 문구만 다국어로 낸다 (결정 2026-07-12)

v1 위젯은 한국어 전용이라 `locale` 을 예약 필드로만 두었다([웹채팅 SDK](CLE-WEBCHAT-SDK.md)). 영어 지원 착수는 코드 변경이 없는 범위라는 이유로 미뤄 두었고(내용상 기각 아님), 2026-07-12 사용자가 코드 작업을 승인해 예약한 활성화를 실행했다. 명시적으로 예약한 경로라 결정 번복이 아니다.

- **위젯 고유 문구만 (콘텐츠 현지화 기각)**: 운영자 콘텐츠를 언어별로 현지화하려면 부팅 설정 콘텐츠 필드를 언어별 map 으로 넓혀야 하고 운영 콘솔과 서버 저장 스키마가 바뀐다(큰 표면). 첫 가치("위젯이 방문자 언어로 말한다")는 위젯 고유 문구만으로 얻을 수 있어 나눈다.
- **명시 → 자동 감지 → ko (위젯 안 토글 기각)**: 명시값을 먼저 쓰는 것은 운영자 의도를 존중하는 것이다(운영 콘솔은 항상 명시한다). 자동 감지는 설치 스크립트를 그대로 붙인 방문자 경험을, ko 기본값은 하위 호환을 위한 것이다. 위젯 안 사용자 토글은 상태 저장과 표면 추가가 필요해 이번 범위 밖이다.
- **위젯 로컬 catalog (메인 앱 dict 가져오기 기각)**: 별도 정적 번들이라 프론트엔드 dict 를 끌어올 수 없다. 경량 로컬 catalog 가 번들 크기와 iframe 격리를 지키고 ko·en parity 는 위젯 로컬 테스트가 지킨다.
