---
id: "CLE-WEBCHAT-WIDGET"
title: "웹채팅 위젯"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-WCWIDGET-001", "REQ-WCWIDGET-002", "REQ-WCWIDGET-003", "REQ-WCWIDGET-004", "REQ-WCWIDGET-005", "REQ-WCWIDGET-006", "REQ-WCWIDGET-007", "REQ-WCWIDGET-008", "REQ-WCWIDGET-009", "REQ-WCWIDGET-010", "REQ-WCWIDGET-011", "REQ-WCWIDGET-012", "REQ-WCWIDGET-013", "REQ-WCWIDGET-014", "REQ-WCWIDGET-015", "REQ-WCWIDGET-016", "REQ-WCWIDGET-017", "REQ-WCWIDGET-018", "REQ-WCWIDGET-019", "REQ-WCWIDGET-020", "REQ-WCWIDGET-021", "REQ-WCWIDGET-022", "REQ-WCWIDGET-023", "REQ-WCWIDGET-024", "REQ-WCWIDGET-025", "REQ-WCWIDGET-026", "REQ-WCWIDGET-027", "REQ-WCWIDGET-028", "REQ-WCWIDGET-029", "REQ-WCWIDGET-030", "REQ-WCWIDGET-031", "REQ-WCWIDGET-032", "REQ-WCWIDGET-033", "REQ-WCWIDGET-034", "REQ-WCWIDGET-035", "REQ-WCWIDGET-036", "REQ-WCWIDGET-037", "REQ-WCWIDGET-038", "REQ-WCWIDGET-039", "REQ-WCWIDGET-040", "REQ-WCWIDGET-041", "REQ-WCWIDGET-042", "REQ-WCWIDGET-043", "REQ-WCWIDGET-044", "REQ-WCWIDGET-045", "REQ-WCWIDGET-046", "REQ-WCWIDGET-047", "REQ-WCWIDGET-048", "REQ-WCWIDGET-049", "REQ-WCWIDGET-050", "REQ-WCWIDGET-051", "REQ-WCWIDGET-052", "REQ-WCWIDGET-053", "REQ-WCWIDGET-054", "REQ-WCWIDGET-055", "REQ-WCWIDGET-056"]
basis_superseded: false
parent: "CLE-WEBCHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT"]
area: "CLE-WEBCHAT"
content_hash: "205eb15c4491986323ca08fd3b07530834b7e45b322eac438ff2d66efbd6e1e4"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/7-channel-web-chat/1-widget-app.md"]
mirror_sha256: "e32b69b358adc0f1b57aedb94d433dc603fc6d2d0919424f92b1dd68d5563841"
etag: "sha256-b871d220a2607fb4dcf0ad3945bebe16956e26c730d02ab4a54340e5fe14663b"
---
> 구현 상태: 구현됨 · 원문: `spec/7-channel-web-chat/1-widget-app.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 iframe 안에서 도는 웹채팅 위젯(web chat widget)을 정한다. 위젯은 `codebase/channel-web-chat` 의 Next.js 앱이며 CSR 전용 정적 export 로 빌드한다. 다루는 것은 런처·패널(launcher, panel) 화면, 위젯 대화 상태(widget state) 전이, 대화 종료·새 대화·새로고침 복원, 닫힌 동안 도착한 메시지의 안 읽음 처리, 즉시 시작(eager start)과 런처 버블 큐 게이팅, 위젯 고유 문구(widget chrome)의 다국어 처리다.

범위 밖 주제는 링크로 대신한다. 위젯이 쓰는 EIA 표면 매핑은 [웹채팅 구조](CLE-WEBCHAT-ARCH.md), 토큰과 위젯 세션·재로드 분기는 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md), 호스트 명령과 부팅 설정은 [웹채팅 SDK](CLE-WEBCHAT-SDK.md), 임베드 검증과 sanitize 는 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md)이 정한다.

## 요구사항

- REQ-WCWIDGET-001 WHEN 위젯을 빌드하면 THE SYSTEM SHALL `output: 'export'` 정적 번들로 내보내 Node 서버 런타임 없이 위젯 배포 주소에서 정적 파일로 서빙한다.
- REQ-WCWIDGET-002 WHEN 위젯 UI 컴포넌트를 만들면 THE SYSTEM SHALL 모든 컴포넌트를 Client Component(`'use client'`)로 두고 Server Component 데이터 페칭·Server Actions·Route Handlers 를 쓰지 않는다.
- REQ-WCWIDGET-003 WHEN 채팅 화면을 불러오면 THE SYSTEM SHALL `next/dynamic` 과 `ssr: false` 로 불러와 prerender 단계에서도 SSR 을 뺀다.
- REQ-WCWIDGET-004 WHEN 사용자가 런처의 추천 질문 버블을 누르면 THE SYSTEM SHALL 패널을 열고 그 텍스트를 큐에 담는다.
- REQ-WCWIDGET-005 WHEN 첫 `awaiting_user_message` 의 표면이 `ai_conversation` 이면 THE SYSTEM SHALL 큐에 담긴 텍스트를 `submit_message` 로 보낸다.
- REQ-WCWIDGET-006 IF 첫 대기 표면이 `buttons` 또는 `form` 이면 THE SYSTEM SHALL 큐에 담긴 텍스트를 보내지 않고 버린다.
- REQ-WCWIDGET-007 WHEN 패널이 처음 열리면 THE SYSTEM SHALL 환영 메시지와 추천 질문을 바로 그리고 동시에 `POST /api/hooks/:path { profile }` 로 실행을 시작한다.
- REQ-WCWIDGET-008 WHEN 첫 `execution.waiting_for_input` 이 도착하면 THE SYSTEM SHALL `interactionType` 에 맞는 첫 표면(입력창·선택지·폼)을 바로 그린다.
- REQ-WCWIDGET-009 WHEN 실행을 시작하면 THE SYSTEM SHALL 웹훅 페이로드에 `profile` 만 싣고 `firstMessage` 를 싣지 않는다.
- REQ-WCWIDGET-010 WHEN 닫은 패널을 다시 열면 THE SYSTEM SHALL 새 실행을 시작하지 않고 위젯 세션을 복원해 기존 대화를 잇는다.
- REQ-WCWIDGET-011 WHILE 위젯 대화 상태가 `streaming` 또는 `awaiting_user_message` 인 동안 THE SYSTEM SHALL 헤더에 "새 대화"·"대화 종료" 컨트롤을 표시한다.
- REQ-WCWIDGET-012 WHILE 위젯 대화 상태가 `collapsed`·`panel`·`booting`·`ended` 인 동안 THE SYSTEM SHALL 헤더의 "새 대화"·"대화 종료" 컨트롤을 표시하지 않는다.
- REQ-WCWIDGET-013 WHEN 사용자가 헤더의 "새 대화" 또는 "대화 종료" 를 누르면 THE SYSTEM SHALL 인라인 2단계 확인을 받은 뒤 실행한다.
- REQ-WCWIDGET-014 WHEN 사용자가 닫기를 누르면 THE SYSTEM SHALL 패널만 접고 실행의 입력 대기와 SSE 연결을 유지한다.
- REQ-WCWIDGET-015 WHILE 패널이 접혀 있는 동안 THE SYSTEM SHALL 도착한 메시지를 버퍼에 담고 안 읽음 배지를 표시한다.
- REQ-WCWIDGET-016 WHEN 접힌 패널을 다시 열면 THE SYSTEM SHALL 버퍼에 담긴 메시지를 그린다.
- REQ-WCWIDGET-017 WHEN 사용자가 AI 대화 대기(`awaiting_user_message` + `ai_conversation` + 대기 노드 ID 확정) 중에 대화 종료를 확인하면 THE SYSTEM SHALL `end_conversation` 을 보낸다.
- REQ-WCWIDGET-018 WHEN 사용자가 그 밖의 상태(응답을 기다리는 `streaming`, `buttons`·`form` 대기, 대기 노드 ID 미확정)에서 대화 종료를 확인하면 THE SYSTEM SHALL `cancel` 을 보낸다.
- REQ-WCWIDGET-019 WHEN 대화를 종료하면 THE SYSTEM SHALL SSE 를 먼저 닫고 위젯 세션을 정리해 `[ended]` 로 바꾼 뒤 종료 명령을 best-effort 로 보낸다.
- REQ-WCWIDGET-020 IF 종료 명령이 실패하거나 거부되면(`410 Gone`·`409 STATE_MISMATCH`·네트워크) THE SYSTEM SHALL 로컬 종료 상태를 되돌리지 않는다.
- REQ-WCWIDGET-021 WHEN 새 대화를 시작하면 THE SYSTEM SHALL 위젯 세션과 스트림을 정리한 뒤 새 `POST /api/hooks/:path` 로 새 실행 ID 와 토큰을 받는다.
- REQ-WCWIDGET-022 WHEN 확립된 대화(`streaming`·`awaiting_user_message`)에서 새 대화를 시작하면 THE SYSTEM SHALL 새 시작 전에 이전 실행에 best-effort `cancel` 을 보낸다.
- REQ-WCWIDGET-023 IF 새 대화 전의 `cancel` 이 실패하거나 거부되면 THE SYSTEM SHALL 로컬 재시작을 되돌리지 않는다.
- REQ-WCWIDGET-024 WHEN 어느 진입점(패널 열기 즉시 시작·`[ended]` CTA·헤더 "새 대화"·호스트 `resetSession`)에서든 실행을 시작하면 THE SYSTEM SHALL 진행 중인 웹훅 시작 요청을 최대 1개, 살아 있는 실행을 최대 1개로 제한한다.
- REQ-WCWIDGET-025 WHILE 위젯 대화 상태가 `booting` 인 동안 THE SYSTEM SHALL 새로 들어온 호스트 `resetSession` 을 진행 중인 시작에 합치고 두 번째 웹훅 요청과 두 번째 실행을 만들지 않는다.
- REQ-WCWIDGET-026 IF 재로드 복원이 토큰 만료나 복구 불가 응답으로 끝나면 THE SYSTEM SHALL `[ended]` 와 "대화 종료, 새로 시작" 안내를 표시한다.
- REQ-WCWIDGET-027 WHEN 새로고침 뒤 위젯 세션을 복원하면 THE SYSTEM SHALL 대기 표면을 받거나 종료가 확정될 때까지 위젯 대화 상태를 `streaming` 으로 둔다.
- REQ-WCWIDGET-028 WHEN SSE 가 끊겼다가 다시 연결하면 THE SYSTEM SHALL 마지막으로 받은 이벤트의 `Last-Event-Id` 로 연결한다.
- REQ-WCWIDGET-029 WHEN `execution.replay_unavailable` 을 받으면 THE SYSTEM SHALL 상태 조회 스냅샷으로 현재 표면을 다시 맞추고 스트림과 위젯 세션은 유지한다.
- REQ-WCWIDGET-030 IF 재동기화 스냅샷의 상태가 종료(`completed`·`failed`·`cancelled`)면 THE SYSTEM SHALL 위젯 세션을 정리하고 `[ended]` 로 바꾸며 호스트에 `conversationEnded` 를 알린다.
- REQ-WCWIDGET-031 IF 세션을 복원할 때 스냅샷이 이미 종료 상태면 THE SYSTEM SHALL 대화 표면 대신 `[ended]` 화면을 보인다.
- REQ-WCWIDGET-032 WHEN 메시지 리스트를 그리면 THE SYSTEM SHALL `waiting_for_input.conversationThread.turns` 스냅샷과 로컬 라이브 이벤트를 소스로 쓰고 `ai_message.messages[]` 원본을 직접 보이지 않는다.
- REQ-WCWIDGET-033 WHEN 대화 기록 항목을 말풍선으로 그리면 THE SYSTEM SHALL `presentation_user`·`ai_user` 를 user 로, `ai_assistant`·`ai_tool`·`system` 을 assistant 로 그린다.
- REQ-WCWIDGET-034 WHEN 대화 기록 항목의 텍스트를 그리면 THE SYSTEM SHALL `[user-input]…[/user-input]` 마커를 지운다.
- REQ-WCWIDGET-035 WHEN 표시물을 그리면 THE SYSTEM SHALL 노드 출력 형태(`{config, output}`)와 표시물 페이로드(`PresentationPayload`)를 모두 받아들여 같은 렌더러로 그린다.
- REQ-WCWIDGET-036 WHEN 표시물이 잘렸으면(`truncation` 또는 `output.rowsTruncated`·`output.itemsTruncated`) THE SYSTEM SHALL 잘림 배너를 표시하고 총 개수가 있으면 "총 N개 중 일부만 표시돼요." 로 알린다.
- REQ-WCWIDGET-037 IF 잘림 총 개수가 유한한 비음수 정수가 아니면 THE SYSTEM SHALL 개수 없는 문구(table "일부 행만 표시돼요.", carousel "일부 항목만 표시돼요.")로 대신한다.
- REQ-WCWIDGET-038 WHILE `awaiting_user_message` 이고 표면이 텍스트 표면(`ai_conversation` 또는 `pending=null`)인 동안 THE SYSTEM SHALL 자유 텍스트 입력창을 활성화한다.
- REQ-WCWIDGET-039 WHILE `booting`·`streaming` 이거나 표면이 `buttons`·`form` 인 동안 THE SYSTEM SHALL 자유 텍스트 입력창을 비활성화한다.
- REQ-WCWIDGET-040 WHILE `booting`·`streaming` 인 동안 THE SYSTEM SHALL 전송 버튼에 스피너와 `aria-busy=true`, `aria-label="AI 응답 중"` 을 표시한다.
- REQ-WCWIDGET-041 IF Form 제출이 검증에 실패하면 THE SYSTEM SHALL `error.details[{field,message,code}]` 를 표시하고 다시 제출할 수 있게 한다.
- REQ-WCWIDGET-042 WHEN 패널을 그리면 THE SYSTEM SHALL 첨부와 이모지 기능을 비활성화하거나 숨긴다.
- REQ-WCWIDGET-043 WHEN 호스트가 `hide` 를 보내면 THE SYSTEM SHALL 런처와 패널을 모두 그리지 않고 대화와 SSE 는 유지한다.
- REQ-WCWIDGET-044 IF 숨김 상태에서 `open` 이 오면 THE SYSTEM SHALL 패널을 보이지 않는다.
- REQ-WCWIDGET-045 IF 임베드 검증으로 `blocked` 가 되면 THE SYSTEM SHALL 호스트 `show` 로도 풀리지 않는 차단 상태를 유지한다.
- REQ-WCWIDGET-046 WHEN 호스트가 `updateProfile` 을 보내면 THE SYSTEM SHALL 부팅 `profile` 에 얕게 합쳐 다음 실행 시작의 웹훅 페이로드에 반영한다.
- REQ-WCWIDGET-047 IF 진행 중인 실행이 있을 때 `updateProfile` 이 오면 THE SYSTEM SHALL 이미 보낸 `profile` 을 소급해 바꾸지 않는다.
- REQ-WCWIDGET-048 WHEN 위젯이 부팅되면 THE SYSTEM SHALL `locale` 을 명시값 → `navigator.language` → `ko` 순서로 한 번 정해 위젯 전체에 고정한다.
- REQ-WCWIDGET-049 WHEN 위젯 고유 문구를 그리면 THE SYSTEM SHALL 위젯 로컬 catalog 의 `t(key, params?)` 로 ko·en 문구를 고르고 `{{name}}` 보간을 쓴다.
- REQ-WCWIDGET-050 IF ko 와 en catalog 의 leaf key 집합이 다르면 THE SYSTEM SHALL 위젯 로컬 parity 테스트를 실패시킨다.
- REQ-WCWIDGET-051 WHEN 운영자 콘텐츠·백엔드 페이로드 라벨·AI 본문을 그리면 THE SYSTEM SHALL 번역하지 않고 입력 언어 그대로 그린다.
- REQ-WCWIDGET-052 IF 재동기화 상태 조회가 `401` 이고 그 복구로 토큰이 바뀌면 THE SYSTEM SHALL 새 토큰으로 상태를 한 번 더 조회해 현재 표면을 다시 맞춘다.
- REQ-WCWIDGET-053 IF 명령이 실패하고 그 실패로 종료가 확정되지 않으면 THE SYSTEM SHALL `[ended]` 로 가지 않고 명령 실패 안내를 보인 채 현재 표면에서 다시 보낼 수 있게 한다.
- REQ-WCWIDGET-054 IF `submit_message` 가 실패하고 그 사이 SSE 로 새 응답이나 대기 표면이 오지 않았으면 THE SYSTEM SHALL 낙관적으로 그린 사용자 말풍선을 거두고 보낸 글을 입력창에 되돌려 `awaiting_user_message` 로 돌아간다.
- REQ-WCWIDGET-055 IF 명령이 `409` 로 거부되면 THE SYSTEM SHALL 상태 조회 스냅샷으로 현재 표면을 다시 맞추고 스냅샷이 종료 상태면 종료로 확정한다.
- REQ-WCWIDGET-056 WHEN 다음 명령을 보내거나 새 대기 표면을 받으면 THE SYSTEM SHALL 명령 실패 안내를 지운다.

## 하위 문서

- [웹채팅 위젯 — 화면과 문구 다국어](CLE-WEBCHAT-WIDGET-SCREEN.md): 런처 · 패널 · 표시물 렌더 · 입력창과 위젯 고유 문구 다국어. 요구사항 REQ-WCWIDGET-004 ~ 006, 032 ~ 040, 042, 048 ~ 051.
- [웹채팅 위젯 — 대화 상태](CLE-WEBCHAT-WIDGET-STATE.md): 상태 전이, 즉시 시작, 종료 · 새 대화, 복원, 명령 실패, SSE 재연결, 가시성 · profile · 차단. 요구사항 REQ-WCWIDGET-007 ~ 031, 041, 043 ~ 047, 052 ~ 056.

대화 상태 문서가 다른 문서 요구사항을 따르거나 그 예외가 되는 곳은 다음과 같다. 하위 문서 본문에는 번호 대신 요구사항 절 링크를 둔다.

- 명령 실패 `410 Gone` 은 REQ-WCSESS-030, 명령 `401` 은 REQ-WCSESS-038 ~ 040 을 따른다.
- SSE 재동기화 상태 조회의 `401` 복구는 REQ-WCSESS-024 ~ 027 을 따른다.
- Form 검증 실패 문구(`details[].message`)를 그대로 보이는 것은 REQ-WCSEC-026 의 예외다.

이 문서에는 Next.js CSR 전용 구성(REQ-WCWIDGET-001 ~ 003)을 둔다.

## Next.js CSR 전용 구성

- `next.config.js` 는 `output: 'export'` 다. 정적 export 라 Node 서버 런타임이 없고 위젯 배포 주소에서 정적 파일로 서빙한다. 위젯 배포 주소의 기본값은 배포 자신의 origin 에 동봉한 경로이고 외부 CDN 은 선택이다([웹채팅 구조](CLE-WEBCHAT-ARCH.md#동봉-배포와-버전-잠금)).
- 모든 UI 컴포넌트는 Client Component(`'use client'`)다. 데이터 페칭과 상태는 모두 브라우저 런타임에서 처리한다.
- Server Component 데이터 페칭·Server Actions·Route Handlers 는 쓰지 않는다.
- 채팅 화면은 `next/dynamic(() => import(...), { ssr: false })` 로 불러와 prerender 단계에서도 SSR 을 뺀다.
- (권장) `export const dynamic = 'force-static'`. 런타임 외부 입력은 URL 쿼리와 postMessage 로만 받는다.
- 산출물은 `out/` 정적 번들이며 위젯 배포 주소로 나간다. 근거와 대안은 [Rationale](#rationale)에 있다.

## 패널

→ [웹채팅 위젯 — 화면과 문구 다국어](CLE-WEBCHAT-WIDGET-SCREEN.md#패널)

## 표시물 렌더

→ [웹채팅 위젯 — 화면과 문구 다국어](CLE-WEBCHAT-WIDGET-SCREEN.md#표시물-렌더)

## 위젯 고유 문구 다국어

→ [웹채팅 위젯 — 화면과 문구 다국어](CLE-WEBCHAT-WIDGET-SCREEN.md#위젯-고유-문구-다국어)

## 명령 실패

→ [웹채팅 위젯 — 대화 상태](CLE-WEBCHAT-WIDGET-STATE.md#명령-실패)

## 미결 사항

- **새 대화의 명령 순서와 종료 이벤트 경합**: [웹채팅 SDK](CLE-WEBCHAT-SDK.md)는 새 대화 순서를 `cancel` → 스트림 닫기 → 위젯 세션 비우기 → 시작으로 적는다. 이 문서의 대화 종료는 종료 이벤트와 겹치지 않도록 SSE 를 먼저 닫는다. 새 대화 순서대로면 `execution.cancelled` 가 아직 열린 스트림에 도착해 `[ended]` 로 바뀌는 경합이 이론상 가능하다. `cancel` 이 fire-and-forget 이라 경합이 없는지, 순서를 바꿔야 하는지 확인이 필요하다. 실제 경합 여부는 확인되지 않았다.
- **호스트 `sendMessage` 의 위젯 쪽 처리**: SDK 는 `sendMessage(text)` 를 공개 API 와 `wc:command` 로 노출한다. 이 문서는 `booting`, `buttons`·`form` 표면, `[ended]` 에서 이 명령을 어떻게 처리할지(큐에 담기·버리기·무시) 정하지 않았다. 런처 버블 큐 게이팅을 그대로 적용하는지도 정해지지 않았다. 결정 필요.
- **웹훅 시작 실패 때의 동작**: 운영 콘솔에서 웹채팅 인스턴스를 끄면 웹훅이 `410` 을 낸다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)). 공개 웹훅 가드는 `429`·`413` 을 낸다([웹채팅 보안](CLE-WEBCHAT-SECURITY.md)). 이 문서의 상태 전이는 `booting` 에서 웹훅이 실패할 때의 전이와 표시를 정하지 않았다. 보안 문서의 "에러 → `[ended]` + 새 대화 시작" 이 이 경로에도 적용되는지, 꺼진 트리거에 embed-config 가 어떻게 응답하는지도 정해지지 않았다. 결정 필요. 명령 실패 뒤의 전이는 [명령 실패](CLE-WEBCHAT-WIDGET-STATE.md#명령-실패)에서 정했다.

## 구현 위치

- `codebase/channel-web-chat/**`

## Rationale

### Next.js CSR 전용으로 만든다 (Vite SPA·SSR 기각)

위젯은 iframe 안 SPA 라 SSR 의 이점(SEO·TTFB)이 없다. 정적 export 가 정적 파일 호스팅(동봉 배포나 CDN)과 iframe 임베드에 가장 맞다. CSR 강제는 정적 export, 모든 컴포넌트 `'use client'`, 채팅 화면 `dynamic(ssr:false)`, route handler·server action 미사용으로 한다. Vite SPA 가 더 가볍지만 조직 표준(프론트엔드가 Next.js)과 사용자 요구에 맞춰 Next.js 를 쓴다. 정적 export 라 사실상 SPA 와 같다.
