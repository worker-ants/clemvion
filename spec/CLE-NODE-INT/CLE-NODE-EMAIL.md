---
id: "CLE-NODE-EMAIL"
title: "Send Email 노드"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-EMAIL-001", "REQ-EMAIL-002", "REQ-EMAIL-003", "REQ-EMAIL-004", "REQ-EMAIL-005", "REQ-EMAIL-006", "REQ-EMAIL-007", "REQ-EMAIL-008", "REQ-EMAIL-010", "REQ-EMAIL-011", "REQ-EMAIL-012", "REQ-EMAIL-013", "REQ-EMAIL-014", "REQ-EMAIL-015", "REQ-EMAIL-016", "REQ-EMAIL-017", "REQ-EMAIL-018", "REQ-EMAIL-019", "REQ-EMAIL-020", "REQ-EMAIL-021", "REQ-EMAIL-022", "REQ-EMAIL-023", "REQ-EMAIL-024", "REQ-EMAIL-025", "REQ-EMAIL-026", "REQ-EMAIL-027"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "490870ce905cf07df8841f6b985a37adcb3ba18ef42a5ca63e5bfc60c04ff812"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/4-integration/3-send-email.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "7603641879f35eca048e1fc1e29c2a946e09c5a9dca3ce4738db9e6fcc647189"
etag: "sha256-33ff07aa6cc647cf7a106e1a88a065901a8bb5bce1de3d32cfac7260b358ccd6"
---
> 구현 상태: 부분 구현 (워크스페이스 누락의 `INTEGRATION_SERVICE_UNAVAILABLE` 은 미구현) · 원문: `spec/4-nodes/4-integration/3-send-email.md`, `spec/4-nodes/_product-overview.md` (§7.3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Send Email 노드(`send_email`)는 SMTP 로 이메일을 보내는 서비스 특화 통합 노드다. 통합의 SMTP 자격 증명(`host`·`port`·`secure`·`username`·`password`·`default_from`)으로 보낸다. 런타임 전송 실패는 `error` 포트로 나간다(노드 출력 규약 Principle 3.1).

통합 참조, 핸들러 6단계 계약, 공통 에러 코드, 사설망 차단 정책, 캔버스 요약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. SMTP 통합의 자격 증명 스키마와 연결 테스트는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서 정한다. 이 문서는 노드의 설정·실행·에러를 정하고, 출력 구조는 하위 문서 [출력 구조](CLE-NODE-EMAIL-OUTPUT.md) 가 정한다. 이 노드는 통합 노드 공통 규칙과 두 군데가 다르다. 서비스 미주입 시 흐름 지시 상태 `requires_integration` 을 돌려주고, `IntegrationError` 가 아닌 실패를 모두 `EMAIL_SEND_FAILED` 로 흡수한다.

## 요구사항

- REQ-EMAIL-001 WHEN 노드가 실행되면 THE SYSTEM SHALL `service_type='email'` SMTP 통합의 자격 증명으로 이메일을 보낸다. (원본: ND-EM-01)
- REQ-EMAIL-002 WHEN 사용자가 노드를 설정하면 THE SYSTEM SHALL 수신자(To·CC·BCC)·제목·본문 입력을 제공한다. (원본: ND-EM-02)
- REQ-EMAIL-003 WHEN `bodyType` 이 `html` 이면 THE SYSTEM SHALL 본문을 HTML 로 보내고, 그 밖이면 텍스트로 보낸다. (원본: ND-EM-03)
- REQ-EMAIL-004 WHEN 첨부 파일이 설정되면 THE SYSTEM SHALL `filename`·`content`·`contentType`·`encoding`·`cid` 만 nodemailer 로 넘겨 첨부한다. (원본: ND-EM-04)
- REQ-EMAIL-005 WHEN 수신자·제목·본문·첨부 내용에 표현식이 있으면 THE SYSTEM SHALL 평가한 값으로 보낸다. (원본: ND-EM-05)
- REQ-EMAIL-006 IF 첨부 항목에 `path`·`href` 키가 있으면 THE SYSTEM SHALL 그 키를 지우고 `disableFileAccess`·`disableUrlAccess` 를 켠 채 보낸다.
- REQ-EMAIL-007 IF 수신자 필드(`to`·`cc`·`bcc`)가 배열이 아니면 THE SYSTEM SHALL 스키마와 검증기 단계에서 거부한다.
- REQ-EMAIL-008 WHEN 수신자를 정규화하면 THE SYSTEM SHALL 각 원소를 trim 하고 빈 문자열을 뺀다.
- REQ-EMAIL-010 IF 정규화한 `to` 가 비면 THE SYSTEM SHALL `EMAIL_NO_RECIPIENTS` 로 에러 포트에 보낸다.
- REQ-EMAIL-011 WHEN 평가된 본문이 256KB 를 넘으면 THE SYSTEM SHALL `output.body` 를 자르고 `output.bodyTruncated` 를 `true` 로 둔다.
- REQ-EMAIL-012 WHEN 정규화한 `to` 가 비지 않은 채 dry-run 으로 실행되면 THE SYSTEM SHALL SMTP 를 건드리지 않고 mock 결과로 `out` 포트에 보낸다.
- REQ-EMAIL-013 WHEN 정규화한 `to` 가 비지 않은 채 `IntegrationsService` 가 주입되지 않았으면 THE SYSTEM SHALL 외부 호출 없이 흐름 지시 상태 `requires_integration` 을 돌려준다.
- REQ-EMAIL-014 WHEN SMTP 로 보내기 전이면 THE SYSTEM SHALL `credentials.host` 에 사설망 차단을 적용한다.
- REQ-EMAIL-015 IF SMTP 호스트가 사설망 대역을 가리키면 THE SYSTEM SHALL `EMAIL_HOST_BLOCKED` 로 에러 포트에 보낸다.
- REQ-EMAIL-016 WHEN 이메일을 보내면 THE SYSTEM SHALL 보낸 사람을 `credentials.default_from` 으로 둔다.
- REQ-EMAIL-017 WHEN 같은 자격 증명으로 다시 보내면 THE SYSTEM SHALL 자격 증명 해시 기반으로 캐시한 transporter 를 재사용한다.
- REQ-EMAIL-018 WHEN 서버가 일부 수신자만 거부하면 THE SYSTEM SHALL `out` 포트로 보내고 거부된 수신자를 `output.rejected` 에 담는다.
- REQ-EMAIL-019 IF nodemailer 발송이 실패하면 THE SYSTEM SHALL `EMAIL_SEND_FAILED` 로 에러 포트에 보낸다.
- REQ-EMAIL-020 IF 실행 중 `IntegrationError` 가 나면 THE SYSTEM SHALL 그 코드를 `output.error.code` 로 그대로 내보낸다.
- REQ-EMAIL-021 IF 실행 중 `IntegrationError` 가 아닌 예외가 나면 THE SYSTEM SHALL `EMAIL_SEND_FAILED` 로 에러 포트에 보낸다.
- REQ-EMAIL-022 IF 실행 컨텍스트에 워크스페이스 정보(`__workspaceId`)가 없으면 THE SYSTEM SHALL `INTEGRATION_SERVICE_UNAVAILABLE` 로 에러 포트에 보낸다. (미구현)
- REQ-EMAIL-023 WHEN 에러를 내보내면 THE SYSTEM SHALL 메시지의 비밀 토큰을 `***` 로 가리고, 수신자 로컬 파트를 마스킹하고, 제목을 200자로 자른다.
- REQ-EMAIL-024 WHEN 통합을 얻은 뒤 실행이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 남긴다.
- REQ-EMAIL-025 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 `SEND`, `api_path` 를 SMTP 호스트로 채우고 수신자 이메일은 저장하지 않는다.
- REQ-EMAIL-026 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-EMAIL-027 WHEN 통합을 얻은 뒤의 실패를 활동 로그에 남기면 THE SYSTEM SHALL `output.error.code` 와 같은 코드(`IntegrationError` 면 그 코드, 그 밖은 `EMAIL_SEND_FAILED`)를 남긴다.

## 하위 문서

- [Send Email 노드 — 출력 구조](CLE-NODE-EMAIL-OUTPUT.md): 정상 발송 · 런타임 실패 · 서비스 미주입 · dry-run 네 가지 출력의 JSON 예시, 필드 표, 표현식 접근 예. 맡는 요구사항: REQ-EMAIL-011, REQ-EMAIL-012, REQ-EMAIL-013, REQ-EMAIL-018, REQ-EMAIL-020, REQ-EMAIL-023

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | SMTP 통합 참조([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조). `serviceType='email'` 만 허용 |
| `to` | String[] | ✓ | `[]` | 수신자 배열. 각 원소는 이메일 주소 또는 표현식. 콤마로 구분한 단일 문자열은 받지 않는다(Rationale) |
| `cc` | String[] | | `[]` | 참조. 형식은 `to` 와 같다 |
| `bcc` | String[] | | `[]` | 숨은 참조. 형식은 `to` 와 같다 |
| `subject` | String (표현식) | ✓ | `''` | 메일 제목 |
| `body` | String (표현식) | ✓ | `''` | 메일 본문. `bodyType='html'` 이면 HTML 문자열 |
| `bodyType` | `text` / `html` | | `text` | 본문 형식 |
| `attachments` | Attachment[] | | `[]` | 첨부 파일 목록 |

첨부 항목(Attachment):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filename` | String | ✓ | 파일 이름 |
| `content` | String (Base64 또는 평문, 표현식) | ✓ | 파일 내용. `encoding='base64'` 와 함께 쓰면 바이너리 첨부 |
| `contentType` | String | | MIME 타입. 비우면 `filename` 으로 추론 |
| `encoding` | String | | `content` 의 인코딩(예: `base64`, `hex`) |
| `cid` | String | | HTML 본문에서 인라인 이미지로 참조할 Content-ID |

보안: nodemailer 의 `path`·`href` 옵션은 의도적으로 노출하지 않는다. 사용자 입력으로 임의의 로컬 파일(`/etc/passwd` 등)이나 외부 URL 에 접근할 수 있기 때문이다. 발송 옵션에 `disableFileAccess: true`·`disableUrlAccess: true` 를 주고, 핸들러도 `path`·`href` 키를 지운다.

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` 의 `sendEmailNodeConfigSchema`·`sendEmailNodeMetadata` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기 | `serviceType='email'` 통합만 보여 준다 |
| 수신자 | 통합 아래 | To·CC·BCC 칩 입력과 추가 버튼 | 배열로 입력한다. 원소마다 표현식 가능 |
| 제목 | 수신자 아래 | Subject 입력 | 표현식 가능(예: `Hello {{ $input.name }}`) |
| 본문 | 가운데 | Body Type 선택(text·html), 본문 에디터 | html 이면 리치 에디터 옵션을 준다 |
| 첨부 | 아래 | Attachments 목록과 추가 버튼 | 항목마다 `filename`·`content` 필수, `contentType`·`encoding`·`cid` 선택 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터. 핸들러는 직접 쓰지 않고 표현식에서만 참조한다 |
| 출력 | `out` | Output | data | false | 발송 성공(일부 거부 포함) |
| 출력 | `error` | Error | error | false | 런타임 실패(수신자 없음 · 통합 해소 실패 · 전송 실패 · 사설망 차단). `EMAIL_SEND_FAILED`·`EMAIL_HOST_BLOCKED`·`EMAIL_NO_RECIPIENTS`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED` |

동적 포트는 없다. `handler.validate()` 실패만 throw 로 노드 실행 자체를 실패시킨다. 빈 `to` 를 포함해 `execute()` 의 try/catch 안에서 난 실패는 `error` 포트로 간다.

## 실행 로직

핸들러는 아래 순서로 실행한다. 3단계(본문 제한)는 `execute()` 의 try 블록 앞에 있고, 4단계(빈 수신자 확인)부터 9단계(SMTP 발송)까지는 try/catch 범위 안이다. 그래서 4단계에서 던진 예외는 5단계(dry-run)와 6단계(서비스 미주입)에 닿기 전에 catch 로 가서 에러 포트로 나간다.

1. **사전 검증**(`validate()`): `evaluateMetadataBlockingErrors`(경고 규칙 평가), `validateConfig`(수신자 배열만 허용), `subject`·`body` 문자열 확인, `bodyType` enum 확인. 실패하면 throw 로 노드 실행이 시작되지 않는다(실행 실패).
2. **수신자 정규화**: `to`·`cc`·`bcc` 는 배열만 받는다.
   - 배열이면 원소를 `trim()` 하고 빈 문자열을 뺀다.
   - 배열이 아니면 방어적으로 `[]` 를 돌려준다. 스키마와 검증기가 이미 거부하므로 표준 경로에서는 도달하지 않는다. 옛 데이터와 직접 호출 경로를 위한 안전망이다.
3. **본문 제한**: 평가된 `body` 를 `truncateBodyForOutput`(256KB)으로 제한한다. 넘치면 `output.bodyTruncated: true` 를 붙인다.
4. **빈 수신자 확인**: 정규화한 `to.length === 0` 이면 try 블록 **안**에서 `IntegrationError('EMAIL_NO_RECIPIENTS')` 를 던진다. 메시지는 ``No valid recipients after normalizing the `to` field`` 다. catch 가 잡아 `EMAIL_NO_RECIPIENTS` 로 에러 포트에 보낸다(dry-run · 서비스 미주입 환경 포함). 통합을 얻기 전이라 활동 로그는 남지 않는다.
5. **dry-run 분기**: `context.variables.__dryRun === true` 면(`metadata.supportsDryRun: true`) 실제 SMTP 발송 전에 `buildDryRunMock('send_email', { to, subject })` 로 끝낸다. 외부 SMTP 를 건드리지 않고 `out` 포트로 진행한다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) dry-run).
6. **서비스 미주입 확인**: `IntegrationsService` 가 주입되지 않았으면 외부 호출 없이 `status: 'requires_integration'` 을 돌려준다([출력 구조](CLE-NODE-EMAIL-OUTPUT.md#서비스-미주입-흐름-지시-상태)).
7. **통합 조회**: `getForExecution` 으로 SMTP 자격 증명을 복호화한다. 넘기는 인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용) 이 정한다. `serviceType !== 'email'`·`status !== 'connected'`·필수 필드 누락은 `IntegrationError` 로 던져 catch 에서 에러 포트로 보낸다. 없는 `integrationId` 는 `NotFoundException`(`IntegrationError` 가 아님)이라 `EMAIL_SEND_FAILED` 로 흡수된다.
8. **사설망 차단**: `credentials.host` 가 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역을 가리키면 `EMAIL_HOST_BLOCKED` 로 에러 포트에 보낸다. HTTP Request·Database Query 노드와 같은 메커니즘과 플래그를 쓴다([통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단).
9. **SMTP 발송**: 자격 증명 해시 기반으로 nodemailer transporter 캐시를 재사용한다. `from = credentials.default_from` 이고 `subject`·`body` 는 평가된 값이다. `bodyType='html'` 이면 `html` 옵션, 아니면 `text` 옵션으로 보낸다.
10. **활동 로그 기록**: 통합을 얻은 뒤(`getForExecution` 이 성공한 뒤)에는 성공·실패와 관계없이 `logUsage` 를 부른다(인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용)). 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)). 실패를 남길 때 `error.code` 는 에러 포트의 `output.error.code` 와 같다. `IntegrationError` 는 공통 `toLogError` 가 그 코드를 그대로 남기고, 그 밖의 예외는 핸들러가 `EMAIL_SEND_FAILED` 로 정한다. 공통 fallback `INTEGRATION_CALL_FAILED` 는 쓰지 않는다(REQ-EMAIL-027). API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
    - `api_label` = NULL. 단일 동작이라 operation 카탈로그가 없다.
    - `api_method` = `'SEND'`(상수). 다른 SMTP 동작이 생기면 값을 늘린다.
    - `api_path` = `credentials.host`(SMTP 호스트) 또는 NULL. 수신자 이메일은 절대 저장하지 않는다(개인정보 보호). 마스킹한 수신자는 에러 케이스의 `output.error.details.to` 에만 둔다.
11. **반환**: dry-run, 서비스 미주입, 성공, 런타임 실패 중 하나의 노드 출력을 돌려준다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. 네 가지 출력(정상 발송 `out` · 런타임 실패 `error` · 서비스 미주입 `requires_integration` · dry-run mock)의 예시와 필드는 → [Send Email 노드 — 출력 구조](CLE-NODE-EMAIL-OUTPUT.md). `meta` 가 공통 규칙과 다른 두 곳은 아래 Rationale 「`meta` 가 공통 규칙과 다른 두 곳」 에 있다.

## 에러 코드

### 사전 검증 에러

`handler.validate()` 실패(설정 형식 자체가 잘못된 경우)는 경고 규칙, `evaluateMetadataBlockingErrors`, `validateSendEmailConfig` 가 낸 메시지로 생긴다. 엔진은 그 메시지 앞에 `INVALID_NODE_CONFIG: ` 를 붙여 던지고 실행을 실패로 끝낸다. 구조화된 `error.code` 는 없다([노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#노드-실행-흐름)). 메시지 예: `Email integration must be selected.`, `Recipient (To) must include at least one address.`, `to is required and must be a non-empty array of email addresses`, `subject is required and must be a string`, `bodyType must be either "text" or "html"`. 캔버스는 경고 규칙의 메시지를 한국어 화면에서 번역해 보인다(예: `수신자 (To) 를 한 명 이상 입력해야 합니다.`, `backend-labels.ts`).

### 런타임 에러 (`port: 'error'`)

| 코드 | 조건 |
|------|------|
| `EMAIL_SEND_FAILED` | nodemailer `sendMail` 이 던진 일반 전송 실패(네트워크·SMTP 응답 에러 등). `IntegrationError` 가 **아닌** 모든 catch 분기의 fallback 이다. 그래서 없는 `integrationId` 의 `NotFoundException` 과 워크스페이스 누락의 일반 `Error` 도 현재 이 코드로 흡수된다. 통합을 얻은 뒤의 실패면 활동 로그에도 이 코드로 남는다(REQ-EMAIL-027) |
| `EMAIL_HOST_BLOCKED` | SMTP `host` 가 사설·loopback 대역이라 사설망 차단에 막힘. 기본 켜짐, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 해제. `IntegrationError('EMAIL_HOST_BLOCKED')` 로 던져 그대로 나온다 |
| `EMAIL_NO_RECIPIENTS` | 정규화한 `to` 가 비어 보낼 곳이 없음. 수신자 표현식이 빈 값으로 평가될 때 생긴다. `IntegrationError('EMAIL_NO_RECIPIENTS')` 로 던져 그대로 나온다. 통합을 얻기 전이라 활동 로그는 남지 않는다. dry-run 과 서비스 미주입 환경에서도 같다 |
| `INTEGRATION_INCOMPLETE` | SMTP 자격 증명의 `host`·`port`·`secure`·`username`·`password`·`default_from` 중 하나라도 없음 |
| `INTEGRATION_TYPE_MISMATCH` | 참조한 통합의 `serviceType` 이 `'email'` 이 아님 |
| `INTEGRATION_NOT_CONNECTED` | 통합 상태가 `connected` 가 아님(`expired`·`error`·`pending_install`) |

- `execute()` 의 try/catch 에서 `IntegrationError` 를 잡은 경우에만 그 `code` 가 `output.error.code` 로 **직접** 나온다(`EMAIL_HOST_BLOCKED`·`EMAIL_NO_RECIPIENTS`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED`). nodemailer 전송 실패를 포함한 그 밖의 모든 throw 는 `EMAIL_SEND_FAILED` 로 바뀐다.
- `output.error.message` 는 `IntegrationHandlerBase.sanitizeMessage` 가 비밀 토큰(`Bearer …`, `password=…`, 32자 이상 hex·base64 등)을 `***` 로 가린 뒤 나간다. `output.error.details.to` 는 `maskEmailForErrorDetails` 로 로컬 파트를 가린다(`alice@example.com` → `a***@example.com`).

### 아직 에러 포트로 나오지 않는 코드 (Planned)

- `INTEGRATION_SERVICE_UNAVAILABLE`: `__workspaceId` 가 없을 때 낼 코드다(REQ-EMAIL-022). [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) §6.22 의 이 코드 행이 워크스페이스 컨텍스트 누락을 담는다. 지금은 공통 베이스 `acquireIntegration` 이 일반 `Error('Missing workspace context …')` 를 던지고, `IntegrationError` 가 아니라서 `EMAIL_SEND_FAILED` 가 된다. 다른 통합 노드의 같은 경우도 아직 이 코드로 나오지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#미결-사항) 미결 사항).

다음 두 코드는 이 노드에서 나오지 않고, 내보낼 계획도 없다.

- 통합 없음의 전용 코드: `getForExecution` → `requireEntity` 가 NestJS `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 던진다. `IntegrationError` 가 아니라서 REQ-EMAIL-021 대로 `EMAIL_SEND_FAILED` 로 나온다. `INTEGRATION_NOT_FOUND` 라는 코드는 에러 코드 카탈로그와 코드에 없다. [통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드) 도 없는 통합 · 다른 워크스페이스 통합 · 남의 개인 통합을 같은 실패로 둔다.
- `INTEGRATION_CALL_FAILED`: 공통 베이스의 fallback 코드(`toLogError`)다. 이 핸들러는 `IntegrationError` 가 아닌 실패의 코드를 출력과 활동 로그 모두 `EMAIL_SEND_FAILED` 로 직접 정하므로 이 코드는 어디에도 나오지 않는다(REQ-EMAIL-021 · REQ-EMAIL-027).

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Send Email 행을 따른다. `summaryTemplate` 은 `{{to.length}} recipients · {{subject}}` 이고 렌더된 한 줄을 40자에서 자른다. `summaryTemplate` DSL 이 배열 슬라이스·조건 카운트를 지원하지 않아 `to: {수신자} +N` 대신 수신자 수와 제목을 보인다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다. 이 노드는 `integrationId` 가 언제나 필수라 조건 없이 대상이다.

## 구현 위치

- `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`
- `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts`

## Rationale

### SMTP 호스트에도 사설망 차단 적용

발송 경로의 사설망 차단은 HTTP Request·Database Query 노드와 같은 `ALLOW_PRIVATE_HOST_TARGETS` 플래그를 쓴다(기본 차단, 셀프 호스팅만 해제). 통합 노드 전체의 보안 자세를 한 가지로 유지하고, 연결 테스트만 막고 발송은 뚫리는 비대칭을 막기 위해서다. 별도 opt-in 플래그를 만들지 않은 근거, 코드 이름(`EMAIL_HOST_BLOCKED`)을 고른 근거, 채팅 채널 분류표에 영향이 없다는 분석은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 에 있다.

### 수신자 필드를 배열만 받게 정리

이전에는 수신자 타입이 `String[] / String`(합 타입)이라 콤마로 구분한 단일 문자열(`"alice@x.com, bob@y.com"`)도 입력할 수 있었다. 두 검증 층의 판단이 달랐다.

| 층 | 문자열 입력 처리 |
|----|------------------|
| zod `sendEmailNodeConfigSchema` | `z.array(z.string())` 라 파싱 실패 |
| 검증기 `validateSendEmailConfig` | `isRecipientsLike` 가 `typeof string` 도 허용해 통과 |

원본 문자열은 zod 단계에서 거부돼 `normalizeRecipients` 까지 가지 못한다. 하지만 검증기만 보면 통과라서 `add_node` 도구 응답에는 유효해 보이는데 저장소에는 배열로 강제 변환돼 의도와 다른 원소 1개짜리 배열이 저장될 수 있었다.

해법으로 검증기와 핸들러를 배열만 받도록 좁혀(breaking) 두 층을 맞췄다. 저장·에코·표현식이 모두 배열 한 가지 형태가 된다. 기각한 대안은 둘이다. zod 를 합 타입으로 완화하는 안은 저장소에 두 형태가 섞여 출력 에코와 뒤쪽 표현식이 모두 합 타입을 처리해야 해서 버렸다. 프론트엔드가 자동으로 배열로 감싸는 안은 백엔드가 져야 할 의미 보정 책임을 프론트엔드가 떠안아 책임 위치가 흐려져서 버렸다. 스테이징 단계라 단일 문자열 워크플로우가 거의 없어 별도 마이그레이션 스크립트 없이 진행했다.

층별 결과 동작:

- 프론트엔드: `widget: 'field-array'` 가 이미 배열이라 변경 없음
- 저장(zod): `z.array(z.string())` 유지. 배열이 아닌 원본 입력은 파싱 실패
- 검증기(`validateSendEmailConfig`): 문자열 경로를 지우고 배열만 받음. zod 와 일치
- 핸들러(`normalizeRecipients`): 문자열 콤마 분리 경로를 지움. 배열이 아닌 입력은 방어적으로 `[]`
- 출력 에코(`sendEmailNodeOutputSchema.config.to/cc/bcc`): `z.unknown()` 에서 `z.array(z.string())` 로 바꿔 배열만 에코함을 명시
- 표현식: 배열 원소 단위로 `{{ ... }}` 를 쓴다(예: `["{{ $input.email }}"]`)

### 통합을 얻기 전에 끝난 실패는 활동 로그에 남기지 않는다 (2026-10-24)

규칙과 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale 에 있다(REQ-INTMGMT-053). 그래서 REQ-EMAIL-024 의 범위를 «통합을 얻은 뒤 실행이 끝나면» 으로 좁혔다.

### 빈 수신자를 에러 포트로 보낸다 (2026-11-06)

정규화한 `to` 가 비는 경우는 설정 형식 오류가 아니다. 수신자 표현식이 빈 값으로 평가될 때 생기므로 입력 데이터에 따라 결과가 달라진다. 워크플로우 작성자는 이런 실패를 에러 포트로 분기할 수 있어야 한다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.1 · 3.2). 노드 실행을 실패시키면 설정 오류와 구별되지 않고 평가된 제목과 본문도 출력에 남지 않는다. 그래서 확인을 `execute()` 의 try 블록 안으로 옮기고 `IntegrationError('EMAIL_NO_RECIPIENTS')` 로 던지게 했다.

확인 위치는 dry-run 분기와 서비스 미주입 확인 앞에 두었다. 그래야 dry-run 에서도 실제 실행과 같은 에러 포트 출력이 나온다. 설정에 수신자가 하나도 없는 경우는 그대로 `handler.validate()` 의 사전 검증 에러다.

- 기각: 빈 수신자에 throw 를 유지하는 안. 노드 실행 전체가 실패하므로 워크플로우 작성자가 에러 포트 분기를 쓸 수 없다.
- 요구사항 변경: 옛 동작의 REQ-EMAIL-009 를 지우고 REQ-EMAIL-010 으로 대체했다. REQ-EMAIL-012 와 REQ-EMAIL-013 에는 정규화한 `to` 가 비지 않았다는 전제를 붙였다.

### 워크스페이스 누락 코드와 활동 로그 코드를 정했다 (2026-11-13)

요구사항의 코드 이름을 구현과 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 맞췄다. 동작은 바꾸지 않았다.

- 워크스페이스 누락만 REQ-EMAIL-022 에 남기고 코드를 `INTEGRATION_SERVICE_UNAVAILABLE` 로 적었다. 카탈로그의 이 코드 행이 워크스페이스 컨텍스트 누락을 이미 담고 있고, [통합 노드 공통](CLE-NODE-INT-COMMON.md) 도 다른 통합 노드의 같은 경우에 이 코드를 적는다.
- 통합 없음은 REQ-EMAIL-022 에서 뺐다. 카탈로그와 코드에 전용 코드가 없고, 통합 노드 공통은 없는 통합 · 다른 워크스페이스 통합 · 남의 개인 통합을 같은 실패로 둔다. 전용 코드를 새로 둘지는 이 문서에서 정하지 않는다. 지금 동작은 REQ-EMAIL-021 이 정한다.
- 핸들러는 `IntegrationError` 에만 `toLogError` 를 쓰고 그 밖은 `EMAIL_SEND_FAILED` 로 직접 정한다. 활동 로그에 공통 fallback `INTEGRATION_CALL_FAILED` 가 남는다고 적었던 이전 서술을 구현에 맞춰 고치고 REQ-EMAIL-027 을 더했다.

### `meta` 가 공통 규칙과 다른 두 곳 (2026-11-13)

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 규칙 3 과 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 2 는 `meta` 에 관측한 실행 메트릭만 두고 모든 통합 노드에 `meta.durationMs` 를 둔다. 이 노드는 두 곳이 다르다.

- `meta.deliveryStatus` 는 공통 규칙에 없는 필드다. 노드 출력 재설계 때 출력 최상위에서 `meta` 로 옮긴 필드라(`migrate-node-output-refs.ts` 의 `META_FIELDS`) 워크플로우가 `$node["X"].meta.deliveryStatus` 로 읽을 수 있다. 지우면 이 참조를 쓰는 워크플로우가 깨지므로 남겨 둔다.
- dry-run 출력에는 `meta.durationMs` 가 없다. HTTP Request · Database Query · Cafe24 · MakeShop 노드의 dry-run 출력은 이 값을 싣는다. 스펙 서술을 구현에 맞추는 범위라 핸들러를 고치지 않았고, dry-run 출력에 `meta.durationMs` 를 더하는 일은 NERV Task `CLE-T-22PSME` 가 맡는다.
