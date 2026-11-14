---
id: "CLE-API-CONV"
title: "HTTP API 규약"
type: "convention"
version: 19
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "3801fec729f4d2f6a1a174e196263a042ef408d8f9c229184930d2a31e2379a9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/2-api-convention.md"]
mirror_sha256: "2e2af1780efaf2d3407c293220cf1b51d3c07dd9702c7b2f53a2510513d93c2a"
etag: "sha256-0f277aa7e87b541459803f4e4d47b8c520eb627d129233458509509016d4a2c1"
---
> 구현 상태: 부분 구현 (WebSocket `execution.continue` 는 미구현) · 원문: `spec/5-system/2-api-convention.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 Clemvion HTTP API 가 밖에서 어떻게 보이는지 정한다. URL 구조, 워크스페이스 스코핑(workspace scoping), 요청 형식, 응답 봉투(response envelope, `{ data }`), 값이 없음을 나타내는 부재 표현(absence representation), HTTP 상태 코드, 요청 빈도 제한(rate limit, `RATE_LIMITED`), 페이지네이션, 파일 업로드가 대상이다.

API 를 읽는 쪽은 웹 프론트엔드 하나가 아니다. External Interaction API(EIA, `/api/external/*`)·웹훅·생성된 SDK 가 같은 계약을 읽는다. 그래서 OpenAPI 문서가 실제 wire 와 어긋나면 그 차이가 소비자 코드로 그대로 번진다. 이 문서의 규칙 상당수는 "무엇을 보내는가" 와 함께 "보낸다고 문서에 적은 것과 실제로 보내는 것이 같은가" 를 다룬다. [§5.5 부재 표현](CLE-API-CONV-RESP.md#55-부재-표현-null-과-키-생략)과 그 검증 층이 그 자리다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 에러 응답 봉투와 상태 코드별 기본 에러 코드, `details` 규칙: [에러 응답과 클라이언트 처리](CLE-API-ERROR.md)
- 에러 코드 이름 규칙과 전체 코드 목록: [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)
- `@nestjs/swagger` 데코레이터로 OpenAPI 를 적는 방법: [OpenAPI 문서화](CLE-API-SWAGGER.md)
- WebSocket 연결·구독·재연결: [WebSocket 연결과 채널 구독](CLE-API-WS.md). 이벤트와 명령: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)
- 응답에서 자격 증명을 가리는 규칙: [응답 자격 증명 마스킹](CLE-API-EGRESS.md)
- 웹훅 수신 엔드포인트의 상세 계약: [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)

관련 문서: [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) · [Clemvion 제품 개요](../CLE-VISION.md)

## 규칙

1. 리소스 API 는 `{base_url}/api/{resource}` 아래에 둔다. 리소스 이름은 복수형 명사이고 케밥 케이스로 쓴다. 경로 중첩은 2단계까지다.
2. 자원 액션 경로 `/api/{resource}/{id}/{action}` 의 마지막 세그먼트는 동사(구)다. 목적어는 경로에 두고 액션 이름에 넣지 않는다.
3. Boolean 상태 필드를 바꿀 때는 전용 엔드포인트를 만들지 않는다. `PATCH /:id { field: value }` 로 바꾼다. 예외는 [§12.1](CLE-API-CONV-URL.md#121-상태-토글-패턴) 에 등록한다.
4. 리소스 API 는 현재 워크스페이스 안에서만 동작한다. 현재 워크스페이스는 access token 의 `activeWorkspaceId` 클레임으로 정한다.
5. 성공 응답은 `{ data: ... }` 로 감싼다. 페이지 목록은 `{ data: [...], pagination }` 이고 작은 본인 목록은 `{ data: { items } }` 다. 영역 문서의 API 표와 본문은 봉투를 빼고 `data` 안의 내용만 적는다.
6. 응답에서 값이 없을 때 기본 표현은 `null` 이다. 키를 빼는 것은 [§5.5](CLE-API-CONV-RESP.md#55-부재-표현-null-과-키-생략) 의 두 기준 중 하나에 해당할 때만이고 그 필드를 문서화하는 절에 사유를 적는다.
7. DTO 선언은 wire 를 그대로 반영한다. TS 타입이 `| null` 이면 OpenAPI 에 `nullable: true` 를 반드시 선언한다.
8. 요청 PATCH 는 키 생략·`null`·값이 각각 다른 뜻인 PATCH 삼중 상태(tri-state)다. 응답 부재 표현 규칙을 요청 DTO 에 적용하지 않는다.
9. 큐에 넣고 바로 돌아오는 요청은 `202 Accepted` 와 ack 본문을 돌려준다. `202` 는 no-content 가 아니다.
10. `410 Gone` 은 존재했으나 사라졌거나 비활성인 리소스에 쓴다. 처음부터 없던 리소스는 `404` 다. 예외는 [§6](CLE-API-CONV-RESP.md#6-http-상태-코드) 의 `404` · `410` 행에 있다.
11. `502` 는 외부 제3자 API 호출 실패에, `503` 은 우리 인프라 의존성의 일시 장애에 쓴다. 예외로 Passkey 환경 변수가 없을 때의 `WEBAUTHN_DISABLED` 도 `503` 이다. 이 응답은 다시 시도해도 회복되지 않는다([§6](CLE-API-CONV-RESP.md#6-http-상태-코드)). 언제 나는지는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능-켜기와-환경-변수) 이 정한다.
12. 요청 빈도 제한 수치의 단일 기준(single source of truth)은 [§7](CLE-API-CONV-RATE.md#7-요청-빈도-제한) 표다. 한도를 넘은 HTTP 요청에는 `429` 를 돌려준다. `Retry-After` 헤더를 함께 싣는지는 행마다 다르다. 어느 행이 싣는지는 §7 표 아래에 적는다. 예외가 있다. 서명 참조가 있는 채팅 채널 트리거의 인바운드는 전역 한도를 받지 않는다. 채팅 채널 인바운드는 채팅방 단위 한도를 넘어도 `202` 를 받는다([§7 머리 콜아웃](CLE-API-CONV-RATE.md#7-요청-빈도-제한)). WebSocket 명령은 HTTP 응답이 없고 소켓 `exception` 이벤트(`RATE_LIMITED`)로 알린다.
13. 목록 조회의 기본 페이지네이션은 offset 방식이다. 대량으로 쌓이는 데이터는 cursor 방식을 쓴다.
14. `PUT` 은 쓰지 않는다. 부분 수정은 `PATCH` 로 한다.

## 하위 문서

이 문서는 규약의 입구다. 위 「규칙」 이 규약 전체를 요약하고 절마다의 상세는 아래 하위 문서가 정한다. 이 문서에는 요구사항 줄이 없다. 규약 문서라서 「규칙」 절이 그 역할을 한다. 규칙과 하위 문서가 쓰는 절 번호(§)는 나누기 전 번호를 그대로 쓴다. 맡는 요구사항 칸은 그 하위 문서가 링크로 가리키는 다른 문서의 요구사항이고 괄호 안은 그 요구사항에 기대는 자리다. 하위 문서 본문에는 요구사항 번호를 적지 않는다.

| 하위 문서 | 다루는 것 | 맡는 규칙 | 맡는 요구사항 |
|---|---|---|---|
| [HTTP API 규약 — URL 과 요청](CLE-API-CONV-URL.md) | §2 URL 구조(명명 규칙과 예외 · 워크스페이스 스코핑 · 시스템 전역 API), §3 HTTP 메서드, §4 요청 형식, §12 공통 API 패턴(상태 토글 · 유니크 제약 범위) | 1 · 2 · 3 · 4 · 14 | REQ-TRIG-026 · REQ-SCHED-029 (§12.1 적용 대상의 camelCase 토글 필드) |
| [HTTP API 규약 — 응답 형식과 상태 코드](CLE-API-CONV-RESP.md) | §5 응답 형식(봉투 · 목록 · 부재 표현과 검증 층), §6 HTTP 상태 코드, §8 페이지네이션, §9 파일 업로드 | 5 · 6 · 7 · 8 · 9 · 10 · 11 · 13 | REQ-EIAIN-024 (§6 `410` 행의 EIA 토큰 갱신 예외) · REQ-CHAT-064 (§6 `503` 행의 채팅 채널 `/start` 취소 실패) |
| [HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE.md) | §7 요청 빈도 제한(한도 표 · 초과 응답 · 키 결정 규칙 · 건너뛰는 경우) | 12 | REQ-CHAT-046 · REQ-CHAT-047 (§7 표의 채팅 채널 인바운드 행) |
| [HTTP API 규약 — WebSocket 과 웹훅 수신](CLE-API-CONV-HOOK.md) | §10 WebSocket 요약, §11 웹훅 수신 엔드포인트(URL · 메서드 · 처리 흐름 · 응답 봉투와 예외 · 인증 · 한도), 웹훅 수신 한도에서 채팅 채널 트리거를 뺀 결정의 근거 | 5 · 9 · 12 (웹훅 수신 쪽) | REQ-WEBHOOK-002 (§11.1 `base_url`) · REQ-WEBHOOK-012 · REQ-WEBHOOK-032 (§11.1 `endpoint_path` 의 v4 UUID 검증) · REQ-WEBHOOK-003 (§11.2 POST 전용) · REQ-SLACK-043 (§11.4 Slack 슬래시 명령 응답 예외) |

## 1. 기본 원칙

| 항목 | 규칙 |
|------|------|
| 프로토콜 | HTTPS (TLS 1.2 이상) |
| 스타일 | RESTful |
| 형식 | JSON (`Content-Type: application/json`) |
| 인코딩 | UTF-8 |
| 인증 | Bearer 토큰 (`Authorization: Bearer {access_token}`) |
| 버전 | URL 경로에 넣지 않는다. Accept 헤더를 쓰거나 단일 버전으로 운영한다 |

## 하위 문서로 옮긴 절

다른 문서가 링크하는 절 제목이다. 본문은 하위 문서에 있다.

### 2.2 명명 규칙

→ [HTTP API 규약 — URL 과 요청](CLE-API-CONV-URL.md#22-명명-규칙)

### 5.5 부재 표현: `null` 과 키 생략

→ [HTTP API 규약 — 응답 형식과 상태 코드](CLE-API-CONV-RESP.md#55-부재-표현-null-과-키-생략)

### 6. HTTP 상태 코드

→ [HTTP API 규약 — 응답 형식과 상태 코드](CLE-API-CONV-RESP.md#6-http-상태-코드)

### 7. 요청 빈도 제한

→ [HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE.md#7-요청-빈도-제한)

## 미결 사항

- **`204` 삭제 응답의 건수 헤더**: [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 의 범위 삭제(`DELETE /api/agent-memories?scopeKey=`)가 프로젝트 첫 커스텀 응답 헤더 `X-Deleted-Count` 를 쓴다. `204` 라 본문이 없어 실제 삭제 행 수를 헤더로 싣고(0 가능, 멱등 삭제) cross-origin 에서 읽히도록 CORS `exposedHeaders` 에 넣는다. 그 문서는 이 방식을 이 규약의 공통 규칙(멱등 DELETE 와 커스텀 건수 헤더)으로 올리는 일을 별도 작업으로 넘겼다. 공통 규칙으로 올릴지 결정이 필요하다.
- **자원을 만들지 않는 POST 의 성공 코드**: [§6](CLE-API-CONV-RESP.md#6-http-상태-코드) 은 `200` 을 조회·수정에, `201` 을 생성에 배정한다. 저장소에는 `@HttpCode(200)` 을 단 액션 POST 가 여럿 있고 OAuth 시작(설치 대기 통합 행 생성)이나 초대 수락(멤버십 행 생성)처럼 부수적으로 행을 만드는 POST 도 `200` 이다. [OpenAPI 문서화](CLE-API-SWAGGER.md) 는 광고한 코드와 실제 코드의 짝만 강제하고 어느 코드가 맞는지는 정하지 않는다고 스스로 적는다. §6 에 "액션 POST(자원 생성 없음 또는 부수 생성) = `200`" 행을 둘지 결정이 필요하다.
- **서버 설정으로 꺼진 기능의 상태 코드**: `WEBAUTHN_DISABLED` 는 503 이고 같은 부류인 `OAUTH_CONFIG_MISSING`(서버 OAuth 설정 없음)은 500 이다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). 두 코드를 한 상태로 맞출지, 맞춘다면 어느 쪽으로 맞출지 결정이 필요하다. 배경은 [응답 형식과 상태 코드](CLE-API-CONV-RESP.md#passkey-기능이-꺼졌을-때의-503-을-예외로-적었다-2026-10-17) 의 Rationale 에 있다.

## 구현 위치

- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/common/pipes/validation.pipe.ts`
- `codebase/backend/src/common/dto/*.ts`
- `codebase/backend/src/common/swagger/error-response.dto.ts`
- `codebase/backend/src/common/interceptors/transform.interceptor.ts` (성공 응답 `{ data }` 래핑과 pass-through. HTTP 가 아닌 호출을 건너뛴다)
- `codebase/backend/src/common/utils/http-context.ts` (`isHttpContext`. HTTP 전용 전역 enhancer(요청 빈도 제한 가드 · 응답 래핑 · 요청 로깅)가 함께 쓰는 판정)
- `codebase/backend/src/repo-guards/__tests__/global-enhancer-ws-safety.spec.ts` (전역 enhancer 분류 가드)
- 주제별 구현 위치는 하위 문서마다 있다. 응답 계약 검증자는 [응답 형식과 상태 코드](CLE-API-CONV-RESP.md#구현-위치), 요청 빈도 제한 가드는 [요청 빈도 제한](CLE-API-CONV-RATE.md#구현-위치), 웹훅 수신 컨트롤러는 [WebSocket 과 웹훅 수신](CLE-API-CONV-HOOK.md#구현-위치) 에 있다.

## Rationale

### 규약을 하위 문서로 나눈 이유 (2026-11-13)

본문이 스펙 본문 한도(20,000자)를 넘어 주제별 하위 문서로 나눴다. 규칙 목록 · 미결 사항 · 공통 구현 위치는 이 문서에 두고 절의 상세와 그 절의 Rationale 은 하위 문서로 옮겼다. 다른 문서가 링크하는 절 제목은 이 문서에 짧은 절로 남겨 링크가 끊기지 않게 했다.

### 전역 요청 빈도 제한이 HTTP 요청만 센다고 적었다 (2026-10-22)

다른 문서가 이 제목으로 링크해서 제목만 남겼다. 본문은 하위 문서에 있다.

→ [HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE.md#전역-요청-빈도-제한이-http-요청만-센다고-적었다-2026-10-22)
