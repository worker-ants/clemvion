# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep)

검토 범위: `spec/5-system/2-api-convention.md`(전문) · `spec/5-system/15-chat-channel.md`(전문) 및
그 안에서 참조하는 `spec/conventions/swagger.md` · `spec/conventions/error-codes.md` ·
`spec/conventions/secret-store.md` · `spec/conventions/redis-keys.md` · `spec/conventions/audit-actions.md`
을 파일시스템에서 직접 열어 대조했다. (프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/**`
274개 파일 본문을 전부 생략했으나, "여기 없다 = 없다 가 아니다" 지시에 따라 `Read`로 직접 확인함.)

## 발견사항

- **[WARNING] Chat Channel Bot Token Rotation API 신규 에러 코드 6종이 §1 카탈로그 미등재**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 "Bot Token Rotation API 응답 계약" 표
    (`INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED`·`CHAT_CHANNEL_PROVIDER_UNKNOWN`·
    `CHAT_CHANNEL_ENDPOINT_REQUIRED`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`)
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" —
    "어느 쪽을 택하든 **[에러 처리 §1] 카탈로그에 등재한다**. 등재되지 않은 코드는 소비자가
    존재를 알 방법이 없다."
  - 상세: 위 6개는 모두 §5.3이 말하는 "top-level `code` 교체"(엔드포인트 결과 자체를 나타내는
    특화 코드)에 해당하지만, `spec/5-system/3-error-handling.md` §1 카탈로그를 전수 검색해도
    6개 문자열이 **단 한 곳도 등장하지 않는다**(`grep` 0건, 실측). 같은 저장소는 이 패턴을 이미
    §1.7(Webhook 수신)·§1.9(워크스페이스 멤버 직접추가)·§1.10(트리거 endpointPath 충돌)·
    §1.11(트리거 AuthConfig binding)로 반복 적용해 "도메인 spec 참조 + 공용 카탈로그 가시성
    등재"라는 확립된 관례를 가지고 있다. 흥미롭게도 같은 15-chat-channel.md의 R-CC-23
    Rationale은 **502 라는 HTTP status 자체**의 신규 도입은 `2-api-convention.md §6`와
    `swagger.md §2-4`에 "각각 행을 신설해야 완결된다"며 성실히 실측·등재했는데(실제로 두 표에
    502 행이 이미 존재함을 확인했다), 정작 `error.code` **값**의 §1 카탈로그 등재는 빠졌다 —
    같은 세션이 한 축(HTTP status 카탈로그)은 챙기고 다른 축(에러 코드 카탈로그)은 놓친
    비대칭이다.
  - 제안: `3-error-handling.md`에 `§1.12 Chat Channel Bot Token Rotation 에러 코드 (도메인 spec
    참조)` 서브섹션을 신설해 6개 코드 + status + SoT(`15-chat-channel.md §5.4`)를 등재한다.
    (대안: 의도적으로 카탈로그 등재를 생략하기로 한 것이라면 그 사유를 15-chat-channel.md
    Rationale에 명시해야 한다 — 현재는 어느 쪽도 아니고 조용한 누락이다.)

- **[WARNING] CCH-NF-03 per-chat rate limit 이 §7 Rate Limiting "단일 진실" 표에 미등재**
  - target 위치: `spec/5-system/15-chat-channel.md` CCH-NF-03(§3.6 비기능 요구사항) —
    `ChatChannelRateLimiterService`, per-chat 기본 60 req/min(1–600 override)
  - 위반 규약: `spec/5-system/2-api-convention.md` §7 "표의 범위" 캐비엇 — "throttle **수치**의
    단일 진실은 본 표다."
  - 상세: §7 표는 이미 "도메인 전용 rate-limiter로 글로벌 위에 얹히는 오버라이드"의 대표
    사례로 External Interaction inbound(`InteractionRateLimiterService`, execution 당 60/120
    req/min)·SSE 동시연결(execution 당 3)을 행으로 갖고 있다. Chat Channel의
    `ChatChannelRateLimiterService`(per-chat 60/min, `rateLimitPerMinute` 1–600 override)는
    성격이 완전히 같은 "도메인 전용 리미터가 글로벌 위에 얹히는" 사례인데 §7 표에 행이 없다 —
    같은 문서 안에서 형제 사례만 등재되고 이 사례는 빠졌다.
  - 제안: §7 표에 "Chat Channel inbound (per-chat)" 행 추가 — 제한 `60 req/min(기본,
    `config.chatChannel.rateLimitPerMinute` 1–600 override)`, SoT는
    `15-chat-channel.md#36-비기능-요구사항`.

- **[WARNING] `15-chat-channel.md`의 Overview 내부 절 번호와 본문 절 번호가 "3.x"로 중복 사용됨**
  - target 위치: `spec/5-system/15-chat-channel.md` 목차 — `## Overview (제품 정의)` 하위
    `### 3. 요구사항 (CCH-* prefix)`(§3.1~§3.6, CCH-AD-*/CCH-CV-*/CCH-MP-*/CCH-SE-*/CCH-ERR-*/
    CCH-NF-*) 와, Overview 밖 `## 3. 처리 흐름`(§3.1~§3.3, 전체 시퀀스/사이드 채널/SSE 병존)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — Overview
    / 본문 / Rationale 분리. 같은 폴더의 형제 문서 `12-webhook.md`·`14-external-interaction-
    api.md`·`1-auth.md`는 전부 "요구사항"을 Overview 밖 최상위 `## N. 요구사항`으로 두어
    번호가 겹치지 않게 유지한다(예: `14-external-interaction-api.md`는 Overview에 `### 1.
    개요`·`### 2. 사용 시나리오`만 두고 `## 3. 요구사항`을 별도 최상위로 뺀다).
  - 상세: `15-chat-channel.md`만 요구사항 6개 하위섹션(§3.1~§3.6)을 Overview `##` 아래
    `###` 레벨로 두고, 그 직후 처리 흐름 섹션이 다시 `## 3.`을 사용해 하위에 자체 §3.1~§3.3을
    만든다. 결과적으로 문서 안에 "§3.3"이 두 번(CCH-MP-* 노드→채널 UI 매핑 / SSE 어댑터와의
    병존) 존재한다. 마크다운 앵커 슬러그가 서로 달라 링크 자체는 깨지지 않지만, 프로즈·리뷰
    코멘트·PR 설명에서 "§3.3 참고"라고만 쓰면 사람이 어느 절인지 구분할 수 없다.
  - 제안: (a) 형제 문서처럼 "요구사항"을 Overview 밖 최상위 섹션(`## 3. 요구사항`)으로 승격해
    번호 충돌을 없애거나, (b) Overview에 남기기로 한다면 처리 흐름 이하 섹션 번호를 4부터
    시작해 겹침을 없앤다.

- **[INFO] `UPPER_SNAKE_CASE` 표기 규칙의 SoT 귀속이 세 문서에서 서로 다르게 서술됨**
  - target 위치: `spec/5-system/2-api-convention.md` §5.3 마지막 문장 "명명은
    [error-codes 규약](../conventions/error-codes.md) 의 `UPPER_SNAKE_CASE` 를 따른다."
  - 위반 규약: `spec/conventions/error-codes.md` 자신의 헤더 — "표기(`UPPER_SNAKE_CASE`):
    [`3-error-handling.md §3.2`] · [`node-output.md §3.2`] (SoT). **본 문서는 재선언하지
    않는다.**"
  - 상세: `2-api-convention.md`는 UPPER_SNAKE_CASE의 근거로 `error-codes.md`를 직접 링크하지만,
    `error-codes.md`는 스스로 그 표기 규칙을 소유하지 않는다고 명시한다(SoT는
    `3-error-handling.md §3.2`/`node-output.md §3.2`). 게다가 `3-error-handling.md` 내부에서도
    서술이 갈린다 — Overview 문단(23행)은 "명명 규율(의미 기반 명명·rename 안정성·
    `UPPER_SNAKE_CASE`)의 SoT는 `error-codes.md`"라 해 UPPER_SNAKE_CASE를 `error-codes.md`
    소유로 묶는 반면, §1 카탈로그 서문(388행)은 "명명 규율(의미 기반 명명·rename 안정성·
    historical-artifact 예외)의 SoT는 `error-codes.md` — **본 문서는 표기(UPPER_SNAKE_CASE)**
    ·카탈로그·envelope만 정의한다"라 해 UPPER_SNAKE_CASE를 명시적으로 제외하고 자신
    (`3-error-handling.md`) 소유로 돌린다. 세 지점이 서로 다른 문장으로 같은 개념의 SoT를
    가리켜, 표기 규칙을 바꿀 때 "어디를 고쳐야 하는가"가 불분명하다. 실무 영향은 작다(세
    문서 모두 결론적으로 UPPER_SNAKE_CASE를 요구하므로 값 자체는 어긋나지 않는다).
  - 제안: `3-error-handling.md` Overview 문단(23행)을 §1 서문(388행)과 동일하게 정정해
    "표기(UPPER_SNAKE_CASE)"를 `error-codes.md` SoT 목록에서 빼고, `2-api-convention.md`
    §5.3의 링크도 "표기는 [3-error-handling.md §3.2] 참고, 명명 원칙은 [error-codes.md]
    참고"처럼 두 SoT를 분리 인용하도록 구체화한다.

## 비대상으로 확인한 항목 (오탐 방지용 기록)

아래는 위반처럼 보일 수 있으나 실측 결과 이미 규약과 정합해 발견사항에서 제외했다:

- `secret://triggers/{triggerId}/{bot-token,inbound-signing}` ref 형식 — `secret-store.md §1`
  URI scheme(`secret://<scope>/<resourceId>/<name>`)과 정확히 일치.
- `chat-channel:{triggerId}:{conversationKey}` / `cc:rl:<triggerId>:<conversationKey>` Redis 키 —
  둘 다 `redis-keys.md §3` 인벤토리에 이미 등재돼 있고 §1 예외 계열로 명시적으로 설명됨.
- `hasBotToken`(readOnly) / `botToken`·`inboundSigningPlaintext`(writeOnly) — `swagger.md §1-5`가
  드는 예시와 완전히 같은 필드로, 그 규약의 참조 사례 그 자체다.
- `ChatChannelUpdateConfigDto` 등 nested DTO 명명 — `swagger.md §1-7` + 그 Rationale이 이
  사례를 직접 다루며 정당화가 이미 기록돼 있다.
- `POST /api/triggers/:id/chat-channel/rotate-bot-token` URL 형태 —
  `2-api-convention.md §2.2` RPC-style 예외 표에 이미 화이트리스트 예시로 등재.
- `trigger.chat_channel_bot_token_rotated` 감사 액션명 — `audit-actions.md`에 `<resource>.
  <past-participle>` 구조로 이미 등재(2026-08-11 정정 반영 완료).
- R-CC-23의 "502 카탈로그 신설 필요" 서술 — 실측 결과 `2-api-convention.md §6`·`swagger.md
  §2-4` 모두 이미 502 행을 보유(이미 완결).

## 요약

`2-api-convention.md`는 자체 구조(Overview/본문/Rationale)와 인접 규약(swagger.md·error-codes.md·
secret-store.md·redis-keys.md·audit-actions.md) 대다수와 정합했고, 검증한 DTO 명명·시크릿 참조
형식·Redis 키·URL 패턴·감사 액션명은 전부 이미 규약을 정확히 따르고 있었다. 다만 신규 기능
표면(Chat Channel Bot Token Rotation API)이 도입한 에러 코드 6종과 신규 rate-limit 값이, 같은
문서들이 스스로 "단일 진실"이라 선언한 두 카탈로그(§1 에러 카탈로그, §7 rate-limit 표)에
등재되지 않은 채로 남아 있다 — 이는 하드 invariant를 깨지는 않지만 문서가 스스로 정한 완결
조건("등재되지 않으면 소비자가 존재를 알 방법이 없다")을 충족하지 못한 상태다. 추가로
`UPPER_SNAKE_CASE` 표기 규칙의 SoT 귀속이 세 문서에서 미묘하게 순환·모순적으로 서술되는 점,
`15-chat-channel.md`의 Overview 내부 요구사항 절 번호가 이후 본문 절 번호와 "3.x"를 중복
사용하는 구조적 흠결도 발견됐다. 이 checker가 받은 프롬프트 번들 자체는 컨텍스트 예산 초과로
`spec/conventions/**` 274개 파일 전부(및 `spec/5-system/`의 16개 문서)를 생략했으나, 파일시스템
직접 열람으로 이를 우회해 실제 규약 원문과 대조했다.

## 위험도

MEDIUM
