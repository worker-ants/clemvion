# Spec: Integration 노드 공통 규약

> 관련 문서: [PRD Integration 노드](../../../prd/3-node-system.md#7-integration-노드-3종) · [PRD 통합/연동](../../../prd/4-integration.md) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 데이터 모델](../../1-data-model.md) · [Spec 실행 엔진 §10 Integration Handler 계약](../../5-system/4-execution-engine.md#10-integration-handler-계약)

본 문서는 Integration 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [HTTP Request](./1-http-request.md)
- [Database Query](./2-database-query.md)
- [Send Email](./3-send-email.md)

> **본 문서의 범위**: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 공통 규약을 다룬다. Integration 엔티티(`service_type='mcp'`)는 워크플로 노드로 노출되지 않고 AI Agent 노드 내부의 `mcpServers` 설정에서만 활용되며, 그 동작·도구 노출 모델은 [Spec MCP Client](../../5-system/11-mcp-client.md) 와 [Spec AI Agent](../3-ai/1-ai-agent.md) 에서 정의한다. 즉 Integration 엔티티는 (a) 본 문서의 노드와 (b) AI Agent MCP provider 두 가지 사용처를 가진다.

---

## 1. Integration 참조

모든 서비스 특화 Integration 노드는 `integrationId` 설정을 통해 Integration 엔티티([데이터 모델 §2.10](../../1-data-model.md#210-integration))에 저장된 인증 정보를 참조한다.

| 설정 필드 | 타입 | 설명 |
|-----------|------|------|
| integrationId | UUID | FK → Integration. 설정 UI에서 드롭다운으로 선택 |

## 2. Integration 선택 UI

- 노드 설정 패널 상단에 Integration 선택 드롭다운 표시
- 워크스페이스에 등록된 해당 서비스 타입의 Integration만 필터링하여 표시
- 개인/조직 Integration 구분 표시
- 연결 상태(connected/expired/error) 배지 표시
- "새 Integration 추가" 링크 → Integration 관리 화면으로 이동

## 3. 공통 출력 구조

모든 Integration 노드의 출력은 CONVENTIONS Principle 7 / §3 의 nested envelope 을 따른다 — `config` 는 워크플로 작성자가 입력한 raw 설정, `output` 은 평가 결과, `meta` 는 실행 메타데이터, `port` 는 포트 라우팅 (생략 시 success 계열 기본 포트).

```json
{
  "config": { /* 노드별 raw 설정 echo */ },
  "output": { /* 노드별 평가 결과 */ },
  "meta": { "statusCode": 200, "duration": 150 },
  "port": "success"
}
```

각 노드별 정확한 `config`·`output`·`meta` 필드 셋은 노드별 문서의 "출력 구조" 섹션에서 정의한다. `meta.duration` (HTTP) 과 `meta.durationMs` (Send Email) 등 노드별 필드 명명 차이는 노드 핸들러 도입 시점의 관용을 따르며, 향후 통일 작업이 필요하면 별도 PRD 로 다룬다.

---

## 4. Handler 실행 세멘틱

Integration 노드의 실제 외부 호출 책임은 Execution Engine의 핸들러가 진다. 모든 Integration 핸들러는 다음 공통 계약을 따른다 — 세부는 [Spec 실행 엔진 §10 Integration Handler 계약](../../5-system/4-execution-engine.md#10-integration-handler-계약) 참조.

### 4.1 공통 계약

| 단계 | 책임 |
|------|------|
| 1. 워크스페이스 확인 | `ExecutionContext.variables.__workspaceId` 조회. 없으면 즉시 오류 |
| 2. Integration 조회 | `IntegrationsService.getForExecution(integrationId, workspaceId)` 호출. credentials는 AES-256-GCM transformer로 자동 복호화됨 |
| 3. 타입/상태 검증 | `serviceType`이 노드 기대값과 일치 + `status === 'connected'` 검증 |
| 4. Credential 충족 검증 | 서비스별 필수 필드 누락 시 `INTEGRATION_INCOMPLETE` |
| 5. 외부 호출 | 서비스별 SDK/드라이버 호출 |
| 6. Usage 로깅 | 성공·실패 무관 `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?})` 호출 |

### 4.2 공통 에러 코드

| 코드 | 의미 |
|------|------|
| `INTEGRATION_NOT_FOUND` | integrationId가 존재하지 않거나 현재 워크스페이스에 속하지 않음 |
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration의 `serviceType`이 노드 기대 타입과 다름 |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected`가 아님(`expired`, `error`) |
| `INTEGRATION_INCOMPLETE` | credentials JSONB에 서비스별 필수 필드가 누락 |
| `INTEGRATION_CALL_FAILED` | 기타 일반 예외(분류되지 않은 실패) |

위 코드는 `IntegrationError(code, message)` 예외로 throw되며, 실행 엔진은 노드 실행을 실패 처리하고 동시에 Usage 로그에 `error.code`와 `error.message`를 기록한다.

---

## 5. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| HTTP Request | `{method} {url}` (URL 35자 초과 시 잘림) | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫 줄}` (잘림) | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}`. 수신자 2명 초과 시 `+N` 표시 | `to: user@exam..., +2` |

Integration 노드에서 연결된 Integration이 삭제된 경우 `⚠ Missing integration` (앰버색)을 표시한다.
