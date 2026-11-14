---
id: "CLE-API-EGRESS-TRIGGER"
title: "응답 자격 증명 마스킹 — 트리거 응답의 마지막 오류"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-EGRESS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-EGRESS"]
area: "CLE-API"
content_hash: "c443084472a5d8565db11ff239835c34f7c0830ac87b28de2150609e2f33f5ec"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "ef44c775ebfa430dd12a51cea7eede44ba536bd192392d5a9d9eb810f72c4235"
etag: "sha256-6e7b966c536224ce3edc5a0e56087c62450aec7aff49ca3bb28899099c6009df"
---
## 개요

이 문서는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 의 하위 문서로 트리거 응답의 두 마지막 오류 필드의 응답 마스킹과 그 한계를 정한다. §N 은 원문 절 번호이고 「규칙 N」 · §1 · §2 는 부모에, 나머지 절은 부모의 [하위 문서](CLE-API-EGRESS.md#하위-문서) 가 가리키는 문서에 있다.

## 3.10 트리거 응답의 마지막 오류 (2026-10-05)

트리거의 두 마지막 오류 필드는 실패 원인을 보여 주는 진단 원문이다. 저장값은 원문으로 두고 응답에서 값 패턴으로 가린다(NERV Task `CLE-T-H0GF4K`).

| DB 컬럼 | 응답 필드 | 담는 것 | 저장할 때 자르는 길이 |
|---|---|---|---|
| `chat_channel_last_error` | `chatChannelLastError` | 채팅 채널 어댑터 실패(렌더 · 발송 · 채널 설정)의 원문과 서버가 정한 문구([채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도)) | 1024자 |
| `notification_last_error` | `notificationLastError` | EIA 알림 웹훅 발송 실패의 원문과 서버가 정한 문구([EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)) | 500자 |

- **표면**: `GET /api/triggers`(목록), `GET /api/triggers/:id`(상세), `POST /api/triggers`(생성), `PATCH /api/triggers/:id`(수정) 응답이다. 모두 `TriggersService.sanitizeForResponse` 를 지난다(§2.2).
- **비대상**: 스케줄 응답은 조인한 트리거를 `id` · `name` · `workflowId`(워크플로우를 불러왔으면 `workflow.name` 도)로 좁혀 두 필드를 싣지 않는다. 봇 토큰 재발급 · 알림 서명 시크릿 교체 응답도 이 필드를 싣지 않는다. 생성 · 수정(PATCH) 응답의 `data.secrets`(`notificationSigningSecret` · `interactionToken`)는 `sanitizeForResponse` 를 지난 뒤에 붙는 일회성 평문이라 이 마스킹의 대상이 아니다. 어느 응답이 평문을 한 번 실을 수 있는지는 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 4 가 정한다.
- **수신 인구**: 두 GET 은 `@Roles` 게이트가 없어 뷰어를 포함한 워크스페이스 멤버가 받는다. 실행 상세(§2.1)와 같은 사람들이라 같은 값 패턴 마스커 `redactSecrets`(`codebase/backend/src/shared/utils/sanitize-error-message.ts`, 자르지 않는다)를 건다.
- **알려진 비밀 치환과 나가는 시점 마스킹**:
  1. 만든 자리(§1.1): 채팅 채널의 프로바이더 API 클라이언트(Slack · Discord · Telegram)가 자기가 만든 실패 문장(fetch 예외, 재시도 소진 사유)을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 지운다. 세부는 [채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다. 프로바이더가 돌려준 4xx 본문은 실패 판별 입력이라 바꾸지 않는다. 봇 토큰에 CR · LF · NUL 이 있으면 fetch 가 `Headers.append: "Bearer <토큰 전체>" is an invalid header value.`(Discord 는 `Bot <토큰>`)로 거부해 토큰 전체가 실패 원문에 실린다. Slack 은 그 토큰이 이 필드 · 로그 · 응답까지 갔다(Node 24 실측). Discord 는 그때 어댑터가 클라이언트의 합성 실패를 성공으로 판정해 이 필드에 닿지 않고 로그에 남았다. 2026-11-06 부터 어댑터가 클라이언트의 `ok: false` 로 실패를 판정하므로 Discord 의 같은 실패 문장도 이 필드에 닿는다(NERV Task `CLE-T-KX2Q2N`). 그 문장의 봇 토큰은 Discord 클라이언트가 알려진 비밀 치환으로 이미 지운 것이다.
  2. 나가는 시점: `sanitizeForResponse` 가 두 필드에 `redactSecrets` 를 건다. 프로바이더가 되돌려 준 자격 증명, `user:pass@` URL(알림 URL 이 같은 응답에 원문으로 남는 동안은 부분적이다), JWT, `Authorization:` 헤더, fetch 헤더 값 검증 오류처럼 미리 알 수 없는 모양을 막는다.
- **마커**: 알려진 비밀 치환과 나가는 시점 마스킹은 같은 값 마커를 쓴다. 저장값 `Headers.append: "Bearer ***" is an invalid header value.` 는 응답에서 `Headers.append: "***" is an invalid header value.` 가 된다. 이 패턴은 따옴표 안에 다른 마커(`[REDACTED]` 등)가 있어도 값 마커 하나로 바꾼다. 규칙 5 의 하나뿐인 예외이고 이유는 Rationale 에 있다.
- **서명 자료**: 인바운드 서명 자료는 요청 헤더나 URL 에 싣지 않는다. Telegram `secret_token` 은 `setWebhook` 요청 본문에 있고 fetch 오류 원문은 본문을 싣지 않는다. 그래서 알려진 비밀 치환의 대상은 봇 토큰이다.
- **로그**: 이 문서의 대상이 아니다([로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 「로그 마스킹」). 시크릿 저장소 평문을 로그 전에 지우는 규칙은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14 가 정한다.
- **시크릿 참조**: 시크릿 저장소의 «없음» · «이미 있음» 오류는 참조를 메시지에 싣지 않는다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 18). 어댑터 실패 원문으로 이 필드에 저장될 수 있어서다. 이 변경 전에 저장된 `Secret not found: secret://…` 은 값 패턴의 단독 `secret` 키워드 패턴이 참조를 통째로 가린다(응답 비노출은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 4).
- **한계**:
  - 저장할 때 자르므로 패턴의 끝(`@`, `" is an invalid header value`)이 잘린 값은 나가는 층이 가리지 못한다. 봇 토큰은 만든 자리에서 자르기 전에 지운다.
  - 헤더 값 검증 오류 패턴은 따옴표 안 2048자까지만 본다. 상한이 없으면 종결 문구 없는 큰 입력에서 이차 시간이 걸려서다(192KB 4.3초 → 77ms). 그보다 긴 헤더 값은 이 패턴이 가리지 않는다. 봇 토큰은 알려진 비밀 치환이 먼저 지우므로 이 상한과 무관하다(생성의 `botToken` 과 재발급의 `newBotToken` 은 256자 상한이 있고 수정(PATCH)은 봇 토큰을 받지 않는다). 한 원문에 이 오류가 둘이면 상한 안에서 그 사이 문장까지 가린다.
  - 알려진 비밀 치환은 글자 그대로 같은 문자열만 바꾼다. 인코딩된 평문(URL 인코딩, base64)은 가리지 못한다. 나가는 층도 알려진 모양만 가린다.
  - 이 변경 전에 저장된 값은 다음 갱신 때까지 DB 에 남는다. 응답에서는 봇 토큰이 실린 헤더 오류와 `secret:` 뒤의 시크릿 참조를 값 패턴이 가린다. DB 의 옛 값은 정리하지 않는다. 토큰이 실렸을 수 있는 트리거는 토큰을 재발급한다.
  - 프로바이더가 돌려준 4xx 본문은 알려진 비밀 치환을 거치지 않는다. 본문에 토큰이 실리면 나가는 층의 값 패턴만 남는다.
  - 두 필드는 `TRIGGER_RESPONSE_REDACT_COLUMNS` 에 이름으로 올라 있다. `trigger` 에 마지막 오류 같은 진단 텍스트 컬럼을 더하면 이 목록과 위 표를 함께 고친다.
  - 생성 · 재발급은 보이는 ASCII(U+0021~U+007E) 밖 문자(공백 · 제어 문자 등)가 든 봇 토큰을 프로바이더를 부르기 전에 400 으로 거부한다([채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다), NERV Task `CLE-T-FX354C`). 이미 저장된 토큰은 바뀌지 않는다. 그런 토큰이 남은 트리거는 여전히 `degraded` 로 드러나고 토큰을 재발급해 고친다. 그래서 입력 거부가 있어도 알려진 비밀 치환은 그대로 필요하다.
- **남는 표면 `config.notification.url`**: 같은 응답의 알림 URL 은 원문으로 나간다. URL 에 `user:pass@` 가 있으면 마지막 오류에서는 가려도 이 필드에는 남는다. §3.5 가 «같은 응답 안의 원문이 방어를 우회한다» 고 보고 닫은 형태와 같다. 이번에 닫지 않은 이유는 이 필드가 편집 폼이 다시 보내는 왕복 값이라 규칙 9 와 함께 정해야 해서다. 그런 URL 은 fetch 가 요청을 만들지 않아 한 번도 발송되지 않으므로 등록에서 거부하는 안을 먼저 본다(NERV Task `CLE-T-RCQGCC`). 그때까지 알림 URL 의 userinfo 차단은 완전하지 않다. 사용자명만 있는 형태(`https://tok@host`)와 빈 사용자명(`https://:pw@host`)은 마지막 오류에서도 가려지지 않는다.

## Rationale

### 트리거 응답의 마지막 오류를 표면에 올린 이유 (2026-10-05)

NERV Task `CLE-T-H0GF4K` 가 Node 24 의 fetch 로 두 경로를 재현했다. Slack 봇 토큰에 CR · LF · NUL 이 있으면 헤더 값 검증 오류의 토큰 전체가 `chat_channel_last_error` · 서버 로그 · 트리거 응답까지 갔다. 알림 URL 의 `user:pass@` 는 `notification_last_error` 에 남았다. 트리거 조회는 뷰어도 받는다.

봇 토큰은 시크릿 저장소 평문이라 응답에서만 가리면 DB 와 로그의 유출이 남는다. 그래서 두 층으로 닫았다. 클라이언트가 원문을 만든 자리에서 그 호출의 토큰을 지우고(§1.1) 응답이 값 패턴으로 나머지를 가린다(§3.10).

기각한 대안:

- **저장 전 값 패턴 마스킹**: 규칙 1 과 부모 Rationale [「egress-only 를 택한 이유」](CLE-API-EGRESS.md#egress-only-를-택한-이유) 가 기각한 형태다. 진단 원문이 오탐으로 조용히 망가진다. 알려진 비밀 치환은 패턴이 아니라 값이라 이 우려가 없다. 통합 쪽의 저장 전 가림(§1.1)은 그 필드의 결정이고 진단 원문인 이 필드는 규칙 1 을 따른다.
- **비대상으로 적기**: 토큰이 실리는 경로를 재현했다.
- **원인 분류 코드와 고정 문구로 좁히기**: 채팅 채널의 R-CC-25 방식이다. 프로바이더 오류 코드(`channel_not_found`, `missing_scope`, `not_in_channel` 등)가 사용자가 고칠 원인을 알려 주는데 그 정보를 잃는다. 근거는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 R-CC-26 에 있다.
- **봇 토큰 입력에서 제어 문자만 거부하기**: 이미 저장된 토큰과 다른 모양의 유입을 막지 못한다. 알려진 비밀 치환은 입력 모양과 무관하게 닫는다. 2026-11-06 의 봇 토큰 입력 거부(보이는 ASCII 만, NERV Task `CLE-T-FX354C`)는 사용자가 고칠 입력 오류를 4xx 로 돌려주려고 치환 앞에 더한 것이라 이 기각을 뒤집지 않는다.
- **두 마지막 오류 필드에만 거는 국소 userinfo 패턴**: `config.notification.url` 이 같은 응답에 원문으로 남는 한 효과가 없다. 두 필드는 NERV Task `CLE-T-RCQGCC` 에서 함께 맞춘다.
- **공유 userinfo 패턴을 사용자명만 있는 형태까지 넓히기**(시도 뒤 철회): 이 패턴은 대화 스레드 · 실행 에러 · 재실행 입력에도 걸린다. 사용자명만 있는 URL 은 워크플로우 입력에 흔해 재제출 표면(§4)에서 부분 치환된 값이 그대로 실행될 수 있다. 알림 URL 의 자격 증명은 `config.notification.url` 과 함께 NERV Task `CLE-T-RCQGCC` 에서 다룬다.

공유 마스커에 더한 헤더 값 검증 오류 패턴은 fetch 를 쓰는 다른 경로(HTTP Request 노드 등)의 오류와, MCP 진단처럼 저장 전에 가리는 경로에도 걸린다. 수량자에는 2048자 상한을 뒀다. 상한이 없으면 종결 문구 없는 큰 입력에서 이차 시간이 걸린다(§3.10 한계). 자격 증명이 아닌 사용자 헤더 값도 `***` 로 보인다. 오류 종류(`is an invalid header value`)는 남아 원인을 읽을 수 있고 헤더 값은 자격 증명일 때가 많아 이 오탐을 받아들였다.

이 패턴은 따옴표 안을 통째로 값 마커 하나로 바꿔 안에 든 다른 마커도 덮는다. 규칙 5 를 이 패턴 하나에서 좁힌 이유다. 마커를 건너뛰려면 패턴이 마커 경계를 알아야 해 복잡해진다. 이 오류 원문에 다른 마커가 들 일은 드물고(알려진 비밀 치환의 값 마커 정도) 들어도 그 구간은 가려야 할 헤더 값이다. 키 마커(`[REDACTED]`)까지 덮는 것은 알려진 부산물이다. 이 오류 문장은 받는 층을 거쳐 온 값이 아니라서 표면 사이에 마커가 갈리는 일은 생기지 않는다. 동작은 캐너리로 고정했다. MCP 클라이언트는 소비자 전용 모양을 자기 훅에 두었지만 이 패턴은 fetch 가 모든 소비자에 내는 일반 형태라 공유 목록에 둔다.

`config.notification.url` 이 원문으로 남는 동안 `notificationLastError` 의 `user:pass@` 가림은 실효가 작다(§3.10 「남는 표면」). 왕복 값이라 규칙 9 와 함께 정해야 해서 §3.5 원칙의 한시 예외로 남겼다. 같은 이유(왕복 값)로 세웠다가 소비 쪽 마커 가드가 선 뒤 닫은 `inputData` 카브아웃([재제출 거부와 마스커 좌표계 문서 Rationale 「`inputData` 카브아웃을 닫은 이유」](CLE-API-EGRESS-PIPELINE.md#inputdata-카브아웃을-닫은-이유-2026-08-20))과 같은 길을 밟는다. 해소 조건은 NERV Task `CLE-T-RCQGCC` 가 userinfo 가 든 알림 URL 을 등록에서 거부하거나 응답에서 가리는 것이다. 그때 이 문서의 §3.10 · 이 문단과 부모 문서 개요의 「잔여 갭」 항목을 같은 변경에서 고친다.

2026-10-17 보강: 생성 · 수정 응답의 `data.secrets` 를 §3.10 비대상에 적었다(NERV Task `CLE-T-EMB0YG`). 이 묶음은 서버가 그 요청에서 발급한 평문(첫 알림 서명 시크릿, 트리거 단위 토큰 `itk_*`)을 한 번 싣기 때문에 `sanitizeForResponse` 를 지난 응답에 붙인다. 이 묶음을 마스커에 통과시키는 안은 택하지 않았다. 키 이름 판정이나 값 패턴에 걸리면 호출자가 다시 받을 수 없는 평문이 가려진다. 면제 대상 응답의 목록은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 4 한 곳에 둔다.
