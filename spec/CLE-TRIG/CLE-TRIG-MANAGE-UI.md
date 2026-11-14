---
id: "CLE-TRIG-MANAGE-UI"
title: "트리거 관리 — 화면"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-MANAGE"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-MANAGE"]
area: "CLE-TRIG"
content_hash: "48e2b70868e0a084846b8fa6915427350675d0ed7dcea51abffb808eea22df62"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "31e552567ff8849cd0ea32a592df11113852342506ca95f7bd574f3c4e2c98dc"
etag: "sha256-fd8107a9c2c1c7f429c435a61378dff9b8f3527d5b0c216a5193544e83a93114"
---
## 개요

이 문서는 [트리거 관리](CLE-TRIG-MANAGE.md) 의 하위 문서로 트리거 화면(사이드바 "트리거", 경로 `/triggers`)의 목록 · 필터 · 상세 드로어 · 필드 권한 · 생성 모달 · 웹훅 URL 표시를 정한다. 화면이 부르는 API 계약은 [트리거 관리 — API 와 PATCH 계약](CLE-TRIG-MANAGE-API.md), 삭제 확인 대화상자는 [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md) 가 정한다.

## 화면 구조

트리거 화면은 헤더, 검색·필터 줄, 트리거 목록으로 이루어진다. 행을 누르면 오른쪽에서 상세 드로어가 열린다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 헤더 | 맨 위 | 제목 "트리거", "웹훅 추가" 버튼 | 버튼은 편집자 이상에게만 보인다(`RoleGate minRole="editor"`). 누르면 [트리거 생성](#트리거-생성) 모달이 열린다 |
| 검색·필터 줄 | 헤더 아래 | 검색 입력, 유형 필터, 상태 필터 | [필터](#필터) |
| 트리거 목록 | 본문 | 트리거마다 두 줄짜리 행 | 행을 누르면 [상세 드로어](#상세-드로어)가 열린다 |
| 상세 드로어 | 오른쪽 슬라이드 | 카드별 상세 정보와 편집 토글 | 카드별로 읽기 모드와 편집 모드를 오간다 |

목록 행 예시는 다음과 같다.

| 상태 | 이름 | 유형 | 둘째 줄 |
|------|------|------|---------|
| ● 활성 | order-webhook | 웹훅 | → Order Processing · `POST /api/hooks/3f2b…-4c1d` · 📋 · ⋮ |
| ● 활성 | daily-report `[Schedule]` | 스케줄 | → Daily Report Gen · `0 9 * * *` · 다음 실행: 09:00 · ⋮ |
| ○ 비활성 | manual-test | 수동 | → Test Workflow · ⋮ |

### 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | 활성(●) / 비활성(○) |
| 트리거 이름 | 사용자가 정한 이름 |
| 유형 뱃지 | 웹훅 / 스케줄 / 수동 |
| 인증 | 연결된 인증 설정의 유형 뱃지(HMAC / Bearer / API Key / Basic Auth). 목록 응답의 `authConfigId` 와 미리 불러온 워크스페이스 인증 설정 목록(`GET /api/auth-configs`)의 `id → type` 매핑으로 그린다. `authConfigId == null` 인 웹훅 트리거는 경고 아이콘(⚠)과 "인증 없음" 을 표시한다. 스케줄·수동 트리거는 인바운드 HTTP 인증이 해당하지 않아 `-` 로 표시하고 경고하지 않는다([Rationale](#rationale) «무인증 웹훅에 경고를 표시하는 이유»). 이 칸은 상세 드로어 "인증 설정" 카드와 같은 자원을 요약해 보여 준다 |
| 연결된 워크플로우 | "→ 워크플로우 이름". 누르면 그 워크플로우 에디터로 이동한다. 목록 응답의 `workflow.name` 을 쓴다 |
| 상세 정보 | 웹훅: HTTP 메서드와 경로. 스케줄: Cron 표현식 |
| 스케줄 태그 | 스케줄 유형 트리거에 `[Schedule]` 태그, Cron 표현식, 다음 실행 |
| 채팅 채널 칩과 상태 배지 | `config.chatChannel` 이 설정된 웹훅 트리거 행에만 표시한다. 채널 프로바이더 칩(`Telegram` 등, 채널 프로바이더별 브랜드 색)과 `chatChannelHealth` 배지(정상 / 저하됨 / 확인 안 됨)를 `notificationHealth` 배지와 같은 영역·같은 형식으로 나란히 둔다. `degraded` 여도 트리거를 자동으로 비활성화하지 않는다([채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도)) |
| URL 복사 버튼(📋) | 웹훅 트리거에만 표시한다. 웹훅 URL 을 클립보드에 복사한다 |
| 더보기(⋮) | 네 항목의 드롭다운. ① 상세 보기: 상세 드로어를 연다(모든 역할). ② 활성/비활성 토글(편집자 이상). ③ 호출 이력: 최근 호출만 담은 별도 대화상자를 연다(모든 역할). ④ 삭제(편집자 이상, [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md)). 스케줄 유형은 "스케줄 관리에서 편집" 항목을 더 보여 `/schedules?triggerId=…` 로 보낸다. 트리거 "수정" 은 따로 항목이 없고 상세 드로어 안 카드별 편집 토글로 한다 |

호출 이력 대화상자의 각 항목은 시작 시각·상태를 보여 주고 항목 전체가 `/workflows/:workflowId/executions/:executionId` 실행 상세로 가는 링크다. 대화상자는 메타·인증·EIA·스케줄 카드를 보여 주지 않는다. 대화상자 안의 "전체 상세 보기" 버튼으로 상세 드로어로 옮겨 갈 수 있다.

### 필터

| 필터 | 옵션 |
|------|------|
| 유형 | 전체 / 웹훅 / 스케줄 / 수동 |
| 상태 | 전체 상태 / 활성 / 비활성 |

### 상세 드로어

상세 드로어(`SlideDrawer`)는 오른쪽에서 밀려 나오는 패널이다. 목록 행 클릭과 더보기(⋮) "상세 보기" 로 연다. `?triggerId=` 딥링크로 들어와도(예: [스케줄](CLE-TRIG-SCHEDULE.md) 목록의 "트리거에서 보기") 그 트리거의 상세 드로어가 도착하자마자 열린다. URL 파라미터는 마운트 때 한 번만 소비한다. 그다음부터 사용자가 여닫는 동작은 URL 과 상관없다.

| 카드 | 내용 |
|------|------|
| 기본 정보 | 이름, 유형, 상태, 연결된 워크플로우 |
| 웹훅 설정 | 웹훅 URL, HTTP 메서드, 인증 설정 유형, Content-Type |
| 스케줄 설정 | Cron 표현식(읽기 전용), 시간대, 다음 실행. "스케줄 관리에서 편집" 링크로 스케줄 화면에 간다 |
| 채팅 채널 | `config.chatChannel` 이 설정된 트리거에만 보인다. provider, 봇 username(`botIdentity.username`), 봇 토큰 등록 여부(`hasBotToken`)와 재발급 액션, `uiMapping`(formMode / visualNode / buttonLayout), `rateLimitPerMinute`, `languageHints`, 상태(`chatChannelHealth`·`chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`). 웹훅 설정 카드와 나란한 별도 카드다 |
| 인증 설정 | 연결된 인증 설정 정보 |
| 외부 인터랙션 | EIA 알림 웹훅과 인터랙션 설정. 저장 · 시크릿 교체 · 트리거 단위 토큰 재발급 응답에 실린 평문은 이 카드가 한 번 보여 준다. 평문은 가려 두고 «표시» 를 눌러야 보인다. 60초 뒤에 지우고 카드가 화면에서 사라지면 함께 사라진다([Rationale](#rationale) «평문을 60초 뒤 지우는 이유») |

호출 이력은 상세 드로어에 싣지 않는다. 더보기(⋮) "호출 이력" 대화상자가 같은 데이터를 더 가벼운 모달로 보여 준다.

### 필드 권한 매트릭스

상세 드로어의 카드마다 편집 토글(화면 문구 «수정»)이 있다. 이 토글로 읽기 모드와 편집 모드를 오간다. 편집 토글은 편집자 이상에게만 보인다. 뷰어에게는 모든 카드가 읽기 모드로 보인다. 관리자와 소유자도 동작은 같고 감사 로그의 행위자만 다르다.

| 카드 | 필드 | 모드 | 규칙 |
|------|------|------|------|
| 기본 정보 | `name` | 편집 | `PATCH /api/triggers/:id { name }`. 길이 상한과 워크스페이스 안 유일성은 정의가 갈린다([미결 사항](CLE-TRIG-MANAGE.md#미결-사항)) |
| 기본 정보 | `type` | 읽기 전용 | 만든 뒤 바꿀 수 없다. 바꾸려면 지우고 다시 만든다 |
| 기본 정보 | `isActive` | 읽기 전용(배지) | 드로어 안에는 토글이 없다. 전환은 목록 ⋮ 메뉴 "활성/비활성 토글" 로만 한다. API 경로는 `PATCH /api/triggers/:id { isActive }` 하나다 |
| 기본 정보 | `workflowId` | 읽기 전용(v1) | [Rationale](#rationale) "워크플로우 연결을 v1 에서 잠근 이유" |
| 웹훅 설정 | `endpointPath` | 편집 | `PATCH /api/triggers/:id { endpointPath }`. 서버는 v4 UUID 형식만 받는다(`@IsUUID('4')`, [웹훅 「비밀성」](CLE-TRIG-WEBHOOK.md#비밀성)). 바꾸면 옛 URL 은 곧바로 404 가 되므로 대화상자로 경고한 뒤 진행한다. 다른 트리거와 겹치거나(전역 유일) 다른 워크스페이스가 예약한 경로면 409 `RESOURCE_CONFLICT`(`details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`). 예약 규칙은 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) |
| 웹훅 설정 | `httpMethod` | 읽기 전용 | v1 은 POST 고정 |
| 웹훅 설정 | `contentType` | 읽기 전용 | v1 은 `application/json` 고정 |
| 웹훅 설정 | 웹훅 URL | 읽기 전용(자동 계산) | 엔드포인트 경로를 바꾸면 따라 바뀐다. 직접 입력할 수 없다 |
| 스케줄 설정 | `cronExpression` | 읽기 전용 | 편집은 [스케줄](CLE-TRIG-SCHEDULE.md) 화면에서만 한다. 이 카드는 "스케줄 관리에서 편집" 링크만 보여 준다 |
| 스케줄 설정 | `timezone` | 읽기 전용 | 위와 같다 |
| 스케줄 설정 | `nextRunAt` | 읽기 전용(시스템 계산) | 스케줄 생성·수정 때와 실행이 끝난 직후 다시 계산한다. Cron 파싱이 실패하면 비어 있을 수 있다(`-` 표시). 발사와 상관없는 정보성 값이다 |
| 외부 인터랙션 (EIA 알림 웹훅) | `url` / `events` / `signing` / `retry` | 편집 | 필드 정의는 [External Interaction API](../CLE-IX/CLE-EIA.md). `retry` 의 뜻과 범위(총 시도 횟수, 상한, 간격)는 [EIA 알림 웹훅 「재시도와 실패 처리」](../CLE-IX/CLE-EIA-NOTIFY.md#재시도와-실패-처리) 가 정한다. 읽기 모드는 `retry.maxAttempts` 를 «최대 시도 횟수» 로 보여 준다 |
| 외부 인터랙션 (EIA 알림 웹훅) | `notificationHealth` / `notificationLastError` | 읽기 전용(시스템 계산) | `notificationHealth` 는 트리거 상세에 배지로 보인다([웹훅](CLE-TRIG-WEBHOOK.md) 의 상세 화면 요구사항). `notificationLastError` 는 API 응답에만 실리고 화면에 그리지 않는다. 자격 증명 모양은 가려 내보낸다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| 외부 인터랙션 (인터랙션) | `enabled` / `tokenStrategy` | 편집 | 위와 같다 |
| 인증 설정 | `authConfigId` | 편집 | 인증 메뉴(`/authentication`)에서 만든 인증 설정을 셀렉터로 트리거에 연결한다. `PATCH /api/triggers/:id { authConfigId }`. `null` 은 인증 없음이다. 비밀 값의 편집·평문 보기·재생성은 인증 메뉴에서만 한다([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md)). 셀렉터는 워크스페이스 인증 설정 목록, "인증 없음", "+ 새 인증 설정 만들기"(→ `/authentication`)로 이루어진다. "+ 새 인증 설정 만들기" 는 관리자 이상에게만 보인다. 연결 자체는 편집자 이상이 할 수 있다 |
| 채팅 채널 | `provider` | 읽기 전용 | v1 은 `telegram` / `slack` / `discord`([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) provider 목록). 바꾸려면 트리거를 지우고 다시 만든다. PATCH 로 바꾸면 400 |
| 채팅 채널 | `inboundSigning` | 생성 때만 입력 | Slack·Discord 만 쓴다. 사용자가 외부 포털(Slack 앱 Basic Information, Discord Developer Portal General Information)에서 받은 값을 입력한다. 응답에서는 빼고 내부 `inboundSigningRef` 만 보관한다. Telegram 은 서버가 발급하므로 이 필드를 쓰지 않는다. 회전은 v1 에 정의되지 않았다. PATCH 로 바꾸면 400 `VALIDATION_ERROR` |
| 채팅 채널 | `botToken` | 입력 전용과 재발급 액션 | 응답에는 `hasBotToken: boolean` 만 싣는다. 마스킹 값도 끝 네 글자도 싣지 않는다. 인증 설정의 필드 마스킹(`***<last4>`)은 평문 보기로 읽을 수 있는 자격 증명용이라 입력 전용 필드에는 쓰지 않는다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)). 입력창 placeholder(`123456789:ABCdef...`)는 형식 예시다. 서버는 형식을 검사하지 않는다. 잘못된 토큰은 `setupChannel` 이 실패할 때 400 `BOT_TOKEN_INVALID` 로 드러난다. Telegram BotFather 형식 정규식은 입력 안내이고 Telegram 전용이다. 이 정규식은 사용자 가이드와 화면 문구에만 있고 코드에는 없다. 바꿀 때는 `POST /api/triggers/:id/chat-channel/rotate-bot-token`(24시간 유예)만 쓴다. PATCH 로 `botTokenRef` 를 바꾸면 400 `VALIDATION_ERROR` |
| 채팅 채널 | `botIdentity.username` | 읽기 전용 | `setupChannel()` 이 `getMe` 로 받아 캐시한 값이라 `setupChannel()` 이 불릴 때 갱신된다. 트리거를 다시 켜는 PATCH 는 `setupChannel()` 을 부르지 않으므로 갱신하지 않는다([채팅 채널 「봇 토큰 변경 단일 경로」](../CLE-CHAT/CLE-CHAT-CORE.md#봇-토큰-변경-단일-경로)) |
| 채팅 채널 | `uiMapping.formMode` | 편집 | `multi_step` / `native_modal` / `auto`, 기본 `auto`. `auto` 는 채널 프로바이더가 지원하고 모든 필드를 모달로 받을 수 있으며 필드가 5개 이하면 네이티브 모달, 아니면 다단계 질문이다. `native_modal` 은 네이티브 모달을 우선하고 조건이 맞지 않으면 다단계 질문으로 돌아간다. `multi_step` 은 다단계 질문을 강제한다. 상세는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 채팅 채널 | `uiMapping.visualNode` | 편집 | `text` / `photo` / `auto`, 기본 `auto`. Carousel·Chart·Table 의 시각 렌더 방식이다 |
| 채팅 채널 | `uiMapping.buttonLayout` | 편집 | `auto` / `vertical` / `horizontal`, 기본 `auto` |
| 채팅 채널 | `rateLimitPerMinute` | 편집 | 정수 override, 기본 60([채팅 채널 「비기능」](../CLE-CHAT/CLE-CHAT-CORE.md#비기능)). Telegram 그룹 한도에 맞춘다 |
| 채팅 채널 | `languageHints` | 편집 | `Record<string, string>`. `groupChatRefusal`·`executionStarted`·`executionCompleted`·`executionStillRunning`·`help` 같은 봇 안내 문구 |
| 채팅 채널 | `languageLocale` | 편집 | `ko` / `en`, 기본 `ko`. `languageHints` 에 없는 키의 기본 문구 언어다. 문구를 찾는 순서와 기본 문구는 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다 |
| 채팅 채널 | `chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` | 읽기 전용(시스템 계산) | 응답은 camelCase, DB 컬럼은 snake_case(`chat_channel_health` 등). `degraded` 여도 트리거를 자동으로 비활성화하지 않는다([채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도)). `chatChannelLastError` 는 자격 증명 모양을 가려 내보낸다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |

시크릿 참조(`botTokenRef`, `inboundSigningRef`)는 사용자에게 보이지 않는다. 응답에는 `hasBotToken: boolean` 만 들어가고 화면도 "등록됨 / 등록 안 됨" 만 표시한다. 이것은 [채팅 채널 「응답 파생 필드 hasBotToken」](../CLE-CHAT/CLE-CHAT-CORE.md#응답-파생-필드-hasbottoken) 을 화면에 적용한 것이다. `config.chatChannel` 필드 정의 전체는 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

### 트리거 생성

헤더의 "웹훅 추가" 버튼이 모달을 열어 웹훅 유형 트리거를 만든다. 제출하면 `POST /api/triggers` 를 부른다.

| 필드 | 입력 | 규칙 |
|------|------|------|
| 이름(`name`) | 필수 텍스트 | |
| 연결 워크플로우(`workflowId`) | 필수 셀렉트 | 워크스페이스 워크플로우 목록 |
| 인증(`authConfigId`) | 선택(인증 설정 셀렉터) | `null` 은 인증 없음이며 목록에서 경고 대상이다. 인라인 인증 입력 필드는 없다 |
| 채팅 채널(토글) | 선택 | 켜면 `provider`(telegram / slack / discord), `botToken`(입력 전용), Slack·Discord 는 `inboundSigningPlaintext` 를 받는다. 요청 본문의 top-level `chatChannel` 필드로 보내며 서버가 `setupChannel()` 을 자동으로 부른다. `uiMapping` 은 `{ formMode: "auto", visualNode: "auto", buttonLayout: "auto" }` 로 만든다 |

- 엔드포인트 경로(`endpointPath`)는 클라이언트가 `crypto.randomUUID()` 로 만들어 보낸다. 인증 없는 웹훅에서는 이 UUID 가 사실상 호출 권한을 주는 비밀 역할을 한다([웹훅](CLE-TRIG-WEBHOOK.md)). 다만 웹채팅(공개 설치 스크립트) 트리거는 설치 스크립트에 경로가 들어가 공개된다. 이 예외 관계를 어디에 둘지는 [웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md#미결-사항) 의 미결 사항이다.
- 웹채팅 인스턴스는 별도 자원이 아니라 인터랙션이 켜진 웹훅 트리거를 [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) 에서 보여 주는 다른 표현이다.
- `httpMethod`·`contentType` 은 v1 고정값(POST / `application/json`)이라 모달에 입력 칸이 없다.
- Slack·Discord 의 `inboundSigningPlaintext` 는 보내기 전에 클라이언트에서 hex 형식을 검사한다. 정규식의 단일 기준은 `@workflow/chat-channel-validation` 패키지이고 백엔드 `assertInboundSigningPlaintextByProvider` 도 같은 export 를 쓴다.
- 스케줄 유형은 이 모달에서도 `POST /api/triggers` 에서도 만들 수 없다. 스케줄 화면에서 스케줄을 만들면 트리거가 자동으로 생긴다([스케줄](CLE-TRIG-SCHEDULE.md)).
- 워크플로우 에디터에서도 같은 `POST /api/triggers` 로 트리거를 만들 수 있다. 트리거 화면은 웹훅 트리거 생성과 모든 트리거의 조회·수정·삭제를 맡는다.
- 요청 본문의 `config` 키 아래에는 시크릿 참조 · 평문 필드와 서버가 만드는 `interaction.triggerToken`, 타입 키(`notification` · `interaction` · `chatChannel`), `secret://` 로 시작하는 값을 실을 수 없다. 규칙은 [PATCH 본문 계약](CLE-TRIG-MANAGE-API.md#patch-본문-계약) 과 같다.

### 웹훅 URL

웹훅 URL 은 `{base_url}/api/hooks/{endpoint_path}` 형식이다. `base_url` 은 SaaS 면 서비스 도메인이고 셀프 호스팅이면 설정한 도메인이다. 웹훅은 백엔드가 받으므로 `base_url` 은 백엔드 origin 이다. 프런트엔드가 표시·복사용 base 를 고르는 순서(`NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` 에서 끝의 `/api` 제거 → `window.location.origin`)와 정본 형식은 [웹훅 「URL 형식」](CLE-TRIG-WEBHOOK.md#url-형식) 이 정한다. 구현은 `codebase/frontend/src/lib/utils/webhook-url.ts` 다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`
- `codebase/frontend/src/components/triggers/*.tsx`
- `codebase/frontend/src/lib/utils/webhook-url.ts`
- `codebase/packages/chat-channel-validation/src/index.ts`

## Rationale

### 워크플로우 연결을 v1 에서 잠근 이유

필드 권한 매트릭스에서 `workflowId` 변경을 v1 에서 막는 이유는 셋이다.

1. 실행 기록은 `execution.trigger_id` FK 로 트리거를 가리킨다. 트리거의 워크플로우가 바뀌면 같은 `trigger_id` 의 기록이 둘 이상의 워크플로우에 걸쳐 통계와 필터가 의미를 잃는다.
2. 새 워크플로우의 수동 트리거 노드 입력 스키마가 다르면 `schedule.parameter_values` 가 맞지 않게 될 수 있다([트리거 데이터와 흐름](CLE-TRIG-DATA.md)).
3. 트리거를 다른 워크플로우로 옮기려는 요구는 드물고 기존 트리거를 비활성화하고 새로 만들면 된다.

v1.1 이후 이 영향을 풀 마이그레이션 계획이 생기면 이 제한을 푼다.

### 호출 이력을 별도 대화상자로 뺀 이유

더보기(⋮) 메뉴의 "상세 보기" 와 "호출 이력" 은 서로 다른 창을 연다.

- 상세 보기: 메타·웹훅 인증·외부 인터랙션·스케줄 카드를 한 화면에 모은 상세 드로어(`SlideDrawer`, 오른쪽 슬라이드)다. 편집, Cron 확인, EIA 설정이 목적이다.
- 호출 이력: 최근 호출만 빠르게 보고 닫는 가벼운 모달(`Dialog`, 가운데 정렬)이다. "이 트리거가 최근에 잘 불리고 있는가" 만 확인하는 상황에 맞다.

### 상세 드로어에서 최근 호출 카드를 뺀 이유

- ⋮ 메뉴가 이미 상세 보기와 호출 이력을 따로 노출하므로 드로어가 호출 이력을 또 보여 줄 가치가 적다.
- 드로어가 `GET /api/triggers/:id/history` 를 부르지 않아 드로어를 열 때 왕복이 한 번 줄어든다.
- 드로어는 편집할 수 있는 메타에 집중한다.

### 호출 이력 항목 전체를 실행 상세 링크로 만든 이유

- 각 항목을 `<Link href="/workflows/:workflowId/executions/:executionId">` 로 감싼다. `workflowId` 는 트리거 행이 이미 알고 있으므로 대화상자의 부모(`TriggersPage`)가 `historyTarget.workflowId` 로 함께 넘긴다. 백엔드가 링크 URL 을 함께 보낼 필요가 없다.
- 시작 시각을 주 텍스트로 보여 어떤 항목을 누르는지 강조한다. 오른쪽 `ChevronRight` 아이콘으로 이동할 수 있음을 알린다.
- 항목을 누르면 `onClose()` 를 불러 페이지 이동과 함께 대화상자가 닫힌다.
- `workflowId` 가 빈 예외 상황(응답의 `workflow_id` 가 null 등)에서는 행을 읽기 전용 `<div>` 로 그리고 링크를 만들지 않는다.

항목 전체를 링크로 만들면 시각·상태 영역 전체가 클릭 대상이라 누르기 쉽고 별도 "보기" 버튼이 늘지 않아 모달이 가볍게 남는다.

### 채팅 채널을 별도 카드로 나눈 이유

상세 드로어에서 `config.chatChannel` 설정은 웹훅 설정 카드에 넣지 않고 별도 채팅 채널 카드로 나눈다. 웹훅 설정 카드의 주제는 엔드포인트 URL·인증·HTTP 메서드 같은 외부 호출 인터페이스다. 채팅 채널 카드의 주제는 봇 정보·UI 매핑·언어 힌트·상태 같은 어댑터 동작과 채널 프로바이더 연결이다. 둘을 나눠야 어디서 무엇을 편집하는지 분명하다.

시크릿 참조는 백엔드 내부 식별자라 사용자에게 보일 가치가 없다([채팅 채널 「응답 파생 필드 hasBotToken」](../CLE-CHAT/CLE-CHAT-CORE.md#응답-파생-필드-hasbottoken)).

목록 행의 칩과 상태 배지는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 상세 화면 요구사항(채널 건강도를 발송 건강도 배지와 같은 영역에 둔다)을 목록 행 위치로 해석한 것이다. 카드 분리와는 독립이라 행과 카드 두 곳 모두 표시한다.

### 채팅 채널 provider·inboundSigning 필드 정책

`provider` 는 v1 에서 `telegram` / `slack` / `discord` 를 지원한다. 바꾸려면 트리거를 지우고 다시 만든다. 이 불변성은 2026-09-11 부터 실제로 강제한다. `provider` 를 바꾸는 PATCH 는 400 이다. `botTokenRef` 는 트리거 id 에서만 다시 유도되므로 전환을 허용하면 다른 채널 프로바이더의 토큰을 새 어댑터에 넘기게 된다.

`inboundSigning` 은 Slack·Discord 에서 사용자 입력(채널 프로바이더가 발급한 평문)으로 받는다. Telegram 은 서버가 발급하므로 이 필드를 쓰지 않는다. 이 값의 교체는 1차 범위에 정의되지 않았고 PATCH 로 막는다(`botTokenRef` 차단과 같은 자리). Slack·Discord 의 인바운드 서명 자료는 채널 프로바이더가 발급하고 서버에 저장하는 자원이다. 채널 프로바이더에 등록된 토큰(단일 경로 재발급의 근거, [채팅 채널 「R-CC-10 봇 토큰 변경은 재발급 API 한 경로로만」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-10-봇-토큰-변경은-재발급-api-한-경로로만))과 성격이 달라 앞으로 교체 API 를 들일 때 따로 결정한다.

### 웹훅 인증을 인증 설정 연결로만 받는 이유

웹훅 수신 인증은 인증 메뉴(`/authentication`)의 인증 설정을 연결하는 단일 경로(`authConfigId`)로 동작한다.

- 인라인 인증 필드가 없다. `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 행을 두지 않고 `authConfigId` 한 행만 둔다. 인라인 `authType` enum(`none`/`hmac`/`bearer`)은 인증 설정 유형 네 값(`api_key`/`bearer_token`/`basic_auth`/`hmac`)으로 바뀌었다. 인증 없음은 `authConfigId IS NULL` 로 나타낸다.
- 자격 증명의 키 재생성은 `POST /api/auth-configs/:id/regenerate` 로 모은다. 웹훅 수신 인증과 EIA 알림 웹훅 HMAC 은 엔드포인트도 시크릿도 따로라 알림 서명 시크릿 교체와 독립이다.

인증 설정 도메인이 이미 발급·키 재생성·권한·통계·마스킹을 맡고 있으므로 인증의 단일 기준을 `authConfigId` 로 두는 편이 일관된다. 자세한 근거는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 "인라인 인증 경로 폐지" 결정에 있다.

### 인라인 HMAC 시크릿 입력과 회전 분리 설계를 폐기한 이유

트리거 설정에 HMAC 시크릿(`config.hmacSecret`)을 직접 입력하고(1차 범위) 나중에 `POST /api/triggers/:id/auth/rotate-secret` 로 유예를 두고 시크릿을 바꾸는(후속 범위) 설계가 있었다. 웹훅 인증을 인증 설정 연결로만 받기로 하면서(위 결정) 인라인 입력이 사라졌고 그 경로는 만들지 않은 채 폐기했다. 그 설계의 미정 항목(응답 형태, 유예 기간, 경로 세그먼트)도 결정할 대상이 사라졌다.

이 기록을 남기는 이유는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 봇 토큰 단일 경로 결정(R-CC-10)이 "우리 서버가 보관하는 시크릿" 과 "외부 채널 프로바이더에 등록된 토큰" 의 대조군으로 이 설계를 인용하기 때문이다. 이 대조는 자원 성격의 대조라 설계가 폐기돼도 유효하다.

### 무인증 웹훅에 경고를 표시하는 이유

목록의 인증 칸은 `authConfigId == null` 인 웹훅 트리거에 경고 아이콘을 보인다. 강제 차단이 아니라 눈에 보이는 위험 신호다.

- 웹훅은 외부에 공개된 HTTP 진입점이다. 인증 설정이 연결되지 않으면 URL 을 아는 누구나 워크플로우를 실행할 수 있어 무단 실행·자원 남용·데이터 주입에 노출된다.
- 스케줄·수동 트리거는 외부 HTTP 진입점이 아니다(스케줄은 내부 반복 실행, 수동은 인증된 화면·API 호출). 외부 노출 위험이 없으므로 경고하지 않고 `-` 로 표시한다.
- 경고는 차단이 아니다. [웹훅](CLE-TRIG-WEBHOOK.md#비밀성) 은 "인증 없음" 을 지원하는 공개 옵션으로 두고 엔드포인트 경로 UUID 가 사실상 호출 권한 토큰 역할을 한다고 정의한다. 이 경고는 그 결정을 바꾸지 않고 사용자가 무인증을 일부러 골랐는지 확인하게 돕는다.

### 드로어 안 활성 상태를 배지로만 둔 이유

상세 드로어는 `isActive` 를 읽기 전용 배지로만 표시하고 전환 컨트롤은 목록 ⋮ 행 액션 한곳에만 둔다.

- 행 액션이 같은 API(`PATCH /api/triggers/:id { isActive }`)로 같은 기능을 주므로 드로어에 토글이 없어도 전환 수단을 잃지 않는다. 편집 진입점을 한곳에 모아 어디서 켜고 끄는지가 분명해진다.
- [활성 상태 편집 경로를 PATCH 하나로 둔 이유](CLE-TRIG-MANAGE-API.md#활성-상태-편집-경로를-patch-하나로-둔-이유) 는 API 편집 경로에 대한 결정이고 이 결정은 드로어 UI 표현에 대한 결정이다. 두 축은 독립이다.

### 평문을 60초 뒤 지우는 이유 (2026-10-17)

외부 인터랙션 카드는 첫 발급 · 시크릿 교체 · 토큰 재발급 응답의 평문을 같은 결과 상자(`SecretRevealBox`)로 보여 준다. 60초는 교체 · 재발급 결과 상자에 이미 있던 값(`SECRET_AUTO_HIDE_MS`)이고 첫 발급 평문에도 이 상자를 그대로 썼다.

- 인증 설정의 평문 표시 30초([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md) 의 평문 보기 요구사항)와는 따로 정한 값이다. 인증 설정은 평문 보기로 다시 읽을 수 있다. 이 카드의 평문은 다시 볼 길이 없다. 놓치면 교체나 재발급으로 새 값을 받아야 하고 외부 시스템에 배포할 값도 바뀐다.
- 기각한 대안: 30초로 맞추기. 위 이유로 복사할 시간을 줄일 까닭이 적다.
- 카드가 화면에서 사라지면 평문을 담은 상태도 함께 사라지고 결과 상자는 타이머를 정리한다. 새 값이 오면 타이머를 다시 시작한다. 인증 설정 화면이 타이머를 정리하는 방식과 같다.
