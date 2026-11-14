---
id: "CLE-PLAT-DATA-INTREF"
title: "데이터 모델 개요 — 노드의 통합 참조"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT-DATA"
ancestors: ["CLE-VISION", "CLE-PLAT", "CLE-PLAT-DATA"]
area: "CLE-PLAT"
content_hash: "430356954a2b8878f0b60ad9db20bdcb2e6284428b311d157225f6fa838bddae"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "f16fd4b6a26fc6d5a30cf5db3b75b11d2e0e3f528789742b58ad6442a73a80ed"
etag: "sha256-dcd6ab57d0b089ca06c8ece8f72003a7691345587e6de900f5e066b4b1566fe1"
---
## 개요

이 문서는 [데이터 모델 개요](CLE-PLAT-DATA.md) 의 하위 문서로 노드 JSONB `config` 안에 저장되는 통합 참조의 위치 목록, 참조 값의 판정 규칙, 경로별 거절 · 비우기를 정한다. 컬럼에 저장되는 참조 id 의 규칙은 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 이 정한다.

## 통합 참조

노드 `config` 안의 통합 참조는 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 표의 다른 참조와 다르다. 이 절은 [용어 사전](../CLE-GLOSSARY-WS.md) 의 「참조의 소속」(요청 본문으로 받아 컬럼에 저장하는 참조)을 노드 JSONB `config` 안에 저장하는 통합 참조로 넓힌다. JSONB 안의 값이라 DB 제약이 없고, 어긴 참조는 경로에 따라 거절하거나 비운다.

통합 참조의 위치는 이 목록 하나가 정한다. 저장 검사와 참조 비우기는 이 목록의 자리만 보고 백엔드는 참조를 꺼내는 코드를 한 곳(`codebase/backend/src/modules/integrations/node-integration-refs.ts`)에 둔다. 다른 문서는 위치를 다시 적지 않고 이 목록을 링크한다. 노드가 통합을 참조하는 자리가 새로 생기면 이 목록에 더한다.

이 목록은 손으로 관리하므로 테스트 셋으로 지킨다.

- 노드 스키마에서 `integration-selector`·`mcp-server-selector` 위젯이 붙은 필드가 이 목록의 자리와 같다. 백엔드 `node-integration-refs.spec.ts` 가 노드 스키마의 위젯 표시와 백엔드 목록(`INTEGRATION_ID_REF_NODE_TYPES` · `MCP_SERVER_REF_NODE_TYPES`)을 맞춰 본다.
- 에디터의 사본(`codebase/frontend/src/lib/integrations/node-integration-refs.ts`)의 노드 유형 목록 두 개가 백엔드 목록과 같다. 두 패키지가 함께 쓰는 모듈이 없어서 같은 spec 의 「통합 참조 목록 ↔ 프런트엔드 사본」 이 프런트엔드 파일의 `new Set([...])` 리터럴을 읽어 맞춰 본다.
- 노드 `config` 를 쓰는 저장소 호출 지점이 아래 경로(노드 생성·수정, 캔버스 저장, 복제, 가져오기, 버전 복원)뿐이다(허용 목록). 가드 `node-row-writers-guard.ts` 와 그 테스트 `node-row-writers.spec.ts`(`codebase/backend/src/repo-guards/__tests__/`)가 지킨다.
- 경로마다 거절이나 비우기를 e2e 로 확인한다(`codebase/backend/test/integration-personal-use.e2e-spec.ts`).

| 위치 | 노드 | 조건 | 비울 때 |
| --- | --- | --- | --- |
| `config.integrationId` | 통합 노드(`send_email`·`database_query`·`http_request`·`cafe24`·`makeshop`) | `http_request` 는 `authentication='integration'` 일 때만 본다 | 키를 지워 고르지 않은 노드와 같게 둔다 |
| `config.mcpServers[].integrationId` | AI 에이전트 노드 | 항목마다 본다 | 그 항목을 뺀다. 그 서버에 붙은 노출 도구 목록과 토글도 함께 빠진다 |

- 컬럼이 아니라 JSONB(`node.config`) 안에 있다. 그래서 복합 FK 가 없고 [범위 참조의 DB 제약](CLE-PLAT-DATA-FK.md#범위-참조의-db-제약) 의 열일곱에 들지 않는다. 저장 시점 검사가 저장 쪽의 유일한 방어선이다. 새 쓰기 경로가 이 검사를 빠뜨리면 실행 시점 조회(`IntegrationsService.getForExecution`)는 워크플로우 작성자·멤버십·표현식 조건만 다시 본다([통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)). 저장자 조건은 저장 경로에서만 지켜지므로 통합 참조를 쓰는 쓰기 경로는 모두 이 검사를 거친다.
- 개인 통합에는 워크스페이스에 더해 [개인 통합 사용 판정](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)이 붙는다. 저장 경로에서는 저장자(요청 사용자)와 워크플로우 작성자(`workflow.created_by`)가 둘 다 통합 소유자(`integration.created_by`)여야 한다. 조직 통합은 워크스페이스만 본다.
- HTTP Request 노드의 `config.integrationId` 는 `authentication='integration'` 일 때만 본다. `authentication` 이 다른 값일 때 남은 `integrationId` 는 실행에 쓰이지 않으므로 검사하지도 비우지도 않는다. `authentication` 을 `integration` 으로 바꾸면 남아 있던 값이 그때부터 쓰이므로 바뀐 참조로 본다.
- 새로 넣거나 바꾼 참조만 본다. 비교 대상은 같은 id 로 이미 저장된 노드다. `config.integrationId` 는 값이 다르면 바뀐 참조다. `config.mcpServers` 는 항목들의 `integrationId` 집합을 비교하고 순서는 보지 않는다. 저장된 집합에 없던 id 만 검사한다. 저장된 노드가 없는 노드(새 노드)는 모든 참조가 새 참조다. 문자열이 아닌 값도 그 값 그대로 견준다.
- 참조 값이 표현식(`{{ }}`)이면 저장할 때는 어떤 통합인지 알 수 없다. 그래서 저장 검사도 비우기도 그 값을 판정하지 않는다. 실행 시점 조회는 그 값이 조직 통합일 때만 쓰고 개인 통합이면 판정을 통과하지 못한 것으로 본다.
- 참조 값의 모양은 다음 규칙을 따른다. 저장 검사, 복제 · 가져오기 · 버전 복원의 비우기, 에디터의 붙여넣기 · 복제가 같은 규칙을 쓴다.
  - 고르지 않은 자리(키가 없음, `null`, 빈 문자열)는 참조가 아니다. 판정하지 않고 그대로 둔다.
  - 문자열이 아닌 값(숫자 · 객체 · 배열 등)은 어느 통합도 가리키지 못한다. 없는 통합과 같이 다룬다. 노드 생성 · 수정과 캔버스 저장은 거절하고 복제 · 가져오기 · 버전 복원과 에디터 붙여넣기 · 복제는 비운다. 거절 응답은 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 의 거부 응답(400 `VALIDATION_ERROR`, `details[].code='INVALID_FIELD'`)이고 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 `VALIDATION_ERROR` 행이 이 경우를 덮는다.
  - 표현식이 아닌 문자열 가운데 UUID 모양이 아닌 값도 없는 통합과 같다. 서버는 그 값을 통합 조회 쿼리에 넣지 않는다.
  - 자리를 담는 그릇의 모양이 틀리면 그 자리를 판정하지 않는다. `config` 가 객체가 아니거나, `mcpServers` 가 배열이 아니거나(목록 자체가 표현식인 경우 포함), `mcpServers` 의 항목이 객체가 아니면 그렇다.

통합 참조를 어긴 요청의 처리는 경로마다 다르다.

- 노드 생성·수정과 캔버스 저장은 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 의 거부 응답(400 `VALIDATION_ERROR`, `INVALID_FIELD`)으로 거절한다. 어시스턴트의 편집은 서버에 따로 쓰지 않고 에디터 상태에 들어간 뒤 캔버스 저장으로 저장되므로 같은 검사를 받는다. `field` 는 위 목록의 자리에 배열 첨자를 채운 경로다. 캔버스 저장은 앞에 `nodes[i].` 를 붙인다(예: `nodes[i].config.mcpServers[j].integrationId`). 없는 통합, 다른 워크스페이스 통합, 남의 개인 통합을 구분하지 않는다.
- 복제·가져오기·버전 복원은 거절하지 않는다. 걸리는 참조를 위 목록의 «비울 때» 대로 비우고 작업을 끝낸다.
- 비운 참조는 응답 `data` 의 `clearedIntegrationRefs: [{ nodeId, nodeLabel, field }]` 로 알린다. `data` 는 작업 결과(복제·가져오기는 새 워크플로우, 버전 복원은 `{ workflow, nodes, edges }`)에 이 필드를 더한 것이고 응답 봉투는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 5 를 따른다. 이 필드는 세 작업의 응답에만 있고 워크플로우 조회 응답에는 없다. `nodeId` 는 작업 뒤 노드의 id 이고 `field` 는 그 노드 안의 경로(위 목록의 자리에 첨자를 채운 것이고 `j` 는 비우기 전 순서)다. 비운 것이 없으면 빈 배열이다. 비운 이유는 싣지 않는다. 이유를 실으면 없는 통합과 남의 개인 통합이 구분된다.
- OpenAPI 에서는 세 작업이 각자 전용 응답 DTO(`DuplicateWorkflowResultDto` · `ImportWorkflowResultDto` · `RestoreVersionResultDto`, `workflow-response.dto.ts`)를 두고 `clearedIntegrationRefs` 를 늘 있는 배열로 선언한다. DTO 설명에는 이 `field` 가 노드 안의 상대 경로라서 400 `VALIDATION_ERROR` 의 `details[].field`(캔버스 저장은 `nodes[i].` 로 시작한다)와 기준이 다르다고 적는다.
- 복제와 가져오기에서는 요청 사용자가 새 워크플로우의 작성자이자 저장자다. 그래서 요청 사용자 자신의 개인 통합 참조만 남고 남의 개인 통합 참조는 모두 비워진다.
- 버전 복원은 워크플로우 작성자가 그대로이고 저장자 조건을 보지 않는다. 실행 시점 판정과 같이 워크플로우 작성자가 통합 소유자인지와 통합 소유자가 지금 워크스페이스 멤버인지만 본다. 그래서 워크플로우 작성자가 아닌 사용자가 복원해도 워크플로우 작성자의 개인 통합 참조는 남는다. 비우는 대상은 지금 노드와 다른 참조 가운데 실행하면 실패할 것뿐이다. 없는 통합, 다른 워크스페이스 통합, 위 두 조건을 통과하지 못한 개인 통합이 해당한다. 표현식 참조는 위처럼 판정하지 않고 둔다.

## 구현 위치

- `codebase/backend/src/modules/integrations/node-integration-refs.ts` (참조 목록 `INTEGRATION_ID_REF_NODE_TYPES` · `MCP_SERVER_REF_NODE_TYPES`, 꺼내기 `extractNodeIntegrationRefs`, 바뀐 참조 `changedNodeIntegrationRefs`, 비우기 `clearNodeIntegrationRefs`, 참조 값 모양 판정 `refAt`)
- `codebase/backend/src/modules/integrations/node-integration-ref-check.ts` (저장 검사 `assertNodeIntegrationRefsUsable`, 복제 · 가져오기 · 복원의 비우기 `clearUnusableNodeIntegrationRefs`)
- `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (`clearedIntegrationRefs` 를 싣는 응답 DTO 셋)
- `codebase/frontend/src/lib/integrations/node-integration-refs.ts` (에디터 쪽 사본과 붙여넣기 · 복제의 비우기)
- 통합 참조 목록을 지키는 테스트: `codebase/backend/src/modules/integrations/node-integration-refs.spec.ts` (노드 스키마 위젯 대조, 「통합 참조 목록 ↔ 프런트엔드 사본」), `codebase/backend/src/repo-guards/__tests__/node-row-writers-guard.ts` · `node-row-writers.spec.ts` (노드 `config` 를 쓰는 지점의 허용 목록)
- 경로별 거절 · 비우기 e2e(`integration-personal-use`)는 [데이터 모델 개요 「구현 위치」](CLE-PLAT-DATA.md#구현-위치) 에 있다.

## Rationale

### 노드의 통합 참조는 저장할 때 보고 복제·가져오기·복원은 비운다 (2026-10-24)

노드 `config.integrationId`·`config.mcpServers[].integrationId` 는 2026-09-27 의 본문 참조 검사에 들지 않았다. 그때 표는 컬럼에 저장되는 참조 id 만 대상으로 했다. 노드 `config` 같은 JSONB 안의 id 참조는 다루지 않았다. 2026-10-24 에 개인 통합의 노드 사용 기준을 워크플로우 작성자로 정하면서([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale) 저장 경로에도 검사를 두기로 했다(2026-10-24 사용자 결정). 실행 시점에만 막으면 사용자는 실행해 보기 전까지 노드가 깨진 줄 모른다.

- **표에 통합 참조 행을 더했지만 DB 제약은 없다.** JSONB 안의 값이라 복합 FK 를 걸 수 없다. 노드 `config` 를 정규화해 참조 테이블로 빼는 안은 노드 설정 전체의 저장 모양을 바꾸므로 이 결정의 범위를 넘는다.
- **바꾼 참조만 본다.** 모든 참조를 보면 워크플로우 작성자가 아닌 사용자는 워크플로우 작성자의 개인 통합이 든 노드를 저장하지 못한다. 캔버스 저장은 노드 전체를 보내므로 그 노드를 건드리지 않아도 막힌다.
- **복제·가져오기·버전 복원은 거절하지 않고 비운다.** 셋은 여러 노드를 한꺼번에 만드는 작업이다. 참조 하나 때문에 전체를 거절하면 사용자가 고칠 방법이 없다. 복제와 가져오기는 원본을 고칠 수 없다. 버전 복원은 옛 상태를 고칠 수 없다. 비우면 작업은 끝나고 사용자는 비워진 노드에서 통합을 다시 고른다. 버전 복원을 같게 할지는 결정 때 초안에서 정하기로 남겼다. 같은 이유로 같게 정했다.
- **버전 복원은 실행 시점 판정으로만 비운다.** 규칙은 위 「통합 참조」 가 정하고 근거는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 «버전 복원은 실행 시점 판정으로만 참조를 비운다» 에 있다.
- **표현식 참조는 실행 시점에 조직 통합만 쓴다.** 저장 검사가 표현식을 풀 수 없으므로 실행 시점 판정이 저장 검사보다 약하면 표현식이 우회로가 된다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 «표현식으로 정한 통합 참조는 조직 통합만 쓴다»).
- **참조 위치를 이 문서의 목록 하나에 둔다.** 승인본은 위치를 문서마다 적어 하나를 바꾸면 나머지가 어긋났다. 노드 스키마의 위젯 표시에서 위치를 끌어내는 안을 쓰지 않은 이유는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 기각한 안에 있다.
  - 2026-10-24 승인본은 이 안을 «모든 노드 스키마와 위젯 메타를 바꿔야 한다» 는 이유로 뺐다. 위젯 표시는 이미 있으므로 그 이유는 사실과 달랐다.
  - 목록을 손으로 관리하면 새 노드나 새 쓰기 경로가 목록에서 빠지기 쉽다. 그래서 위젯 표시와 목록이 같은지, 노드 `config` 를 쓰는 경로가 목록에 오른 경로뿐인지를 테스트로 확인한다.
- **비우는 대상에 없는 통합과 다른 워크스페이스 통합도 넣는다.** 남의 개인 통합만 비우고 없는 통합은 남기면 결과만 보고 그 ID 가 남의 개인 통합이었는지 알 수 있다. 그래서 세 경우를 같게 다룬다. 지금까지 가져오기는 없는 통합 ID 를 그대로 남겨 에디터가 `(missing)` 으로 보였는데 이제는 비운다.
  - 문자열이 아니거나 UUID 모양이 아닌 참조 값도 없는 통합과 같게 다룬다(2026-10-25). 그 값은 어느 통합도 가리키지 못하므로 실행하면 반드시 실패한다.
  - 기각한 안은 그 값을 비우지 않고 그대로 두는 것이다. 그대로 두면 그 노드는 실행할 때마다 실패한다. 노드 생성 · 수정과 캔버스 저장은 같은 값을 거절하므로 복제 · 가져오기 · 복원만 다른 기준을 쓰게 된다.
  - 키가 없거나 `null` · 빈 문자열인 자리는 참조로 보지 않는다. 비운 결과(키를 지운 모양)와 같은 상태라서 고르지 않은 노드로 본다.
  - 그릇의 모양이 틀린 자리(`mcpServers` 가 배열이 아닌 경우 등)는 판정하지 않는다. 항목을 알 수 없어 무엇을 비울지 정할 수 없기 때문이다. 그대로 남은 값이 실행에 쓰이면 실행 시점 판정([개인 통합 사용 판정](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정))이 다시 막는다. 목록 자체가 표현식이면 평가한 서버를 모두 표현식 참조로 보므로 개인 통합은 쓰이지 않는다.

받아들인 잔여:

- 통합 소유자가 워크스페이스를 떠난 뒤 버전을 복원하면 그 사람의 개인 통합 참조 가운데 지금 노드와 다른 것은 비워진다. 실행해도 실패할 참조라서다.
- 비울 때 MCP 서버 항목의 노출 도구 목록도 함께 사라진다. 그 목록은 그 통합에 묶인 설정이라 통합을 다시 고르면 다시 정해야 한다.
