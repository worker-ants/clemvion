# Spec 감사 — 7-channel-web-chat

## 요약

- 감사 파일 수: **6개**
- severity 분포: **none 2** · **minor 3** · **major 1** · **severe 0**
- 핵심 메시지:
  - 이 영역 spec 전반은 코드(SDK·bridge·EIA 클라이언트·위젯 SPA·백엔드 인증/세션·CORS·남용방어)와 **강하게 정합**한다. 대부분의 drift 는 서술 정밀성 격차(minor) 수준.
  - 가장 시급한 항목은 `4-security.md` §2.1 의 **stale 현황 서술** — path-scope CORS delegate 가 이미 구현 완료됐는데 spec 은 "위젯 CDN/고객 도메인 브라우저 요청이 차단된다"는 구현 이전 스냅샷을 기술(major).
  - 반복 패턴: "loader/boot() 가 launcher 를 호스트 DOM 에 주입" 표현이 3개 문서(0-architecture §1/§5.1, 2-sdk §1)에 걸쳐 부정확 — 실제로는 iframe 하나만 주입하고 런처는 iframe 내부 위젯 SPA 가 렌더.

## 파일별 발견사항

### spec/7-channel-web-chat/4-security.md  — major / partial / patch-content, fix-code-paths

- **headline**: §4 남용방어·§3 임베드 soft검증·CORS delegate 는 코드와 정확히 일치하나, §2.1 '현황(코드 SoT)' 가 path-scope CORS 구현 이전 상태를 기술해 stale.

| claim | reality | evidence | severity |
| --- | --- | --- | --- |
| §2.1: backend 는 main.ts 전역 단일 `app.enableCors({ origin: corsOriginCallback })` 하나로 모든 라우트에 frontend origin allowlist 적용, 위젯 CDN/고객 도메인은 '현 상태로는 브라우저 요청이 차단된다' | 코드는 이미 path-scope CORS delegate(`createWebChatCorsDelegate`) 도입 완료. main.ts:151-162 가 widgetOrigins+resolveAllowlist 로 `/api/hooks/*` 무제한, `/api/external/executions/:id/*` 워크스페이스 allowlist 분기. corsOriginCallback 은 default(비-웹채팅) 분기로만 사용 → '브라우저 요청 차단' 서술은 더 이상 사실 아님 | codebase/backend/src/main.ts:150-162; codebase/backend/src/common/cors/web-chat-cors.ts:74-106 | **major** |
| §2.1 '구현 제약' 불릿: 경로-스코프 CORS 분리 도입, 전역 enableCors 는 그 경로 제외, preflight(OPTIONS)에서도 path param 으로 allowlist 조회해 Origin echo | 전부 구현됨(HOOKS_PATH_RE/EXTERNAL_EXEC_PATH_RE 분기, external 은 execution id 역인덱스, 단일 delegate 라 이중 ACAO 없음). 단 spec 은 이를 '제약(=TODO)' 으로 framing 해 implemented 부분이 미구현처럼 읽힘 | codebase/backend/src/common/cors/web-chat-cors.ts:11-12,78-104; web-chat-cors-origin.resolver.ts:27-51 | minor |
| §4 '구현됨 v1' 의 SoT 파일(PublicWebhookThrottleGuard/PublicWebhookQuotaService)가 frontmatter code: 글로브에 미포함 | code: 는 cors/web-chat-cors.ts, web-chat-cors/**, host-bridge.ts 만 나열. §4 핵심 구현은 codebase/backend/src/modules/hooks/public-webhook-{throttle.guard,quota.service}.ts 인데 글로브가 이를 닮지 못함 | spec/7-channel-web-chat/4-security.md:4-7 | minor |

- **frontmatterIssues**:
  - code: 글로브 3개 전부 실존하나 §4 핵심 구현 PublicWebhookThrottleGuard/PublicWebhookQuotaService 미포함 → `codebase/backend/src/modules/hooks/public-webhook-*` 추가 권장.
  - status: partial 적절(동시≤3 캡 v1.1 이연, 메시지 4KB·비용가드 followup, hard frame-ancestors opt-in 미구현). §2 CORS·§3 soft 검증·§4 rate-limit v1 surface 는 구현 완료.
- **structuralNotes**: 파일명 4-security.md, 영역 폴더 내 N-name.md 상세 문서로 컨벤션 부합. frontmatter id/status/code 구비. 구조적 문제 없음.

### spec/7-channel-web-chat/0-architecture.md  — minor / partial / keep, patch-content

- **headline**: 아키텍처 spec 은 코드(SDK·bridge·EIA 클라이언트·위젯 SPA)와 강하게 일치. §1/§5.1 "loader 가 launcher 주입" 표현만 부정확(런처는 iframe SPA 내부 렌더)인 minor 수준.

| claim | reality | evidence | severity |
| --- | --- | --- | --- |
| §1·§5.1: loader/boot() 가 launcher + iframe 을 (호스트 DOM 에) 주입 | boot() 는 iframe 하나만 host body 에 append(bridge.ts:47-54). 런처는 iframe 내부 위젯 SPA 에서 렌더. R7 '단일 iframe(크기 토글)' 모델과 정합하나 §1·§5.1 본문이 호스트에 별도 launcher DOM 주입처럼 읽힘 | codebase/packages/web-chat-sdk/src/bridge.ts:47-54; channel-web-chat/src/widget/widget-app.tsx:27; .../components/launcher.tsx:12 | minor |
| §3 EIA 매핑: 토큰 갱신 POST .../refresh-token (per_execution) | 코드는 endpoints.refresh(`/api/external/executions/{id}/refresh-token`)로 호출 — EIA spec §5.5/L232 와 동일. 일치 | codebase/channel-web-chat/src/lib/eia-client.ts:81-91; eia-types.ts:5-22; spec/5-system/14-external-interaction-api.md:232,415 | minor |

- **frontmatterIssues**:
  - code: 글로브 2개(channel-web-chat/**, packages/web-chat-sdk/**) 모두 실제 다수 구현 파일에 매치 — 정상.
  - status: partial 합리적. 핵심 표면은 구현됐으나 §4 배포 placeholder(`<widget-cdn-base>`/`<api-base>`) 미확정·M2(BYO-UI) v1 비주력이라 implemented 승격 시기상조. pending_plans 2개 모두 실재.
- **structuralNotes**: 네이밍/위치 정상. 0-architecture.md = 영역 기술개요(루트 _product-overview.md 와 역할 분리), 1·2·3·4-*.md 연번 일관. 영역 7- 신규 top-level 은 R6 근거와 일치.

### spec/7-channel-web-chat/2-sdk.md  — minor / partial / keep

- **headline**: SDK 패키지 코어(타입·boot 검증·wc:* bridge·명령 큐·data-global)는 spec 과 정밀 일치. EIA/SSE 연동·launcher 주입만 미구현인데 status=partial 로 이미 정확.

| claim | reality | evidence | severity |
| --- | --- | --- | --- |
| §2: web-chat 은 기존 @workflow/sdk(EIA HTTP/SSE 클라이언트) 재사용, 의존 방향 web-chat → @workflow/sdk | SDK src 어디에도 @workflow/sdk import 나 EIA/SSE/EventSource/fetch 호출 없음. @workflow/sdk 는 devDependencies 에만 존재. EIA 호출 배선 미구현(주석으로 '후속' 명시) | codebase/packages/web-chat-sdk/src/index.ts:5; package.json:17,29 | minor |
| §1 line55: loader.js 책임에 'launcher 주입' 명시 | 코드는 fixed-position iframe 하나만 주입, wc:resize 로 collapsed↔expanded 조절. 별도 launcher DOM 주입 없음(런처는 iframe 내부 렌더). 4개 책임 중 launcher 주입만 부재 | codebase/packages/web-chat-sdk/src/bridge.ts:47-54,145-156 | minor |
| §3 표 line86: iframe→host 'wc:event' 페이로드가 open/close/message/unread/conversationStarted/conversationEnded | 표는 이벤트 '이름 집합' 나열, 실제 wire 페이로드는 `{ name, data }` 구조. 모순은 아니나 표만 보면 와이어 포맷 오해 가능 | codebase/packages/web-chat-sdk/src/bridge.ts:129-132 | minor |

- **frontmatterIssues**:
  - code 글로브 codebase/packages/web-chat-sdk/** 정확히 매치(11개 소스/예제). 죽은 글로브 아님.
  - status=partial 정확히 부합: 공개 타입·boot 검증·bridge·명령 큐·iframe 주입·data-global·origin 검증·구독해제 구현 완료, EIA 클라이언트 배선·launcher 주입만 미완. 변경 불필요.
- **structuralNotes**: 네이밍·연번·위치 적절. §5 ChatInstance 타입을 메서드 계약 SoT 로 못박은 구조가 코드(types.ts)와 1:1 일치.

### spec/7-channel-web-chat/1-widget-app.md  — minor / partial / keep

- **headline**: 위젯 SPA spec 은 코드와 대체로 정합 — CSR 구성·상태기계·UI 요소·interaction 매핑 일치. 헤더 "뒤로" 버튼 부재 등 minor drift 만 존재.

| claim | reality | evidence | severity |
| --- | --- | --- | --- |
| §2 패널 헤더에 '뒤로/닫기' 버튼(아바타는 차기 phase) | panel.tsx 헤더는 제목·닫기(✕) 버튼만 렌더. '뒤로'(back) 버튼 코드에 부재 | codebase/channel-web-chat/src/widget/components/panel.tsx:42-47 | minor |
| §1 (권장) `export const dynamic = 'force-static'` | 코드 어디에도 선언 없음. 단 spec 이 '(권장)' 으로 명시해 강제 아님 — 정보성 | grep 'export const dynamic' → 0 매치; page.tsx, layout.tsx 미선언 | minor |
| §2 메시지리스트: ai_message.messages[] raw 직접 노출 금지, 1차 소스 = waiting_for_input.conversationThread.turns snapshot | 코드 일치 — handleEiaEvent 가 thread snapshot 을 threadToMessages 변환, conversation.ts 가 [user-input] 마커 strip + source 폴백 'live'. ai_message 는 text/presentations 만 append | src/widget/use-widget.ts:110-131; src/lib/conversation.ts:35-50 | minor |

- **frontmatterIssues**:
  - status: partial — 아바타·첨부/이모지 v1 비활성·다중세션 비목표 등 spec 이 명시적 deferred 표기. 강등/승격 불필요.
  - code glob 'codebase/channel-web-chat/**' 정상(실제 38 파일 매치, stale 아님). pending_plans 2건 실존.
- **structuralNotes**: 네이밍/연번/위치 컨벤션 준수. 상단 관련 링크는 동일 영역 문서 가리킴.

## 일치 확인됨 (drift 없음, severity none)

- **spec/7-channel-web-chat/3-auth-session.md** — keep / partial: 인증/세션 흐름(엔드포인트·202 응답 shape·토큰 전략·refresh 30분 윈도우·새로고침 지속)이 채널 위젯·EIA 백엔드 구현과 정밀 일치. (참고: 복원 경로는 SSE 재연결만 사용하고 spec 의 'GET /:id+SSE' 중 GET /:id 단발조회는 미사용 옵션 — informational.)
- **spec/7-channel-web-chat/_product-overview.md** — keep / N/A: 제품 정의/인덱스 문서로 컴포넌트 A/B/C·이중 배포표면·M1/M2·EIA 인터랙션 모두 구현과 일치. (참고: `ai_form_render` 를 별도 렌더 종류로 병렬 나열한 표기는 미세 imprecision — 실제로는 ai_conversation 페이로드 경로로 통합 처리. 0-architecture §66 이 정확히 기술.) 인덱스 문서라 frontmatter 부재는 정상.

## 영역 구조·네이밍 이슈

- 영역 전체가 네이밍/연번/위치 컨벤션을 준수한다: `_product-overview.md`(제품정의 인덱스) · `0-architecture.md`(기술개요) · `N-name.md`(1-widget-app, 2-sdk, 3-auth-session, 4-security 상세) 역할 분리 명확.
- 영역 7- 신규 top-level 채택은 R6 근거와 정합. 죽은 cross-ref 없음(5-system/14·12·15, conventions/conversation-thread 등 모두 실존).
- 정규화 제안은 콘텐츠 차원 1건뿐: **4-security.md frontmatter `code:` 에 `codebase/backend/src/modules/hooks/public-webhook-*` 추가** — §4 가 SoT 로 선언한 ThrottleGuard/QuotaService 가 현재 글로브에 미포착.

## 우선 액션 (정렬)

1. **[major] spec/7-channel-web-chat/4-security.md §2.1 stale 현황 재작성** — path-scope CORS delegate(`createWebChatCorsDelegate`, main.ts:151-162, web-chat-cors.ts:74-106)가 이미 구현 완료됨을 반영. "위젯 CDN/고객 도메인 브라우저 요청이 차단된다" 서술 삭제, '구현 제약(TODO)' framing → '구현됨' framing 으로 전환.
2. **[minor] spec/7-channel-web-chat/4-security.md frontmatter code: 보강** — `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`·`public-webhook-quota.service.ts` 글로브 추가(§4 SoT 와 정합).
3. **[minor] loader/boot() 'launcher 주입' 표현 정정 (3곳)** — `0-architecture.md` §1/§5.1, `2-sdk.md` §1 line55. "loader 가 launcher 를 호스트 DOM 에 주입" → "loader 는 iframe 하나만 주입, 런처는 iframe 내부 위젯 SPA 가 렌더(단일 iframe 크기 토글 모델)" 로 통일.
4. **[minor] spec/7-channel-web-chat/2-sdk.md §3 표 line86 와이어 포맷 주석** — iframe→host 'wc:event' 페이로드가 `{ name, data }` 구조임을 명시(이름 집합 나열과 구분).
5. **[minor] spec/7-channel-web-chat/1-widget-app.md §2 헤더 버튼 정정** — '뒤로/닫기' → '닫기(✕)' 만 v1 렌더, '뒤로'는 미구현/deferred 로 명확화.
6. **[informational] spec/7-channel-web-chat/3-auth-session.md §3 복원 경로** — 'GET /:id + SSE' 중 GET /:id 는 현재 복원에서 미사용(SSE 재연결만)임을 옵션으로 표기하거나 GET /:id 제거.
7. **[informational] spec/7-channel-web-chat/_product-overview.md §2/§4 `ai_form_render` 표기** — 별도 렌더 종류 병렬 나열을 'ai_conversation 경로 통합 처리'로 미세 정정.
