---
id: "CLE-WEBCHAT-SECURITY"
title: "웹채팅 보안"
type: "feature"
version: 4
status: "approved"
requirements: ["REQ-WCSEC-001", "REQ-WCSEC-002", "REQ-WCSEC-003", "REQ-WCSEC-004", "REQ-WCSEC-005", "REQ-WCSEC-006", "REQ-WCSEC-007", "REQ-WCSEC-008", "REQ-WCSEC-009", "REQ-WCSEC-010", "REQ-WCSEC-011", "REQ-WCSEC-012", "REQ-WCSEC-013", "REQ-WCSEC-014", "REQ-WCSEC-015", "REQ-WCSEC-016", "REQ-WCSEC-017", "REQ-WCSEC-018", "REQ-WCSEC-019", "REQ-WCSEC-020", "REQ-WCSEC-021", "REQ-WCSEC-022", "REQ-WCSEC-023", "REQ-WCSEC-024", "REQ-WCSEC-025", "REQ-WCSEC-026", "REQ-WCSEC-027", "REQ-WCSEC-028", "REQ-WCSEC-029", "REQ-WCSEC-030", "REQ-WCSEC-031"]
basis_superseded: false
parent: "CLE-WEBCHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT"]
area: "CLE-WEBCHAT"
content_hash: "735722165c7a7a9825214d4b4934253378a0edfc4f1d42665409a52d56608ce2"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/7-channel-web-chat/4-security.md"]
mirror_sha256: "55d2eeff7aefa75e058d13426a0c45c81686976a72ed9413121f4a88a0379932"
etag: "sha256-ac0a48c0ad9a5481fef148cd9be105079ebae1ed3ca738cac90e1be43197e839"
---
> 구현 상태: 구현됨 · 원문: `spec/7-channel-web-chat/4-security.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 웹채팅 위젯(임베드형 공개 챗봇)의 보안 표면을 정한다. 두 공개 표면의 CORS(`/api/hooks/*` 는 제한 없음, `/api/external/*` 는 워크스페이스 허용 목록), 무단 임베드를 막는 임베드 검증(embed check), 인증 없는 공개 웹훅의 남용 방어(호출 수 제한·크기 제한·비용 가드), 프라이버시와 데이터 처리 책임의 경계, 입력 sanitize(XSS 방지), iframe sandbox 를 다룬다.

봇이 공개(`auth_config_id IS NULL`)라서 임베드 제어와 CORS 는 확실한 보안 경계가 아니라 가벼운 오남용을 막는 soft 컨트롤이다. 실제 위험인 인프라 부하와 LLM 토큰 비용은 여러 층의 best-effort 다층 방어로 막는다.

범위 밖 주제는 링크로 대신한다. 제품 정의는 [웹채팅](CLE-WEBCHAT.md), 토큰과 위젯 세션은 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md), 위젯 배포 주소와 env 설정은 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)가 정한다. EIA 자체의 호출 수 제한과 CORS 원칙은 [External Interaction API](../CLE-IX/CLE-EIA.md), 웹훅 일반 규칙(설정 키·에러 코드·Redis 키 포함)은 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md), 임베드 허용 도메인 설정 화면은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)가 정한다.

## 요구사항

- REQ-WCSEC-001 WHEN `/api/hooks/*` 요청이 오면 THE SYSTEM SHALL 모든 origin 을 허용하고(요청 Origin 을 그대로 돌려주는 `origin: true`) `credentials: false` 로 응답한다.
- REQ-WCSEC-002 WHEN `/api/external/executions/:id` 와 그 하위 경로 요청이 오면 THE SYSTEM SHALL `:id` 로 실행 → 워크플로우 → 워크스페이스를 찾아 위젯 배포 주소 origin(`WEB_CHAT_WIDGET_ORIGINS`)과 워크스페이스 `interactionAllowedOrigins` 의 합집합과 `Origin` 을 비교한다.
- REQ-WCSEC-003 IF `Origin` 이 그 합집합에 없거나 워크스페이스를 찾지 못하면 THE SYSTEM SHALL CORS 를 허용하지 않는다.
- REQ-WCSEC-004 WHEN `/api/external/executions/:id` 경로의 preflight(OPTIONS) 요청이 오면 THE SYSTEM SHALL 토큰 없이 경로의 `:id` 만으로 같은 판정을 한다.
- REQ-WCSEC-005 WHEN 그 밖의 라우트 요청이 오면 THE SYSTEM SHALL 기존 프론트엔드 허용 목록(`CORS_ORIGINS` → `FRONTEND_URL`)과 `credentials: true` 를 적용하고 위젯·BYO-UI origin 을 이 분기에 넣지 않는다.
- REQ-WCSEC-006 WHEN CORS 를 적용하면 THE SYSTEM SHALL 단일 CORS 레이어(`webChatCorsDelegate`)에서 경로별 정책을 골라 `Access-Control-Allow-Origin` 헤더가 두 번 붙지 않게 한다.
- REQ-WCSEC-007 WHEN 실행 → 워크스페이스 역인덱스를 찾으면 THE SYSTEM SHALL 결과를 60초 TTL 로 캐시한다.
- REQ-WCSEC-008 WHEN 위젯이 부팅되면 THE SYSTEM SHALL embed-config 를 조회하고 호스트 origin(`window.location.ancestorOrigins[0]`, 없으면 `document.referrer`)을 허용 목록과 비교한다.
- REQ-WCSEC-009 IF 호스트 origin 이 허용 목록에 없고 `enforce=true` 면 THE SYSTEM SHALL 위젯을 그리지 않고 시작을 막는 `blocked` 상태로 둔다.
- REQ-WCSEC-010 IF 허용 목록이 비었거나 `enforce=false` 면 THE SYSTEM SHALL 임베드 검증을 통과시킨다.
- REQ-WCSEC-011 IF 호스트 origin 을 알아낼 수 없으면 THE SYSTEM SHALL 임베드 검증을 통과시킨다.
- REQ-WCSEC-012 WHEN 존재하지 않는 경로·DB 에러·인증 웹훅에 대한 embed-config 조회가 오면 THE SYSTEM SHALL 모두 `200` 과 `{ data: { allowlist: [], enforce: false } }` 로 똑같이 응답한다.
- REQ-WCSEC-013 WHEN embed-config 에 응답하면 THE SYSTEM SHALL `Cache-Control: public, max-age=300` 을 붙인다.
- REQ-WCSEC-014 WHEN 채팅 채널 트리거가 아닌 공개 웹훅에 대화 시작 요청이 오면 THE SYSTEM SHALL IP 마다 분당 10건의 시작 한도를 적용하고 넘으면 `429 PUBLIC_WEBHOOK_RATE_LIMIT` 로 거부한다.
- REQ-WCSEC-015 WHEN 채팅 채널 트리거가 아닌 공개 웹훅에 대화 시작 요청이 오면 THE SYSTEM SHALL IP 마다 시간당 신규 20건의 누적 상한을 적용하고 넘으면 `429 PUBLIC_WEBHOOK_HOURLY_LIMIT` 로 거부한다.
- REQ-WCSEC-016 IF 클라이언트 IP 를 헤더(`X-Forwarded-For`, 신뢰할 때 `CF-Connecting-IP`)로 알아내지 못하면 THE SYSTEM SHALL 식별하지 못한 요청 전체를 공유 버킷 하나에 묶어 같은 한도를 적용한다.
- REQ-WCSEC-017 WHEN 클라이언트 IP 를 정하면 THE SYSTEM SHALL `req.ip`·`req.socket.remoteAddress` 로 대신하지 않는다.
- REQ-WCSEC-018 IF 채팅 채널 트리거가 아닌 공개 웹훅 요청 본문이 32KB 를 넘으면 THE SYSTEM SHALL 요청을 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` 로 거부한다.
- REQ-WCSEC-019 IF Redis 를 쓸 수 없거나 가드의 트리거 DB 조회가 실패하면 THE SYSTEM SHALL 요청을 통과시킨다(fail-open).
- REQ-WCSEC-020 IF 가드의 트리거 DB 조회가 실패하면 THE SYSTEM SHALL `error` 레벨로 로그를 남긴다.
- REQ-WCSEC-021 WHEN 인증 웹훅이나 채팅 채널 트리거에 요청이 오면 THE SYSTEM SHALL 공개 웹훅 호출 수 제한과 32KB 본문 한도를 적용하지 않는다.
- REQ-WCSEC-022 WHEN 위젯이 AI 메시지와 표시물을 그리면 THE SYSTEM SHALL `marked` + `DOMPurify` 의 허용 목록(`ALLOWED_TAGS`·`ALLOWED_ATTR`)으로 sanitize 한다.
- REQ-WCSEC-023 WHEN 위젯이 링크를 그리면 THE SYSTEM SHALL URL 스킴을 http(s)·mailto·상대 경로·앵커로 제한하고 `target=_blank` 와 `rel="noopener noreferrer nofollow"` 를 붙인다.
- REQ-WCSEC-024 WHEN 메인 앱 AI 어시스턴트 패널이 메시지를 그리면 THE SYSTEM SHALL `rehype-raw` 없이 raw HTML 을 텍스트로 escape 하고 `javascript:`·`data:` 같은 위험 스킴을 막는다.
- REQ-WCSEC-025 IF sanitize 입력이 비었거나 공백뿐이면 THE SYSTEM SHALL 예외 없이 안전한 문자열을 돌려준다.
- REQ-WCSEC-026 IF 서버나 예외에서 에러가 나면 THE SYSTEM SHALL 위젯 화면에 원문 대신 일반화 문구(`GENERIC_ERROR_MESSAGE`, catalog `error.generic`, 명령 실패는 `error.commandFailed`)만 보이고 원문은 `console.warn` 으로만 남긴다. 단 Form 검증 실패(`400 VALIDATION_ERROR`)의 `details[].message` 는 예외로 받은 그대로 보인다.
- REQ-WCSEC-027 WHEN `apiBase` 를 iframe 쿼리나 `wc:boot` 로 받으면 THE SYSTEM SHALL 두 경로 모두 http(s) 스킴만 받아들인다.
- REQ-WCSEC-028 IF `apiBase` 가 http(s) 스킴이 아니면 THE SYSTEM SHALL 그 필드만 버리고 `console.warn` 을 남기며 부팅은 계속한다.
- REQ-WCSEC-029 WHEN 로더가 iframe 을 만들면 THE SYSTEM SHALL `sandbox="allow-scripts allow-forms allow-same-origin"` 을 붙인다.
- REQ-WCSEC-030 WHEN 웹채팅 SDK 가 동작하면 THE SYSTEM SHALL Clemvion 으로 사용 지표를 보내지 않는다.
- REQ-WCSEC-031 WHEN 위젯 UI 를 만들면 THE SYSTEM SHALL 키보드 내비게이션·ARIA·스크린리더를 지원해 WCAG AA 를 지향한다.

## 하위 문서

- [웹채팅 보안 — CORS와 임베드 검증](CLE-WEBCHAT-SECURITY-ORIGIN.md) — 두 공개 표면의 경로별 CORS 정책과 구현, 무단 임베드를 막는 임베드 검증(`/embed-config`, `blocked`, 빈 목록의 층별 의미)과 그 근거. 요구사항: REQ-WCSEC-001 ~ REQ-WCSEC-013.

이 문서에 남는 것은 보안 정책 요약, sanitize, `apiBase` 입력 검증, iframe sandbox, 공개 웹훅 남용 방어, 프라이버시·접근성이다(REQ-WCSEC-014 ~ REQ-WCSEC-031).

## 보안 정책 요약

| 항목 | 정책 |
|---|---|
| 웹훅 호출 | 트리거는 `auth_config_id IS NULL`(인증 없는 공개 웹훅, [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)) |
| CORS `/api/hooks/*` | 제한 없음(`origin: true`). 위젯은 credential 없이 POST 하므로 이것으로 충분하다 |
| CORS `/api/external/*` | 워크스페이스 단위 동적 허용 목록(`interactionAllowedOrigins`). Hosted iframe 모드는 위젯 배포 주소(항상 허용), BYO-UI 모드는 고객 도메인(워크스페이스 설정). [CORS](CLE-WEBCHAT-SECURITY-ORIGIN.md#cors) |
| 임베드 허용 도메인 | CORS 와 같은 키 `interactionAllowedOrigins`. v1 은 부팅 때 호스트 origin 을 비교하는 임베드 검증이고 맞지 않으면 위젯이 `blocked` 가 된다. hard `frame-ancestors` 는 opt-in. [임베드 검증](CLE-WEBCHAT-SECURITY-ORIGIN.md#임베드-검증) |
| iframe sandbox | `sandbox="allow-scripts allow-forms allow-same-origin"`(필요한 최소). `allow-same-origin` 은 위젯이 자기 쿠키·storage 에 접근하고 postMessage origin 고정을 유지하는 데 필요하다. 트레이드오프와 외부 CDN 환경의 판단은 [Rationale](#iframe-sandbox-의-allow-same-origin-은-완전-격리-원칙을-좁혀-적용한-것이다) |
| postMessage | 양방향 `event.origin` 검증. 방향별 방식은 [웹채팅 SDK](CLE-WEBCHAT-SDK.md). 토큰과 대화 내용은 호스트 페이지로 보내지 않는다 |
| 토큰 노출 | 실행 단위 토큰만 쓰므로 클라이언트에 오래 사는 비밀이 없다. 단명 토큰은 sessionStorage 에 두어 탭을 닫으면 지워진다(다층 방어, [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)) |
| 에러 메시지 노출 | 임베드 위젯은 다른 사이트에서 돌므로 서버·예외 원문을 화면에 보이지 않는다. 일반화 문구(`GENERIC_ERROR_MESSAGE`)만 보이고 진단 원문은 `console.warn` 으로만 남겨 내부 구현과 인프라 정보가 드러나는 것을 줄인다. 에러 뒤의 상태 전이(시작·복원 실패는 `[ended]` + "새 대화 시작", 명령 실패는 현재 표면 유지)는 그대로 두고 표시 문구만 일반화한다. 표시 문구는 위젯 로컬 catalog(`error.generic`·`error.commandFailed`)를 `panel` 이 `t()` 로 그 언어에 맞게 그린다. 코드 기준은 `use-widget.ts` 의 `errMessage`. 예외로 Form 검증 실패의 `details[].message` 는 원문 그대로 보인다. 폼 노드의 검증 규칙에서 만든 문장이라 사용자가 넣은 값은 담지 않고 방문자에게 이미 보이는 폼 설정의 한도만 담기 때문이다(2026-11-12 사람 결정, NERV 질문 `01a1d025-512d-70ef-9fcf-94334d80d79e`). 동작과 근거는 [웹채팅 위젯 「명령 실패」](CLE-WEBCHAT-WIDGET.md#명령-실패) |
| `apiBase` 입력 검증 | 두 입력 경로(iframe 쿼리·`wc:boot`) 모두 http(s) 스킴만 받는다(`safeApiBase`). `javascript:`·`data:`·상대 경로를 fetch 기준 주소로 쓰지 않게 거른다. 맞지 않으면 그 필드만 무시하고 `console.warn` 을 남기며 부팅은 막지 않는다. 정상 임베드에서는 SDK 의 `resolveIframeTarget` 이 같은 값을 iframe `src` 쿼리에 실어 위젯이 마운트될 때 먼저 부팅을 시도하고, 이어 도착한 `wc:boot` 가 세대 판정으로 대체한다. 그래서 쿼리 경로를 "호스트 없는 직접 로드·샘플 전용" 으로 보고 없애면 모든 정상 임베드의 부트스트랩이 깨진다. 코드 기준은 `use-widget.ts` 의 `safeApiBase`·`configFromQuery`·`mergeBootConfig` |
| 위젯 세션의 발급 주소 바인딩 | 저장된 위젯 세션(실행 ID + 토큰)은 발급할 때의 `apiBase` 에 묶인다. 재전송이 `apiBase` 를 바꾸면 옛 토큰을 새 주소로 보내지 않고 버린 뒤 다시 시작한다(`loadSession(path, apiBase)`). 호스트가 `apiBase` 만 바꿔 A 주소의 자격을 B 주소에 흘리는 것을 막는다. 판정할 수 없으면 버린다(fail-closed). 기준은 [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md) |
| 호출 수 제한·남용 | EIA 자체 한도([External Interaction API](../CLE-IX/CLE-EIA.md)) + [공개 웹훅 남용 방어](#공개-웹훅-남용-방어) |
| 입력 sanitize | AI 메시지와 표시물을 그릴 때의 XSS 방지는 위젯 책임이다. deny-by-default 허용 목록과 링크 `rel=noopener` 를 쓴다. [마크다운·HTML sanitize](#마크다운html-sanitize) |
| 프라이버시·데이터 처리 | 배포자(워크스페이스 운영자) 책임. 위젯은 `disclaimer` 고지 문구만 준다. [프라이버시와 데이터 처리](#프라이버시와-데이터-처리) |
| 텔레메트리 | SDK 는 Clemvion 으로 사용 지표를 보내지 않는다. 호스트 자체 분석은 이벤트 구독으로만 한다 |

## 마크다운·HTML sanitize

AI 메시지와 표시물을 마크다운·HTML 로 그리는 표면은 위젯과 메인 앱 두 곳이다. 번들 환경이 달라(가벼운 임베드 CSR 과 React 트리) 렌더러가 둘이다. 구현은 다르지만 같은 위협(스크립트 주입, `onerror` 같은 이벤트 핸들러 속성, `javascript:`·`data:` 링크)을 같은 수준으로 막는다.

| 렌더 표면 | 라이브러리 | sanitize 방식 | 링크 정책 | 코드 기준 |
|---|---|---|---|---|
| 위젯(channel-web-chat) 표시물·메시지 | `marked`(GFM) + `DOMPurify` | deny-by-default 허용 목록(`ALLOWED_TAGS`·`ALLOWED_ATTR`) + URL 스킴을 http(s)·mailto·상대 경로·앵커로 제한(`ALLOWED_URI_REGEXP`). 모르는 태그(svg·math 같은 mXSS 벡터)는 기본으로 막는다 | `afterSanitizeAttributes` 훅으로 `target=_blank` + `rel="noopener noreferrer nofollow"` | `codebase/channel-web-chat/src/lib/safe-html.ts` |
| 메인 앱 AI 어시스턴트 패널 메시지 | `react-markdown` + `remark-gfm` | `rehype-raw` 를 쓰지 않는다. LLM 응답의 raw HTML 을 파싱하지 않고 텍스트로 escape 한다. react-markdown 기본 `urlTransform` 이 `javascript:`·`data:` 같은 위험 스킴을 막는다 | `a` 컴포넌트 override 로 `target=_blank` + `rel="noreferrer noopener"` | `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` |

**검증 동등성**: 양쪽 모두 같은 XSS 페이로드 묶음(raw `<script>`, `<img onerror>` 이벤트 핸들러, `javascript:` 링크, 정상 링크의 noopener)으로 단위 검증한다. 위젯은 `safe-html.test.ts`, 메인 앱은 `markdown-renderer.test.tsx` 다.

메인 앱 패널 행은 두 렌더러의 동등성을 한 표에서 보이려고 여기에 둔다. 패널 자체는 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md)가 정하고, 이 행은 그 문서 [패널 화면 §요소별 동작](../CLE-WF/CLE-WF-ASSIST.md#요소별-동작)의 마크다운 렌더 항목과 짝이다. 이 행을 바꿀 때는 그 항목도 함께 검토한다.

## 공개 웹훅 남용 방어

공개 AI 챗봇의 실제 위험은 인프라 부하와 LLM 토큰 비용이라 인증 대신 여러 층으로 막는다. 이 방어는 채팅 채널 트리거를 뺀 인증 없는 모든 공개 웹훅에 걸린다. 정책·수치·응답 코드·설정 키·Redis 키·구현 구조의 기준은 [웹훅 「요청 제한과 남용 방어」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요청-제한과-남용-방어)(REQ-WEBHOOK-019·041, [오류 표](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api))이고, 채팅 채널 트리거의 본문 한도와 방어도 그 절이 정한다. 이 절은 웹채팅 위협 모델에서 본 같은 방어를 적는다. REQ-WCSEC-014·015·018·021 의 수치와 코드는 웹훅 문서와 같아야 하고 다르면 웹훅 문서를 따른다.

**v1 기본 적용**

- IP 단위 대화 시작 한도(분당 10/IP). `PublicWebhookThrottleGuard` + `PublicWebhookQuotaService`. 헤더(`X-Forwarded-For`, 신뢰할 때 `CF-Connecting-IP`)로 IP 를 알 수 없으면 식별하지 못한 요청 전체를 공유 버킷 하나에 묶어 같은 fixed-window 한도를 건다(근거는 [Rationale](#공개-웹훅에서-ip-를-알-수-없으면-공유-버킷-하나로-완화-한도를-건다-결정-2026-06-28)). `req.ip`·`req.socket.remoteAddress` 로 대신하지 않는다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)의 클라이언트 IP 추출 규칙).
- 익명 세션과 IP 조합의 대화 상한(동시 ≤3, 시간당 신규 ≤20).
  - 누적 신규(시간당 ≤20/IP)는 v1 에 구현됐다.
  - 동시 ≤3 은 현 시점 비목표다. 대화 종료 신호(`conversationEnded`)를 백엔드와 연동해야 하는데 구현되지 않았고 누적 신규 상한만으로 best-effort 방어가 충분해 뺐다. 필요해지면 별도 계획으로 시작한다.
- 요청 본문 32KB 제한. 웹훅 게이트(`PublicWebhookThrottleGuard`)에 v1 구현.
- 대화 중 메시지 길이 한도는 EIA 명령 층이 정한다([EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)). EIA 자체 호출 수 제한도 [External Interaction API](../CLE-IX/CLE-EIA.md)가 단일 기준이다. 이 문서는 값과 구현 상태를 옮겨 적지 않는다.
- **워크플로우 쪽 비용 가드**: AI 노드의 대화당 최대 턴, 워크스페이스 일일 토큰·비용 예산을 두고 넘으면 우아하게 끝낸다. 실행 엔진·AI 노드 쪽 설계가 먼저 있어야 해서 현 시점 비목표다. 필요해지면 해당 영역 계획으로 시작한다.

> **호출 수 제한 구현 특성(v1)**: Redis fixed-window 카운터라 윈도우 경계에서 최대 2배까지 몰릴 수 있다. 인증을 대신하지 않는 best-effort 다층 방어다. Redis 를 쓸 수 없거나 가드의 트리거 DB 조회가 실패하면 fail-open 이고, 트리거 조회 실패는 보호를 잠시 무력화하므로 `error` 레벨로 기록해 긴 DB 장애를 모니터링이 일찍 잡게 한다. 인증 웹훅(서버 간 호출)과 채팅 채널 트리거는 호출 수 제한과 공개 32KB 본문 한도를 받지 않고, 본문 크기는 `/api/hooks/*` 라우트 범위 1MB body-parser 가 따로 막는다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)).

> **IP 식별과 인프라 권고**: IP 단위 한도의 실효성은 신뢰할 수 있는 프록시(Cloudflare·LB)가 `X-Forwarded-For`(또는 신뢰할 때 `CF-Connecting-IP`)를 채운다는 전제에 달려 있다. managed 배포는 CF·WAF·Ingress 에서 XFF 를 강제하고 헤더 없는 외부 직접 요청을 막아 IP 단위 정확도를 확보할 것을 권고한다. self-host 도 앱 수준 공유 버킷으로 기본 보호되므로 인프라 통제가 없어도 무제한 우회는 생기지 않는다.

**opt-in (워크스페이스 선택)**

- 첫 대화 시작 전 보이지 않는 challenge(예: Turnstile·hCaptcha).
- 임베드 origin API soft 필터([임베드 검증](CLE-WEBCHAT-SECURITY-ORIGIN.md#임베드-검증)의 2번).

수치는 운영 데이터로 조정한다.

## 프라이버시와 데이터 처리

공개 위젯이 받는 엔드유저 대화는 실행으로 저장된다. 동의 고지·보존 기간·개인정보 처리 정책은 서빙 주체마다 환경과 관할이 달라 배포자(워크스페이스 운영자) 책임이며 이 문서는 정하지 않는다. 위젯은 부팅 설정 `disclaimer` 고지 문구만 준다. 호스트의 자체 분석은 이벤트 구독(`on('message')` 등)으로만 할 수 있다.

## 접근성과 브라우저 지원

WCAG AA(키보드 내비게이션·ARIA·스크린리더)를 지향한다. 지원 브라우저는 모던 에버그린 브라우저이며 SSE 지원을 전제로 한다.

## 미결 사항

현재 없다.

## 구현 위치

- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (공개 웹훅 가드)
- `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` (Redis fixed-window 카운터)
- `codebase/channel-web-chat/src/widget/host-bridge.ts` (postMessage origin 검증)
- `codebase/channel-web-chat/src/lib/safe-html.ts` (위젯 sanitize)
- `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` (메인 앱 AI 어시스턴트 패널 렌더러)

## Rationale

### 공개 웹훅 남용 방어의 기준은 웹훅 문서다

원문의 이 문서와 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 원문이 서로를 정책 수치의 기준으로 가리켜 미결이었다. 웹훅 문서를 기준으로 정해 닫았다(NERV Task `CLE-T-MCYDVV`).

- 이 방어는 웹채팅만이 아니라 채팅 채널 트리거를 뺀 모든 공개 웹훅에 걸린다.
- 가드 구현·설정 키·에러 코드·Redis 키가 모두 웹훅 쪽에 있다.
- 웹훅 문서에 이미 수치 요구사항(REQ-WEBHOOK-019·041)이 있다. 서로를 기준으로 가리키면 한쪽만 고쳤을 때 값이 어긋난다.

기각한 대안: 이 문서를 수치의 기준으로 두는 안. 웹훅 요구사항도 같은 수치를 정하므로 기준이 둘이 된다.

### 남용 방어 호출 수 제한은 fixed-window 와 fail-open 이다

인증이 없으므로 호출 수 제한은 인증을 대신하지 않는 best-effort 다층 방어다. Redis fixed-window(경계에서 최대 2배 몰림 허용)는 sliding-window 보다 구현과 비용이 단순하고 이 목적에 충분하다. 더 강한 보장이 필요하면 sliding-window 전환이 후속 후보다. Redis 장애 때 fail-open 은 방어 인프라 장애가 정당한 웹훅(서버 간 호출 포함)까지 깨지 않게 하려는 것이고, 트리거 DB 조회 실패도 같은 이유로 fail-open 이되 `error` 로그로 가시성을 확보한다. 이 fail-open 은 인프라 장애 차원이고 IP 를 알 수 없을 때의 처리는 아래 공유 버킷 결정이 다룬다(무제한 통과 아님).

**EIA 호출 수 제한의 값과 구현 상태는 옮겨 적지 않는다(결정 2026-07-11)**: 이 문서는 한때 EIA 의 두 제한(SSE 동시 3/실행, interact 분당 60/실행)을 인용하며 후자를 "미구현" 으로 적었지만 EIA 와 코드는 이미 구현됨(`InteractionRateLimiterService` + `InteractionRateLimitGuard`)이었다. 사본이 원본의 상태 변화를 따라가지 못한 것이라 값을 고쳐 두면 같은 일이 되풀이된다. 그래서 숫자와 구현 상태를 지우고 참조만 남긴다. 대화 중 메시지 길이 한도도 같은 원칙이다.

### sanitize 는 deny-by-default 허용 목록이다 (차단 목록 기각)

위젯의 DOMPurify sanitize 는 허용 목록(`ALLOWED_TAGS`·`ALLOWED_ATTR`·`ALLOWED_URI_REGEXP`) 기반이고, 알려진 위험만 막는 차단 목록(FORBID) 방식은 기각했다. 임베드 위젯은 다른 공개 사이트에서 돌아 XSS 가 성공하면 피해가 호스트 사이트로 번진다. 채팅 렌더에 필요한 태그와 속성만 허용하고 모르거나 새로운 벡터(svg·math 기반 mXSS 등)를 기본으로 막는 쪽이 안전 여유가 크다. 메인 앱은 `rehype-raw` 를 쓰지 않아 raw HTML 을 파싱하지 않고(escape) 같은 보장을 얻는다.

빈 문자열이나 공백뿐인 입력은 예외 없이 안전한 빈 문자열 또는 정상 문자열을 돌려준다(SSR·static export 단계에서는 `null` 폴백). 두 렌더러 모두 빈 입력 경계값을 단위 테스트로 검증한다.

### iframe sandbox 의 `allow-same-origin` 은 완전 격리 원칙을 좁혀 적용한 것이다

[웹채팅 구조](CLE-WEBCHAT-ARCH.md)는 iframe 으로 쿠키와 storage 를 완전히 나눈다고 선언하는데 `allow-same-origin` 은 이와 겉보기에 부딪친다.

- (a) 완전 분리는 cross-origin CDN 배포를 기준 모델로 한다. 위젯이 호스트와 다른 origin 에서 서빙되면 same-origin policy 만으로 호스트의 쿠키·storage·전역과 격리되고, `allow-same-origin` 은 위젯 자신의 origin 에 대한 것이라 sandbox 탈출 위협이 없다.
- (b) 동봉 배포([웹채팅 구조](CLE-WEBCHAT-ARCH.md)) 기본 경로에서는 위젯이 배포 자신의 origin 에서 same-origin 으로 서빙된다. 이 속성이 없으면 iframe 문서가 opaque origin 으로 강등돼 자기 `localStorage`·`sessionStorage` 접근과 postMessage origin 고정(양방향 `event.origin` 검증)이 깨진다. 위젯 세션·토큰 보관과 origin 검증에 이 속성이 있어야 한다.
- (c) same-origin 동봉 경로에서는 같은 origin 의 악성 스크립트가 sandbox 를 벗어날 수 있다. 동봉 위젯은 제품과 같은 릴리스로 나가므로(버전 잠금) iframe 문서의 출처가 제품 자신이라는 공급망 무결성이 전제돼 남는 위험을 받아들인다. 외부 CDN(`NEXT_PUBLIC_WIDGET_CDN_BASE`) 환경은 (a) 모델로 돌아가 위협이 사라진다.
- (d) 운영 콘솔 미리보기의 same-origin 동봉 iframe 도 같은 전제(우리 앱이 우리 위젯을, 버전 일치·외부 의존 0)에 서며 근거가 같다.

### 공개 웹훅에서 IP 를 알 수 없으면 공유 버킷 하나로 완화 한도를 건다 (결정 2026-06-28)

헤더에서 IP 를 알 수 없는 경우(`X-Forwarded-For`·신뢰할 때 `CF-Connecting-IP` 부재, 공격자가 일부러 지울 수 있음)를 무제한 통과에서 공유 버킷 완화 한도로 바꿔 우회를 유한 상한으로 좁혔다.

- **채택: 공유 버킷 하나(완화 한도)**. 식별하지 못한 요청 전체를 sentinel 버킷 하나(`UNIDENTIFIED_IP_BUCKET`, `public-webhook-quota.service.ts`)에 묶어 IP 단위와 같은 fixed-window 한도(분당 10·시간당 20)를 건다. 식별 못 한 트래픽 총량이 IP 하나 분량으로 묶여 보수적이다. 정상 트래픽은 프록시가 XFF 를 채워 IP 단위로 분류되므로 공유 버킷에는 비정상(헤더 제거)이거나 잘못 설정된 트래픽만 모인다.
- **기각: fail-open(그대로 통과)**. 헤더만 지워도 호출 수 제한을 무제한 우회한다. 공개 진입점의 brute-force 표면이라 받아들일 수 없다.
- **기각: fail-closed(거부)**. 가장 강하지만 프록시 없이 직접 붙은 요청이나 self-host 정상 클라이언트를 막을 수 있다. 인증이 아닌 best-effort 층이 가용성을 희생하는 것은 이 제한의 성격과 점진적 기능 저하 원칙에 맞지 않는다. 인증과 존재성은 `auth_config_id` 와 `endpointPath` UUID 가 맡는다.
- **기각: `req.socket.remoteAddress`·`req.ip` 폴백**. `trust proxy=1`(`main.ts`) 뒤에서 socket 이 cloudflared·LB 주소라 모든 트래픽이 프록시 IP 버킷 하나로 무너지고 정상 사용자가 거짓 429 를 받는다. [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)이 `req.ip` 폴백을 기각한 함정과 같아 헤더 기반 추출(`extractClientIpFromHeaders`)을 유지한다.
- **인프라 권고**: 앱 수준 공유 버킷이 이식 가능한 기준선이고 managed 배포는 XFF 강제와 헤더 없는 외부 요청 차단으로 IP 단위 정확도를 보강한다.

> **인증 웹훅의 IP 허용 목록(`ip_whitelist`)과 비교**: 같은 헤더 기반 추출을 쓰지만 IP 를 알 수 없으면 `ip_whitelist` 검증은 거부(fail-closed)다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)). 호출 수 제한은 가용성 보호(best-effort)이고 `ip_whitelist` 는 명시적인 인증 게이트라 식별 못 할 때 보수적으로 닫는다.

### `apiBase` 스킴 검증은 두 입력 경로 모두에 건다 (결정 2026-08-11)

예전에는 "쿼리는 외부가 통제하는 입력, `wc:boot` 은 호스트 SDK 계약이라 신뢰 경계 안" 이라는 근거로 쿼리 폴백에만 걸었다. 그 비대칭이 강화를 무력하게 만들었다.

**기각한 대안: 비대칭 유지.** 두 실측이 이 대안을 무너뜨린다.

1. SDK 는 같은 값을 양쪽으로 보낸다. `resolveIframeTarget`(`web-chat-sdk/src/bridge.ts`)이 `apiBase` 를 iframe `src` 쿼리에 싣고 `boot()`(`web-chat-sdk/src/index.ts`)가 같은 값을 `wc:boot` 로도 보낸다.
2. 병합에서 `boot` 이 나중에 덮는다(`{ ...configFromQuery(), ...boot }`).

그래서 검증된 쿼리 값이 `boot` 도착 순간 검증되지 않은 값으로 대체됐다. 비대칭 유지는 쿼리 검증을 장식으로 두는 선택이다.

**정당한 비-http(s) 배포는 없다.** 위젯은 위젯 배포 주소 origin 의 iframe 에서 돈다(`widgetOrigin: originOf(base)`). 상대 경로 `apiBase` 는 위젯 배포 주소 origin 으로 풀리므로 프록시 경유 배포의 수단이 될 수 없고, SDK 도 이 값을 쿼리에 실어 같은 조건을 통과시켜야 하므로 정상 배포는 이미 http(s) 를 만족한다.

**거절하면 그 필드만 버린다.** 부팅을 막지 않으며 쿼리 경로의 기존 동작과 대칭이다. 부재는 조용히 쿼리 값으로 폴백하고 거절만 `console.warn` 을 낸다.

> **진단은 거절 지점에만 있다.** `applyConfig` 의 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 은 `warn` 도 `dispatch` 도 없이 조용히 빠진다(형제 분기인 origin 허용 목록 실패는 `BLOCKED` 를 dispatch 한다). 그래서 유일한 신호는 `safeApiBase` 의 `console.warn` 이다. 이 강화는 그 조용한 분기에 닿는 빈도를 넓혔을 뿐 새 침묵을 만들지 않았고, 원래 있던 공백은 따로 등록했다.

이 축이 중요해진 계기는 위젯 세션의 발급 주소 바인딩([웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md))이다. `apiBase` 가 위젯 세션 토큰이 가는 곳을 정하게 된 이상 두 입력 경로 중 하나만 검증할 이유가 없다.
