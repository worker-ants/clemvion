---
id: "CLE-NODE-INT-COMMON"
title: "통합 노드 공통"
type: "convention"
version: 14
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "923002abf930e51271f402d8d38f0f81476dae0b9e34f102a1146fc9bd204b73"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/4-integration/0-common.md", "spec/4-nodes/_product-overview.md", "spec/5-system/4-execution-engine.md"]
mirror_sha256: "78f7d3679c235a25a6fd2cf153fc61970363237a5cbeca79f24894eb33c0d367"
etag: "sha256-c5f332d2cb2479baf94d1a8d0f898b9e56bbf4a5b2d13a1120e6b77e32c1615e"
---
> 구현 상태: 부분 구현 (워크스페이스 누락의 출력 코드는 미구현) · 원문: `spec/4-nodes/4-integration/0-common.md`, `spec/5-system/4-execution-engine.md` (§10 Integration Handler 계약), `spec/4-nodes/_product-overview.md` (§7 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

통합 노드(integration nodes)는 통합(Integration)에 저장된 자격 증명을 써서 외부 서비스를 부르는 노드다. 다섯 종류가 있다. 범용 노드는 [HTTP Request 노드](CLE-NODE-HTTP.md)와 [Database Query 노드](CLE-NODE-DBQUERY.md)이고, 서비스 특화 노드는 [Send Email 노드](CLE-NODE-EMAIL.md), [Cafe24 노드](CLE-NODE-CAFE24.md), [MakeShop 노드](CLE-NODE-MAKESHOP.md)다. 서비스 특화 노드는 언제나 통합을 참조하고, HTTP Request 노드는 인증 방식을 `integration` 으로 골랐을 때만 참조한다.

이 문서는 다섯 노드가 함께 따르는 규약을 정한다. 통합 참조와 통합 선택기, 노드 출력의 카테고리별 사용 방식, 핸들러 실행 계약(실행 엔진이 통합 핸들러를 부르는 순서 포함), 공통 에러 코드, 사설망 차단(SSRF guard), 캔버스 요약과 삭제된 통합 표시가 여기에 속한다. 노드별 설정·동작·출력은 각 노드 문서가 정한다.

다음은 이 문서의 범위 밖이다.

- 통합 엔티티와 서비스별 자격 증명 스키마: [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md), [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)
- 노드 실행 결과가 통합 상태(`connected`·`error` 등)를 바꾸는 범위: [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)
- 활동 로그의 API 식별 정보를 통합별로 채우는 정책: [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](../CLE-INT/CLE-INT-DATA.md#호출-api-식별-채우기-규칙). 식별 정보를 저장하라는 요구사항은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «호출 API 식별 정보 저장»(REQ-INTMGMT-022)이다
- 외부 MCP 서버 통합(`service_type='mcp'`): 워크플로우 노드로 노출되지 않고 AI 에이전트 노드의 `mcpServers` 설정에서만 쓴다. [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)와 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)에서 정한다. 즉 통합 엔티티는 이 문서의 노드와 AI 에이전트 MCP 도구 프로바이더, 두 곳에서 쓰인다.
- 노드 출력 다섯 필드의 일반 규약: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md). 노드 핸들러 일반 계약: [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md)

## 규칙

1. 서비스 특화 통합 노드는 통합 참조(`config.integrationId`)로 통합을 가리킨다. HTTP Request 노드는 `authentication='integration'` 일 때만 이 값을 쓴다.
2. 설정 에코에는 자격 증명을 싣지 않는다. 통합에 관해서는 `integrationId` 만 싣는다.
3. 시간 메트릭은 모든 통합 노드에서 `meta.durationMs`(단위 ms) 하나로 쓴다.
4. 통합 노드는 블로킹 노드가 아니다. 흐름 지시 상태(`status`)는 비워 둔다. 예외는 [Send Email 노드](CLE-NODE-EMAIL.md)가 통합 서비스를 주입받지 못했을 때(의존성 주입 누락) 돌려주는 `requires_integration` 하나다([핸들러 실행 계약 「서비스 미주입과 워크스페이스 누락」](CLE-NODE-INT-COMMON-HANDLER.md#서비스-미주입과-워크스페이스-누락)).
5. 모든 통합 핸들러는 [핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md#6단계-계약) 의 6단계를 따른다.
6. 사전 검증 에러(`handler.validate()` 실패)만 throw 로 실행을 실패시킨다. `execute()` 안에서 난 실패는 모두 에러 포트(`port: 'error'`)와 `output.error.{code, message, details?}` 로 내보낸다. 근거는 [Rationale 「핸들러 실패를 에러 포트로 통일」](#핸들러-실패를-에러-포트로-통일-2026-05-17) 에 있다. 예외는 상위 취소 신호(`context.abortSignal`) 때문에 생긴 `AbortError` 하나다. 다섯 노드 모두 이 예외를 에러 포트로 바꾸지 않고 다시 던지므로 노드 실행이 `cancelled` 로 분류된다([노드 취소 「취소 에러 분류」](../CLE-EXEC/CLE-EXEC-CANCEL.md#취소-에러-분류)). Send Email 노드는 실행을 시작할 때 신호가 이미 켜져 있는 경우에만 이 예외를 던진다.
7. 통합을 얻은 뒤의 외부 호출마다 성공·실패와 관계없이 활동 로그를 1건 남긴다. 이때 API 식별 정보(`api`)를 함께 넘긴다. HTTP Request 노드는 통합 인증일 때만 활동 로그를 남긴다. 통합을 얻기 전에 끝난 실행은 활동 로그를 남기지 않는다. 조회 거절과 조회 앞 단계의 실패가 모두 해당한다. `logUsage` 는 얻은 통합만 받으므로 얻지 못한 통합에는 기록할 수 없다. 통합을 얻기 전에 끝나는 실패의 목록은 [공통 에러 코드](CLE-NODE-INT-COMMON-ERROR.md#공통-에러-코드) 에 있다.
8. HTTP Request·Database Query·Send Email 노드는 사설망 차단을 기본으로 켠다. 끄는 방법은 `ALLOW_PRIVATE_HOST_TARGETS=true` 하나뿐이다.
9. 차단 코드(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`)는 차단 판정에만 쓴다. 예외는 HTTP Request 노드가 리다이렉트 한도를 넘겼을 때 내는 `HTTP_BLOCKED` 하나다([사설망 차단](CLE-NODE-INT-COMMON-ERROR.md#사설망-차단)). 클라이언트에 나가는 차단 메시지에는 차단된 호스트나 IP 를 넣지 않는다.
10. 캔버스 요약은 노드 스키마의 `summaryTemplate` 으로 렌더하고, 렌더된 한 줄을 40자에서 자른다.
11. 삭제된 통합 표시는 캔버스 렌더러가 판정한다. 노드 스키마의 경고 규칙(`warningRules`)으로 판정하지 않는다.

## 통합 참조

| 설정 필드 | 타입 | 설명 |
|-----------|------|------|
| `integrationId` | UUID | 통합(`Integration`)을 가리키는 FK. 설정 패널의 통합 선택기에서 고른다. 통합 엔티티 정의는 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |

## 통합 선택기

통합 선택기(`IntegrationSelector`)는 노드 설정 패널 위쪽에 놓이는 드롭다운이다.

- 현재 워크스페이스에 등록된 통합 가운데 노드가 기대하는 서비스 유형만 보여 준다. HTTP Request 노드는 `http`, Database Query 노드는 `database`, Send Email 노드는 `email`, Cafe24 노드는 `cafe24`, MakeShop 노드는 `makeshop` 으로 거른다.
- 개인 통합과 조직 통합을 구분해 표시한다.
- 개인 통합을 고를 수 있는 조건과 고를 수 없는 항목의 표시는 [통합 관리 「워크플로우 에디터」](../CLE-INT/CLE-INT-MANAGE.md#워크플로우-에디터) 가 정한다. 남의 개인 통합은 처음부터 목록에 없다.
- 붙여넣거나 복제한 노드의 통합 참조는 [에디터](../CLE-WF/CLE-WF-EDITOR.md#노드-조작) 가 정한다.
- 연결 상태 배지(`connected`·`expired`·`error`)를 함께 보인다.
- "새 Integration 추가" 링크를 누르면 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 화면으로 간다.

## 노드 출력

통합 노드의 노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)의 다섯 필드(`config`, `output`, `meta?`, `port?`, `status?`)를 따른다. 정확한 필드 목록은 각 노드 문서의 "출력 구조" 절이 정한다.

```json
{
  "config": { /* 노드별 원본 설정 에코 */ },
  "output": { /* 노드별 결과 */ },
  "meta": { "statusCode": 200, "durationMs": 150 },
  "port": "success"
}
```

| 필드 | 통합 노드에서의 사용 방식 |
|------|---------------------------|
| `config` | 사용자가 입력한 원본 설정을 에코한다(노드 출력 규약 Principle 7). HTTP Request 의 `headers`·`body`, Database Query 의 `query`, Send Email 의 `subject`·`body` 에 든 표현식 템플릿을 평가 전 모습 그대로 남긴다. 자격 증명은 싣지 않고 `integrationId` 만 싣는다 |
| `output` | 외부 호출 결과의 도메인 데이터. HTTP Request 는 `output.response`·`output.responseHeaders`, Database Query 는 `output.rows`·`output.rowCount`·`output.insertId?`, Send Email 은 `output.messageId`, Cafe24·MakeShop 은 `output.response`. 실패하면 `output.error.{code, message, details?}` (Principle 3.2) |
| `meta` | 실행 메트릭만 둔다(Principle 2). 공통은 `meta.durationMs`. HTTP Request·Cafe24·MakeShop 은 `meta.statusCode` 도 둔다. Database Query 의 `rowCount` 는 `output` 에만 두고 `meta` 에 복제하지 않는다. Send Email 은 두 곳이 다르다. `meta.deliveryStatus` 를 더 싣는다. dry-run 출력에는 `meta.durationMs` 가 없다. 근거는 [Send Email 노드 Rationale 「`meta` 가 공통 규칙과 다른 두 곳」](CLE-NODE-EMAIL.md#meta-가-공통-규칙과-다른-두-곳-2026-11-13) 에 있다. dry-run 출력에 `meta.durationMs` 를 채우는 일은 NERV Task `CLE-T-22PSME` 가 맡는다 |
| `port` | 성공 포트 또는 `'error'`. 성공 포트 이름은 노드마다 다르다. HTTP Request·Database Query·Cafe24·MakeShop 은 `success`, Send Email 은 `out` 이다 |
| `status` | 비워 둔다(비블로킹). 예외: Send Email 노드는 서비스가 주입되지 않은 환경에서 `requires_integration` 을 돌려준다 |

## 핸들러 실행 계약

→ [통합 노드 공통 — 핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md)

### IntegrationsService API (실행 엔진용)

→ [통합 노드 공통 — 핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md#integrationsservice-api-실행-엔진용)

### IntegrationHandlerBase

→ [통합 노드 공통 — 핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md#integrationhandlerbase)

## 공통 에러 코드

→ [통합 노드 공통 — 에러 코드와 사설망 차단](CLE-NODE-INT-COMMON-ERROR.md#공통-에러-코드)

### 노드별 코드 색인

→ [통합 노드 공통 — 에러 코드와 사설망 차단](CLE-NODE-INT-COMMON-ERROR.md#노드별-코드-색인)

## 사설망 차단

→ [통합 노드 공통 — 에러 코드와 사설망 차단](CLE-NODE-INT-COMMON-ERROR.md#사설망-차단)

## 캔버스 요약

캔버스 요약은 노드 스키마의 `summaryTemplate`(백엔드 단일 기준)을 프론트엔드가 `renderSummaryTemplate` 으로 렌더한 한 줄이다. `truncateSummary` 가 렌더된 줄 전체를 **40자**로 자르고, 넘치면 마지막 1자를 `…` 로 바꾼다. 노드별 부분 필드를 따로 자르지 않는다(`codebase/frontend/src/lib/utils/node-config-summary.ts`). 잘림 규칙 자체는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)와 같다.

| 노드 | 요약 포맷 | 예시 | 상태 |
|------|-----------|------|------|
| HTTP Request | `{{method\|default:GET}} {{url}}` | `GET https://api.example.com/v1/users…` | 구현됨 (`http-request.schema.ts`) |
| Cafe24 | `{{resource}} · {{operation}}` | `product · product_list` | 구현됨 (`cafe24.schema.ts`) |
| MakeShop | `{{resource}} · {{operation}}` | `product · get-product` | 구현됨 (`makeshop.schema.ts`) |
| Database Query | `{{queryType\|upper}} · {{query}}` | `SELECT · SELECT * FROM us…` | 구현됨 (`database-query.schema.ts`) |
| Send Email | `{{to.length}} recipients · {{subject}}` | `2 recipients · Welcome` | 구현됨 (`send-email.schema.ts`) |

예시 끝의 `…` 는 잘린 모양을 보이려는 표시다. 예시의 글자 수는 실제와 다르다. 실제로는 렌더된 줄이 40자를 넘으면 앞 39자 뒤에 `…` 를 붙여 40자로 만든다.

### 삭제된 통합 표시

통합 노드(`category: integration`)의 `config.integrationId` 가 현재 워크스페이스 통합 목록에 없으면(참조하던 통합이 삭제됨) 캔버스 노드 헤더에 앰버색 `⚠ Missing integration` 배지를 붙인다.

- 캔버스(`workflow-canvas.tsx`)가 워크스페이스 통합 목록을 React Query 로 한 번 조회한다. 키는 캔버스 전용 `["integrations","list"]` 로, 서비스 유형 필터 없이 전체 목록을 받는다. 설정 패널 선택기의 `["integrations","list",{serviceTypes}]` 키와 다르다.
- 캔버스는 실재하는 id 집합을 Context 로 내려 준다. 각 노드 렌더러(`custom-node.tsx`)가 자기 `config.integrationId` 가 집합에 있는지(`Set.has(id)`) 확인한다.
- 목록이 아직 확정되지 않았으면(로딩 중이거나 페이지네이션 한도로 전체를 받지 못함) 배지를 억제한다. 위양성을 막기 위해서다.
- 목록이 확정되지 않았으면 에디터의 붙여넣기와 복제도 통합 참조를 비우지 않는다([에디터 §노드 조작](../CLE-WF/CLE-WF-EDITOR.md#노드-조작)). 남은 참조가 쓸 수 없는 통합이면 저장 검사가 400 으로 막는다.
- `integrationId` 가 비어 있으면(미선택) 이 배지 대신 각 노드 스키마의 `warningRules`(필드 미선택 경고)가 표시된다. 복제·가져오기·버전 복원·붙여넣기가 비운 참조도 미선택이라 이 배지가 아니라 필드 미선택 경고가 붙는다.
- 워크플로우 작성자가 아닌 사용자에게는 워크플로우 작성자의 개인 통합이 통합 목록에 없다. 그래서 그 노드에도 이 배지가 붙는다. 통합이 지워진 것은 아니고 노드는 실행된다. 워크플로우 작성자에게는 배지가 붙지 않는다. 이 화면 차이는 받아들인 잔여다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 「개인 통합의 역할 하한과 노드 사용 기준을 정한다」).
- 멤버가 나가거나 제거되면 그 사람의 개인 통합은 사용처와 관계없이 지워진다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29) 의 «나간 멤버의 개인 통합을 지운다» 요구사항, REQ-INTMGMT-065). 그 통합을 참조하던 노드에는 이 배지가 붙는다. 실제로 지워진 통합이라 모든 사용자에게 같다.
- HTTP Request 노드의 `integrationId` 는 `authentication === "integration"` 일 때만 유효하다. 다른 인증 방식에 남은 값에는 배지를 붙이지 않는다. 나머지 통합 노드에는 조건 없이 적용한다.
- 시각적으로는 캔버스의 `⚠ Missing workflow` 배지와 같은 앰버 계열이다. 그래프 경고 배지(`AlertTriangle`)와 겹쳐 보이지 않도록 연결 끊김 아이콘(`Unplug`)과 별도 슬롯에 렌더한다.
- 백엔드와 `warningRules` DSL 은 바꾸지 않았다.

## 출력 구조 색인

다섯 노드 모두 에러 경로는 하나(`port: 'error'` + `output.error.*`)다.

| 노드 | 정상 케이스 | 에러 케이스 |
|------|-------------|-------------|
| [HTTP Request](CLE-NODE-HTTP.md) | 2xx 성공 (`success`) | 4xx·5xx, 전송 실패, 통합 해소 실패, 사설망 차단 (`error`) |
| [Database Query](CLE-NODE-DBQUERY.md) | 정상 실행 (`success`) | 드라이버 에러, 통합 해소 실패, 자격 증명 누락, 잘못된 파라미터 (`error`) |
| [Send Email](CLE-NODE-EMAIL.md) | 발송 성공 (`out`) | 수신자 없음, 전송 실패, 통합 해소 실패, 사설망 차단 (`error`) |
| [Cafe24](CLE-NODE-CAFE24.md) | 2xx 성공 (`success`) | API 호출 실패, 리소스·operation 검증, `mall_id` 누락, 통합 해소 실패 (`error`) |
| [MakeShop](CLE-NODE-MAKESHOP.md) | 2xx 성공 (`success`) | API 호출 실패, 리소스·operation 검증, `shop_uid` 누락·형식 위반, 통합 해소 실패 (`error`) |

## 미결 사항

- **워크스페이스 누락 시 출력 코드**: 이 문서와 [HTTP Request 노드](CLE-NODE-HTTP.md)·[Cafe24 노드](CLE-NODE-CAFE24.md)·[MakeShop 노드](CLE-NODE-MAKESHOP.md) 원문은 `__workspaceId` 누락을 `INTEGRATION_SERVICE_UNAVAILABLE` 로 내보낸다고 적는다. [Send Email 노드](CLE-NODE-EMAIL.md) 원문은 이 경우를 `EMAIL_SEND_FAILED` 로 흡수한다고 적고 전용 코드 노출을 Planned 로 둔다. 현재 구현은 공통 베이스가 일반 `Error` 를 던져 다른 노드에서도 `INTEGRATION_CALL_FAILED`(Database Query 는 드라이버 에러 분류 결과)가 나오는 것으로 보인다. 구현을 규칙에 맞출지, 규칙을 현재 동작에 맞출지 결정 필요.
- **사설망 차단 원본 상세를 남기는 위치**: [Database Query 노드](CLE-NODE-DBQUERY.md) 원문은 차단 상세(원본 호스트)가 활동 로그(`logUsage`)에만 남는다고 적고, 이를 "서버 활동 로그" 라고 부른다. [HTTP Request 노드](CLE-NODE-HTTP.md) 원문은 활동 로그가 `GET /integrations/:id/activity` 로 워크스페이스 사용자에게 그대로 나가므로 활동 로그에도 일반화 문구만 남기고 원본은 서버 로그(`logger.warn`)에만 둔다고 적는다. 같은 정찰 방지 원칙을 두 노드가 반대로 적용한다. 현재 구현은 Database Query 핸들러가 일반화 문구만 담은 `IntegrationError('DB_HOST_BLOCKED')` 를 만들고 원본을 `cause` 로도 싣지 않는 것으로 보인다(활동 로그에 원본이 남는지는 미확인). 어느 쪽을 규칙으로 삼을지 결정 필요.
- **자격 증명 복호화 실패의 출력 코드**: 암호화 키 교체 등으로 자격 증명을 복호화할 수 없으면 `getForExecution` 이 `IntegrationCredentialsUnreadableError` 를 던진다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). 이 경로가 어떤 `output.error.code` 로 나오는지 원문에 없다. 현재 구현의 이 예외는 `BadRequestException` 계열이라 `IntegrationError` 가 아니므로 기본 규칙대로 `INTEGRATION_CALL_FAILED`(Send Email 은 `EMAIL_SEND_FAILED`)로 나올 것으로 보이나 확인되지 않았다. 공통 에러 코드 표에 행을 둘지 결정 필요.
- **통합 자격 증명 암호화와 시크릿 저장소의 관계**: 통합 노드는 자격 증명을 컬럼 transformer 로 직접 복호화한다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)는 모든 도메인 모듈이 `SecretResolver` 를 거친다고 정하면서 예외 목록에 `Integration.credentials` 를 두지 않았다. 예외로 등재할지 이관할지 결정 필요(관련: [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)).
- **워크플로우 작성자가 아닌 사용자에게 보이는 배지 문구**: 캔버스는 워크플로우 작성자의 개인 통합과 지워진 통합을 구분하지 못해 둘 다 `⚠ Missing integration` 으로 보인다. 지금 사용자가 워크플로우 작성자가 아닐 때는 «확인할 수 없는 통합» 처럼 삭제로 읽히지 않는 문구를 쓸지 정해야 한다(2026-10-24).

## 하위 문서

| 하위 문서 | 맡는 내용 | 요구사항 |
|-----------|-----------|----------|
| [통합 노드 공통 — 핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md) | 6단계 계약, `IntegrationsService` API(`getForExecution` 의 `use` 인자, `logUsage`), `IntegrationHandlerBase`, 호출 순서, 서비스 미주입과 워크스페이스 누락 | 없음(따르는 외부 요구사항: REQ-INTMGMT-053 · REQ-INTMGMT-055 · REQ-INTMGMT-059, REQ-EXPR-008, «매 호출 활동 로그» 범위의 REQ-CAFENODE-031 · REQ-DBQ-027 · REQ-EMAIL-024 · REQ-HTTP-029 · REQ-MKSNODE-029) |
| [통합 노드 공통 — 에러 코드와 사설망 차단](CLE-NODE-INT-COMMON-ERROR.md) | 공통 에러 코드, 통합을 얻기 전 실패의 기록 규칙, 노드별 코드 색인, 사설망 차단 | 없음(따르는 외부 요구사항: REQ-INTMGMT-052 · REQ-INTMGMT-053 · REQ-INTMGMT-062) |

## 구현 위치

백엔드(공통 베이스 · 노드별 핸들러 · `IntegrationsService` · 개인 통합 사용 판정)는 [핸들러 실행 계약 「구현 위치」](CLE-NODE-INT-COMMON-HANDLER.md#구현-위치) 에 있다.

- `codebase/frontend/src/lib/utils/node-config-summary.ts` (캔버스 요약 렌더·잘림)
- `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (삭제된 통합 배지 판정)
- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (통합 목록 단일 조회)
- `codebase/frontend/src/components/editor/canvas/integration-list-context.ts` (실재 id 집합 Context)

## Rationale

### 핸들러 실패를 에러 포트로 통일 (2026-05-17)

이 결정 전에는 `resolveIntegration` 의 `IntegrationError` 와 환경 에러가 throw 돼 노드 실행 자체가 실패했다. 서비스 미주입도 throw 였다. 이 결정으로 그 경로를 폐기하고, `execute()` 안의 모든 실패를 Send Email 노드가 먼저 쓰던 catch 패턴(에러 포트 + `output.error`)으로 모았다. 설정 형식 자체가 잘못된 경우(`handler.validate()` 실패)만 throw 로 남는다. 실행 엔진 문서의 "workspace 누락 시 `Missing workspace context` throw", "모든 핸들러가 미주입 시 `requires_integration` stub 반환" 서술은 이 결정 전 상태라 이 문서의 현행 규칙으로 대체했다.

그 뒤 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md#취소-에러-분류) 규칙이 상위 취소 신호로 생긴 `AbortError` 를 이 통일의 예외로 두었다. 이 문서는 2026-11-13 에 그 예외를 규칙 6 에 적었다.

### 시간 메트릭을 `meta.durationMs` 로 통일

HTTP Request 노드만 `meta.duration` 을 쓰고 나머지 노드와 시스템 문서는 `meta.durationMs` 를 썼다. 단위(ms)가 이름에 드러나는 `meta.durationMs` 로 통일했다. `http_request` 의 `meta.duration` 은 폐지했고, `$node["X"].meta.duration` 을 참조하던 워크플로우는 고쳐야 하는 breaking change 였다.

### 삭제된 통합 표시를 렌더러 전용 판정으로 둔 이유

노드 스키마 경고 규칙의 `when` DSL 평가기(`node-summary` 의 `evaluateWhen(expr, config)`)는 노드 자신의 config 만 받는다. 그래서 통합이 실재하는지 같은 교차 엔티티 검증을 할 수 없다. 기존 통합 노드 규칙의 `!integrationId` 는 "필드 미선택" 만 본다. 그래서 이 판정은 캔버스 렌더러가 맡는다.

목록 조회를 캔버스 한 곳으로 올린 것은 노드마다 `useQuery` 를 구독하면 N개 노드에 N개 구독과 리렌더가 생기기 때문이다. AI 노드의 `hasDefaultLlmConfig` Context 와 같은 패턴이다. 판정 로직(`Set.has(id)`)은 설정 패널의 `integration-selector`·`mcp-server-selector` 가 쓰는 것과 같다. 다만 선택기는 패널이 열린 노드 하나에만 마운트되고 이 배지는 캔버스의 모든 통합 노드에 동시에 붙으므로, 개수 차이 때문에 Context 로 올렸다. 교차 엔티티 경고가 앞으로 많아지면 경고 규칙 DSL 이 노드 설정 밖의 엔티티(통합 목록 등)를 조회할 수 있게 일반화하는 방안을 다시 검토한다.

이 배지는 방어용 표시다. 정상 UI 삭제 경로는 사용처가 있는 통합의 삭제를 막는다(409 `INTEGRATION_IN_USE`, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). 그래서 "캔버스의 라이브 노드가 참조하는데 통합이 없는" 상태는 평소에 생기지 않는다. 삭제 차단의 사용처 조회(`queryUsageNodes`)는 라이브 `Node` 테이블만 보고 과거 버전 스냅샷, 워크스페이스 이동, 레거시·직접 DB 조작은 보지 않는다. 배지는 이 틈으로 남은 잔존 참조(dangling reference)를 드러낸다.

2026-10-24 부터는 정상 경로에서도 배지가 붙는 경우가 생겼다(워크플로우 작성자가 아닌 사용자가 보는 작성자의 개인 통합 노드). 남의 개인 통합이 있다는 것을 드러내지 않으려고 받아들인 위양성이다. 근거는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 「개인 통합의 역할 하한과 노드 사용 기준을 정한다」 에 있다. 이 경우의 배지 문구를 따로 둘지는 [미결 사항](#미결-사항) 에 있다.

2026-10-29 부터는 두 번째 경우(나간 멤버의 개인 통합 삭제)가 생겼다. 사용처 때문에 남기면 아무도 정리할 수 없는 행이 남아서다. 그 노드는 그 전부터 실행에서 실패했으므로 배지가 실행 결과와 맞는다. 근거는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29) 에 있다.

비운 참조에는 이 배지를 쓰지 않는다. 값이 비었으니 미선택과 같고 사용자가 다시 골라야 한다는 점도 같다. 배지는 값이 남아 있는데 목록에 없는 경우만 뜻한다.

### 캔버스 요약을 줄인 이유

Database Query 의 "쿼리 첫 줄" 과 Send Email 의 "to: {수신자} +N" 은 `summaryTemplate` DSL 이 개행 분리·배열 슬라이스·조건 카운트를 지원하지 않아 표현할 수 없다. 그래서 각각 전체 쿼리를 잘라 보이는 `{{query}}` 와 수신자 수 + 제목(`{{to.length}} recipients · {{subject}}`)으로 줄였다([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 템플릿 문법).

### 사설망 허용 플래그 하나를 세 노드가 공유

→ [에러 코드와 사설망 차단 Rationale](CLE-NODE-INT-COMMON-ERROR.md#사설망-허용-플래그-하나를-세-노드가-공유)

### 차단 코드를 판정에만 쓰는 이유

→ [에러 코드와 사설망 차단 Rationale](CLE-NODE-INT-COMMON-ERROR.md#차단-코드를-판정에만-쓰는-이유)

### 남의 개인 통합 조회는 없는 통합과 같게 실패한다 (2026-10-24)

→ [핸들러 실행 계약 Rationale](CLE-NODE-INT-COMMON-HANDLER.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24)

### 거절된 조회는 임시 장치로 건너뛴다 (2026-10-25)

→ [에러 코드와 사설망 차단 Rationale](CLE-NODE-INT-COMMON-ERROR.md#거절된-조회는-임시-장치로-건너뛴다-2026-10-25)

### 자격 증명을 읽지 못한 통합은 얻지 못한 통합으로 본다 (2026-11-05)

→ [에러 코드와 사설망 차단 Rationale](CLE-NODE-INT-COMMON-ERROR.md#자격-증명을-읽지-못한-통합은-얻지-못한-통합으로-본다-2026-11-05)

### 표현식 여부를 확인하지 못하면 표현식으로 본다 (2026-10-25)

→ [핸들러 실행 계약 Rationale](CLE-NODE-INT-COMMON-HANDLER.md#표현식-여부를-확인하지-못하면-표현식으로-본다-2026-10-25)

### 통합을 얻는 단계와 검증하는 단계를 나눈다 (2026-10-25)

→ [핸들러 실행 계약 Rationale](CLE-NODE-INT-COMMON-HANDLER.md#통합을-얻는-단계와-검증하는-단계를-나눈다-2026-10-25)
