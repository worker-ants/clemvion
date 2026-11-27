---
id: "CLE-GLOSSARY-API"
title: "용어 사전 — API 와 개발 규약"
type: "convention"
version: 7
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "caf5c90802896c54a3dd43bbdd3d49a730180723b07c9e46cdaa0ffe5321b815"
read_as: "approved_fallback"
task: "CLE-T-SCFC83"
source_paths: []
mirror_sha256: "376ca36aa65ab38978a1aaa8433c71eca42ecf4d84c1983cff50d0df007e6f34"
etag: "sha256-8dc664855106da3443443e181fda6c77cf0b75cbab8619d379c289dc1ad736f3"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「API 와 개발 규약」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기와 표의 열 순서는 [용어 사전](CLE-GLOSSARY.md) 에 있다. 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 응답 봉투 | response envelope, `{ data }` | REST 성공 응답을 감싸는 형식. 페이지 목록은 `{ data: [], pagination }` 이다. | 봉투(단독), data 래핑 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 에러 응답 봉투 | error envelope, `{ error: { code, message, requestId, details } }` | 모든 HTTP 에러 응답의 형식. | 에러 봉투, envelope(본문) | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 요청 ID | `requestId` | 에러 응답과 서버 로그를 잇는 요청 식별자. | 없음 | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 에러 상세 | `details` | 에러 응답의 선택 필드. 배열 또는 객체다. | 없음 | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 고정 목록 응답 | non-paginated collection, `{ data: { items } }` | 작은 본인 목록을 페이지 없이 한 번에 돌려주는 형식. | 비-페이징 고정 컬렉션 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 부재 표현 | absence representation | 값이 없음을 응답에서 나타내는 방식. 기본은 null 이고, 정한 경우에만 키를 뺀다. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| PATCH 삼중 상태 | tri-state | PATCH 요청에서 키 생략·null·값이 각각 다른 뜻인 규칙. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 워크스페이스 스코핑 | workspace scoping | API 가 현재 워크스페이스 안의 리소스만 다루게 하는 규칙. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 요청 빈도 제한 | rate limit, `RATE_LIMITED` | 정한 시간 안의 요청 수나 동시 연결 수에 거는 상한. 세는 단위는 범위마다 다르다(사용자 · IP · 실행 · 대화 · WebSocket 소켓). 넘으면 HTTP 는 429 를 돌려준다. 서명 참조가 있는 채팅 채널 트리거의 인바운드는 전역 한도를 받지 않는다(서명 참조가 없는 옛 트리거 · 채널 연결 전 트리거는 받는다). 대화 단위 한도를 넘으면 202 로 받고 건너뛴다. WebSocket 명령은 `RATE_LIMITED` 예외 이벤트로 알린다. 범위와 한도는 기준 문서 §7 의 표에 있다. | throttle(본문), Rate Limiting, 요청 제한 | [HTTP API 규약 — 요청 빈도 제한](CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한) |
| ack 이벤트 | ack event, `<명령>.ack`, `subscribed` | WebSocket 클라이언트 명령에 서버가 보내는 응답 이벤트(명령 응답 이벤트). 핸들러가 돌려준 `{ event, data }` 의 `event` 가 이벤트 이름이고 `data` 가 payload 다. Socket.IO 의 ack callback 으로는 돌려주지 않는다. [HTTP API 규약 「규칙」](CLE-API/CLE-API-CONV.md#규칙) 규칙 9 의 HTTP ack 본문(202)과 뜻이 다르다. | ack callback(이 뜻으로) | [WebSocket 연결과 채널 구독 「1. 전송 계층」](CLE-API/CLE-API-WS.md#1-전송-계층) |
| 클라이언트 IP 추출 | client IP extraction | 세션·감사 기록과 공개 웹훅 한도·IP 화이트리스트가 요청자 IP 를 읽는 규칙. 용도에 따라 폴백 순서가 둘이다. 채팅 채널 서명 검증 실패 한도는 `X-Forwarded-For` 를 쓰지 않고 `CF-Connecting-IP`(신뢰 설정일 때), `req.ip` 순서로 따로 읽는다([채팅 채널 인바운드 관문 「서명 검증 실패 한도」](CLE-CHAT/CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도)). | 없음 | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 에러 코드 | error code, `error.code` | 클라이언트가 분기에 쓰는 UPPER_SNAKE_CASE 문자열. 이름을 바꾸면 호환성이 깨진다. | wire 코드, errorCode(본문) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 예외 등록 코드 | historical artifact | 명명 규칙을 어기지만 호환 때문에 유지하는 코드(초대 모듈의 소문자 코드 등). | historical-artifact 예외 | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 은퇴 코드 | retired code | 더 이상 내보내지 않는 옛 에러 코드. | Retired codes(본문) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 가드 거부 코드 | guard rejection codes | 권한이 부족할 때 돌려주는 403 코드(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `ADMIN_REQUIRED`, `OWNER_REQUIRED`). | 없음 | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| OpenAPI 문서 | OpenAPI, Swagger | `@nestjs/swagger` 로 만드는 API 문서와 그 작성 규약. | 없음 | [OpenAPI 문서화](CLE-API/CLE-API-SWAGGER.md) |
| 응답 DTO·요청 DTO | response DTO, request DTO | OpenAPI 스키마에 쓰는 wire 형태 선언. 엔티티를 그대로 노출하지 않는다. | 없음 | [OpenAPI 문서화](CLE-API/CLE-API-SWAGGER.md) |
| 응답 마스킹 | egress masking | DB 원문은 그대로 두고 REST·WebSocket·SSE·EIA 알림 웹훅·채팅 채널로 나갈 때만 자격 증명 값을 가리는 정책. | egress 마스킹, 값-패턴 마스킹(정책 이름으로) | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 마스킹 마커 | mask markers, `***`, `[REDACTED]`, `[REDACTED_DEPTH]` | 가린 값 자리에 남는 예약 문자열. | 마커(단독) | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 마스킹 값 재제출 거부 | `MASKED_VALUE_RESUBMITTED` | 수동 실행 경로(재실행의 입력 덮어쓰기, 워크플로우 실행 파라미터)로 마스킹 마커와 같은 값을 다시 보내면 400 으로 막는 규칙. 웹훅 수신과 스케줄은 대상이 아니다. | 없음 | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 다국어 | i18n | 화면 문구를 한국어와 영어로 제공하는 체계. 두 언어의 키가 같아야 한다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 화면 문구 사전 | dict, `dict/{ko,en}` | 메인 앱 화면 문자열 파일. 웹채팅 위젯은 별도 로컬 카탈로그를 쓴다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 백엔드 라벨 매핑 | `backend-labels` | 백엔드가 내보낸 영문 문자열을 화면에서 한국어로 바꾸는 매핑. 매핑이 없으면 영문을 그대로 보인다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 가이드 근거 앵커 | `ImplAnchor` | 사용자 가이드 본문의 약속을 코드 심볼에 묶어 빌드에서 확인하는 컴포넌트. | anchor(단독) | [사용자 가이드 근거 규약](CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) |
| 프론트엔드 레이어 | frontend layers | app → components → lib → types 순서로만 import 하는 규칙. | 계층(단독) | [프론트엔드 레이어 규약](CLE-ENG/CLE-ENG-FRONTEND.md) |
| 마이그레이션 | migration, `V<N>__*.sql` | DB 스키마를 바꾸는 Flyway SQL 파일. 번호는 main 의 최대값에 1을 더하고, 이미 들어간 파일은 고치지 않는다. | 없음 | [DB 마이그레이션 규약](CLE-ENG/CLE-ENG-MIGRATION.md) |
| append-only | append-only | 이미 적용한 것을 고치지 않고 새 항목만 더하는 원칙. 마이그레이션 파일과 쌓기만 하는 테이블(감사 로그 · 사용량 · 이력 · 체크포인트)에 쓴다. 어느 쪽인지 함께 적는다. | 없음 | [DB 마이그레이션 규약](CLE-ENG/CLE-ENG-MIGRATION.md), [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md), [LLM 사용량 기록](CLE-AI/CLE-AI-USAGE.md), [계정과 워크스페이스 데이터 흐름](CLE-ACCT/CLE-ACCT-DATA.md), [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| Redis 키 형식 | `{도메인}:{용도}[:{식별자}...]` | Redis 키 이름 규칙. 꼬리 식별자는 없거나 여럿일 수 있다. | 없음 | [Redis 키 명명 규약](CLE-ENG/CLE-ENG-REDIS.md) |
| fail-open | fail-open | Redis 같은 부수 의존이 실패해도 주 동작을 통과시키는 정책. 반대는 fail-closed 다. 키별 실패 정책은 그 키를 소유한 문서가 정한다. | graceful degradation(같은 뜻으로) | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| raw SQL 결과 튜플 | `[rows, affectedCount]` | raw UPDATE·DELETE … RETURNING 이 돌려주는 형태. | 없음 | [raw SQL 결과 읽기 규약](CLE-ENG/CLE-ENG-RAWQUERY.md) |
| 문서 상태 | `doc_status` | NERV 문서의 승인 단계. 초안은 사람이 승인해야 승인본이 된다. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 스펙 상태(이 뜻으로) | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 구현 상태 | implementation status | 문서가 약속한 기능이 코드에 있는지를 본문 머리 줄에 적는 값. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 스펙 상태(이 뜻으로) | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 옛 스펙 상태 | spec status | 옛 스펙 트리 frontmatter 의 `status` 값. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. 구현 단계를 뜻했고 NERV 문서에서는 구현 상태로 옮겼다. 전환 단계 5 에서 옛 트리와 함께 걷었다. | 없음 | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 구현 위치 | `## 구현 위치` | 스펙 문서 본문에서 그 문서가 약속한 표면을 구현한 저장소 경로를 적는 절. 빌드 가드가 실재를 확인하는 경로의 범위는 [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 규칙 20 이 정한다. 옛 트리 frontmatter `code:` 의 자리다. | 없음 | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 키 링크 | key link, `[글](<키>#앵커)` | NERV 스펙 키를 대상으로 하는 마크다운 링크. NERV 본문과 코드 주석이 같은 표기로 문서를 가리킨다. 코드 주석의 키 링크는 저장소 미러 파일로 키와 앵커를 확인한다. | 스펙 경로 링크(코드 주석에서) | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 리뷰 산출물 인용 | review citation | 코드 주석이 리뷰 결과를 가리키는 형식. 전환 단계 2 뒤 리뷰는 발견 전체 ID(`finding <ID>`)로 가리키고, 옛 `review/**` 세션 경로 인용은 git 이력으로 되짚는다. | 없음 | [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) |
| 리뷰 라운드 | review round | 한 브랜치 · 커밋 · changeset 을 두고 리뷰 역할(code)이나 검토 checker(consistency)가 낸 결과를 NERV 에 모은 단위. 같은 커밋 · changeset 을 다시 제출하면 같은 라운드에 합쳐진다. push 게이트와 Task done 게이트가 라운드 판정을 본다. | 리뷰 세션(이 뜻으로) | [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) |
| 리뷰 발견 | finding | 리뷰 라운드가 낸 지적 한 건. 같은 지적은 지문으로 한 발견에 합쳐지고 전체 ID 로 가리킨다. | 지적 번호(W1 등, 옛 산출물 형식) | [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) |
| 처분 | resolution | 발견마다 남기는 처리 결과(`fixed` · `spec_change` · `dismissed` · `wont_fix` · `escalated`). critical 을 낮추는 처분은 사람이 승인한다. | RESOLUTION.md(옛 형식) | [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) |
| 단일 기준 | single source of truth | 한 사실을 한 문서에만 정의하고 나머지는 링크하는 원칙. | 단일 진실, SoT(본문), single source of truth(본문) | [Clemvion 제품 개요](CLE-VISION.md) |
| 글로브 | glob | 파일 경로를 `*` · `**` 같은 와일드카드로 고르는 패턴. 처음 나올 때 「글로브(glob)」 로 병기한다. | 없음 | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| BullMQ 큐 | BullMQ queue | Redis 위에서 도는 비동기 작업 큐. 전체 목록은 한 문서에 둔다. | Message Queue | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 반복 작업 | job scheduler, repeatable job | BullMQ job scheduler 로 주기 실행하는 내부 작업(정리·교체·회수). 사용자 스케줄도 실행 수단으로 job scheduler 를 쓰지만 본문에서는 "스케줄" 로 부르고 등록 수단은 "job scheduler" 로 적는다. | repeatable job(본문) | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 파일 저장소 | file storage, S3 | 지식 저장소 원본 문서와 프로필 이미지를 두는 S3 호환 저장소. 개발·셀프 호스팅은 MinIO, SaaS 는 AWS S3 를 쓴다. | 객체 저장소, Object Storage | [파일 저장소](CLE-PLAT/CLE-PLAT-STORAGE.md) |
| 운영 환경 가드 | `assertProductionConfig` | 운영 환경에서 안전하지 않은 설정이면 서버 시작을 막는 검사. | Production fail-closed 가드 | [세션과 토큰 — 운영 환경 가드](CLE-ACCT/CLE-ACCT-SESSION-GUARD.md#운영-환경-가드) |
| advisory lock | advisory lock | PostgreSQL 트랜잭션 잠금. 트리거 설정 쓰기와 동시 실행 제한에 쓴다. | 없음 | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) |
| 다중 인스턴스 | multi-instance | 서버 프로세스 여러 개가 함께 도는 배포. 프로세스 하나는 "서버 인스턴스" 라고 부른다. 웹채팅 인스턴스와 다르다. | 인스턴스(단독) | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) |
| 3중 가드 | triple guard | 같은 규칙을 저장·편집 화면(또는 사전 검증)·런타임 세 곳에서 검사하는 방식. 쓸 때 세 지점을 밝힌다. | 없음 | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |

## Rationale

2026-10-02 에 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「API 와 개발 규약」 절에서 옮겼다. 나눈 이유와 표준을 고른 기준은 그 문서의 Rationale 에 있다. 리뷰 용어 네 행(「리뷰 산출물 인용」 고침, 「리뷰 라운드」 · 「리뷰 발견」 · 「처분」 추가)은 옮기면서 고쳤다. 이유는 그 문서의 Rationale 「리뷰 용어를 NERV 레코드 기준으로 고친 이유」 에 있다.

### 채팅 채널 인바운드 한도 결정으로 고친 행

결정일: 2026-11-12

NERV Task `CLE-T-GNTWP9` 에서 사람 결정(NERV 질문 `01a1d025-94b3-7448-b9dc-4165d0b6ed5f`)을 반영했다.

- 「요청 빈도 제한」: 채팅 채널 인바운드의 202 는 대화 단위 한도를 넘었을 때의 응답이라고 고쳤다. 서명 참조가 있는 채팅 채널 트리거의 인바운드는 전역 한도를 받지 않는다. 기준 문서 [HTTP API 규약](CLE-API/CLE-API-CONV.md) 의 같은 날 개정과 맞췄다.

### 정의 보정

결정일: 2026-10-03

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다.

- 「요청 빈도 제한」: 세는 단위(사용자 · IP · 실행 · 대화 · WebSocket 소켓)와 SSE 동시 연결 상한, 전송별 초과 응답(HTTP 429, 채팅 채널 인바운드 202, WebSocket 명령 `RATE_LIMITED`)을 적었다([HTTP API 규약](CLE-API/CLE-API-CONV.md) 「요청 빈도 제한」 표).
- 「응답 마스킹」: 표면에 EIA 알림 웹훅 · 채팅 채널을 더했다. 쓰지 않는 표기에서 「egress-only」 를 뺐다. 기준 문서가 그 말을 원칙 이름(1.1 절)으로 쓴다. 「값-패턴 마스킹」 은 정책 이름으로 쓸 때만 막는다. 기준 문서는 「값 패턴」 을 판정 방식 이름으로 쓴다. 정책 전체를 부르는 이름은 「응답 마스킹」 하나다. 「마스킹 값 재제출 거부」 는 수동 실행 경로로 한정했다([응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) 규칙 10).
- 「append-only」: 대상을 쌓기만 하는 테이블(감사 로그 · 사용량 · 이력 · 체크포인트)로 넓혔다. 기준 문서 칸에 그 테이블을 append-only 로 선언한 문서 넷을 더했다(감사 로그 · 사용량 · 이력 · 체크포인트 순).
- 「반복 작업」: 사용자 스케줄도 job scheduler 로 돌지만 본문에서는 「스케줄」 로 부른다고 적었다([비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md)). 「Redis 키 형식」 은 꼬리 식별자를 `[:{식별자}...]` 로 맞췄다([Redis 키 명명 규약](CLE-ENG/CLE-ENG-REDIS.md) 규칙 1).
- 「다중 인스턴스」: 프로세스 하나는 「서버 인스턴스」 로 부른다고 적었다.
- 「문서 상태」 · 「구현 상태」 · 「옛 스펙 상태」: 값 목록을 지우고 색인 「상태값과 enum 표기」 를 가리킨다.

### 전환 단계 5 뒤 고친 행

결정일: 2026-10-03

전환 단계 5 에서 옛 스펙 트리를 지운 뒤 맞췄다(NERV Task `CLE-T-RGZBCQ`).

- 「옛 스펙 상태」: "동결된 옛 스펙 트리" 를 현재형으로 적었다. 옛 트리는 지웠으므로 걷은 값으로 고쳤다.
- 「구현 위치」 · 「키 링크」: [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 이 새로 쓴 말이라 행을 더했다. 코드 주석이 스펙을 상대 경로로 링크하는 것은 그 규약이 위반으로 본다(규칙 18).

### 분할 검토에서 고친 행

결정일: 2026-10-02

분할한 초안의 일관성 검토가 기준 문서에 그 용어의 정의가 없는 행을 찾았다. 옮겨 온 행에 이미 있던 문제라 분할과 함께 고쳤다.

- 「클라이언트 IP 추출」 · 「운영 환경 가드」: 그 규칙과 `assertProductionConfig` 는 [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) 에 있다. 그래서 기준 문서를 옮겼다. 클라이언트 IP 는 세션·감사용과 공개 웹훅용의 폴백 순서가 달라 정의에 적었다. 그 문서의 절 제목 「production fail-closed 가드」 는 이 표의 쓰지 않는 표기라 NERV Task `CLE-T-52JYHM` 이 「운영 환경 가드」 로 고쳤다(2026-10-03 초안).
- 「fail-open」: [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) 에는 이 말이 없다. Redis fail-open 의 뜻과 계측을 적은 [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) 로 기준 문서를 옮겼다.
- 「스펙 상태」: NERV 이전 뒤 문서 상태(`doc_status`)와 머리 줄 구현 상태로 갈렸다([스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 의 「NERV 이전 영향」). 옛 다섯 값은 「옛 스펙 상태」 로 한정하고 두 행을 더했다.
- 「리뷰 라운드」 · 「리뷰 발견」 · 「처분」: 운영 규칙은 아직 NERV 문서에 없고 저장소 `code-review-agents` SKILL 이 정한다. [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) 이 세 이름을 쓰는 NERV 문서라 기준 문서로 두었다. 리뷰 절차를 담은 NERV 문서가 생기면 기준 문서를 바꾼다. 2026-10-03 에 NERV Task `CLE-T-52JYHM` 이 확인했을 때 그런 문서는 아직 없었다.

### 채팅 채널 전역 한도 면제에 서명 참조 조건을 붙였다

결정일: 2026-11-14

NERV Task `CLE-T-EVGA56` 에서 고쳤다. 「요청 빈도 제한」 의 면제 조건을 [HTTP API 규약 — 요청 빈도 제한](CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한) 의 머리 콜아웃과 맞췄다. 서명 참조(`config.chatChannel.inboundSigningRef`)가 없는 채팅 채널 트리거는 서명을 검증하지 않아서 전역 한도를 그대로 받는다. 코드 후속인 NERV Task `CLE-T-ZC34Y0` 이 끝나서 2026-11-12 항목에 남아 있던 「코드는 아직 전역 한도를 건다」 문장을 지웠다. 「요청 빈도 제한」 의 기준 문서 칸은 한도 표가 있는 하위 문서 §7 로 바꿨다. 「클라이언트 IP 추출」 에는 [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) 과 [채팅 채널 — 인바운드 관문](CLE-CHAT/CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도) 이 적은 대로 채팅 채널 서명 검증 실패 한도의 별도 IP 읽기를 더했다.

### 「글로브」 행을 더했다

결정일: 2026-11-19

스펙 본문이 파일 경로 패턴을 「글로브」 로 쓰는데 이 사전에 행이 없었다. 본문 표기는 그대로 두고 이 행에서 뜻을 정했다(NERV Task `CLE-T-4H77EB`).

### 「ack 이벤트」 행을 더했다

결정일: 2026-11-20

WebSocket 문서는 클라이언트 명령에 서버가 보내는 응답 이벤트를 「ack 이벤트」 로 부르는데 이 사전에 행이 없었다. 같은 「ack」 를 Socket.IO 의 ack callback 과 [HTTP API 규약](CLE-API/CLE-API-CONV.md) 규칙 9 의 HTTP ack 본문도 쓴다. 그래서 이 행에서 뜻을 하나로 정하고 두 말과 갈랐다(NERV Task `CLE-T-KYPH36`).

### 채팅 채널 인바운드 한도의 세는 단위를 「대화」 로 맞췄다

결정일: 2026-11-27

NERV Task `CLE-T-Y4RZGZ` 가 고쳤다. NERV Task `CLE-T-KYPH36` 이 [HTTP API 규약 — 요청 빈도 제한](CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한) 의 채팅 채널 인바운드 한도 단위를 [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) 의 대화 단위(REQ-CHAT-046)로 바꿨다. 이 사전에는 «채팅방» 이 남아 같은 한도에 이름이 둘이었다. 「요청 빈도 제한」 행과 위 두 결정 기록의 «채팅방» 을 «대화» 로 고쳤다. 한도 수치와 동작은 바꾸지 않았다.

### 「운영 환경 가드」 의 기준 문서를 가드 절로 바꿨다

결정일: 2026-11-27

NERV Task `CLE-T-2JG0HW` 8번 항목이다. 가드 대상 목록은 [세션과 토큰 — 운영 환경 가드](CLE-ACCT/CLE-ACCT-SESSION-GUARD.md#운영-환경-가드) 한 절에 있다. 기준 문서 칸이 상위 문서 [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) 을 가리켜 목록을 찾으려면 한 번 더 따라가야 했다.
