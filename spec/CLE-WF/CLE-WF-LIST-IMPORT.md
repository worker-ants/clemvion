---
id: "CLE-WF-LIST-IMPORT"
title: "워크플로우 목록 — 내보내기 · 가져오기 형식"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-LIST"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-LIST"]
area: "CLE-WF"
content_hash: "b8c4dc51549699813a2a393b30ac9f1d92dd9a67ef6ff9c08ccd7040838a5447"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4db7f9cc412f45aadd1f53116693773dfb0e9f296ed499e026ba3fb6f4644d75"
etag: "sha256-c3958c3f85776a416a1ad3de0224071c1e632be2c4e7309a2f0d1e69e98eab8e"
---
## 개요

이 문서는 [워크플로우 목록과 폴더](CLE-WF-LIST.md) 의 하위 문서로 내보내기 · 가져오기 JSON 형식, 가져오기의 검사 · 저장 순서, 가져오기 · 복제의 통합 참조 비우기와 경고를 정한다. 진입점과 API 경로 표는 부모 문서에 있다. 이 문서가 다루는 요구사항 줄과 본문 절의 대응은 부모 문서 「하위 문서」에 있다.

## 내보내기·가져오기 JSON 형식

사용자가 파일로 받아 손으로 고친 뒤 다시 가져올 수 있는 JSON 계약이다. 기준은 `import-workflow.dto.ts` 와 `ExportWorkflowDto` 다.

**내보내기**(`GET /api/workflows/:id/export`)의 최상위 키는 `name`, `description`, `tags`, `settings`, `nodes[]`, `edges[]` 다. 노드 사이 참조는 UUID 가 아니라 `nodes[]` 배열 인덱스로 적는다. 그래서 다른 환경으로 옮겨도 참조가 깨지지 않는다.

- 연결선: `sourceNodeIndex`·`targetNodeIndex`(와 `sourcePort`·`targetPort`·`type`·`condition`)
- 노드: `containerIndex`·`toolOwnerIndex`. 컨테이너 소속과 도구 소유 노드를 가리키고 없으면 `null` 이다. `toolOwnerIndex` 는 제거된 도구 영역 기능의 컬럼(`tool_owner_id`)을 옮기는 자리다.

Swagger 응답 DTO(`ExportWorkflowDto`)는 `formatVersion` 필드를 선언하지만 지금 내보내기는 이 필드를 싣지 않고 가져오기 DTO 도 받지 않는다. 형식 버전 협상은 미구현이다.

**가져오기**(`POST /api/workflows/import`)는 아래 순서로 검사하고 저장한다.

1. 노드 `type` 을 허용 노드 유형 목록(`@IsIn(ALL_NODE_TYPES)`)으로 DTO 검사한다. 모르는 유형이면 400 `VALIDATION_ERROR` 다.
2. 노드 레이블은 워크플로우 안에서 유일해야 한다. 겹치면 409 `DUPLICATE_NODE_LABEL` 이다.
3. 노드 `config` 를 그 노드의 zod 스키마로 parse 해 `.default(...)` 기본값을 덮어 채운다(`applyConfigDefaults`). 캔버스에서 노드를 새로 만들 때와 같은 기본값이다. parse 에 실패하면(손으로 고친 JSON, 타입 불일치 등) 원래 설정을 그대로 보존한다. 사용자는 에디터에서 그 노드를 고칠 수 있다([Rationale](#rationale) 1번). 보존한 설정의 통합 참조도 5단계에서 비운다.
4. AI 노드에 `llmConfigId` 가 없으면 워크스페이스 기본 모델 설정을 채운다.
5. 노드 `config` 의 통합 참조 가운데 이 워크스페이스에 없는 통합(지워진 통합 · 다른 워크스페이스의 통합)이나 요청 사용자가 통합 소유자가 아닌 개인 통합을 가리키는 것을 비운다. 그래서 다른 워크스페이스에서 내보낸 파일이면 조직 통합을 포함해 그 워크스페이스의 통합 ID 는 모두 비워진다. 3단계에서 parse 에 실패해 보존한 설정도 같은 위치에서 비운다. 고르지 않은 자리(키 없음 · `null` · 빈 문자열)는 대상이 아니다. 고르지 않은 자리가 아닌데 문자열도 아닌 값은 없는 통합과 같이 비우고 표현식 값은 판정하지 않고 둔다. 어떤 값이 참조인지는 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」 가 정한다. 거부하지 않는다([통합 참조 비우기](#통합-참조-비우기)). 응답에 싣는 비운 노드의 `nodeId` 는 6단계에서 발급한 id 다.
6. 인덱스 참조(`containerIndex`·`toolOwnerIndex`·`sourceNodeIndex`·`targetNodeIndex`)를 새로 발급한 UUID 로 바꿔 저장한다.
7. 워크플로우 `settings` 는 엄격한 중첩 DTO(`WorkflowSettingsDto`)로 검사한다. 지금 허용하는 키는 `maxConcurrentExecutions`(양의 정수, 워크플로우당 동시 실행 상한) 하나다. 모르는 키, 양수가 아닌 값, 정수가 아닌 값은 400 `VALIDATION_ERROR` 다. `UpdateWorkflowDto.settings`(PATCH)도 같은 규칙을 쓴다. 동시 실행 상한의 동작은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 에 있다.

가져오기 전체를 한 트랜잭션으로 저장하는 흐름은 [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) 에 있다.

## 통합 참조 비우기

가져오기와 복제는 노드 `config` 의 통합 참조에 같은 규칙을 각자 적용한다. 복제가 가져오기 경로를 거치지는 않는다.

- 요청 사용자가 새 워크플로우의 작성자이자 저장자다. 판정은 [통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)을 쓴다. 그래서 조직 통합과 요청 사용자 자신의 개인 통합 참조만 남는다. 없는 통합, 다른 워크스페이스 통합, 남의 개인 통합 참조는 비운다. 고르지 않은 자리가 아닌데 문자열도 아닌 값도 없는 통합과 같이 비운다. 응답은 어느 경우로 비웠는지 구분하지 않는다.
- 비우는 방법은 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 「통합 참조」 목록의 «비울 때» 를 따른다. 참조 값이 표현식이면 비우지 않는다.
- 응답 `data.clearedIntegrationRefs: [{ nodeId, nodeLabel, field }]` 로 알린다. `nodeId` 는 저장된 노드의 id 다(가져오기는 6단계에서 발급한 id). 비운 것이 없으면 빈 배열이다. 비운 이유는 싣지 않는다. 필드 표기와 규칙 전체는 [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」 가 정한다.
- 화면은 `data.clearedIntegrationRefs` 가 비어 있지 않으면 성공 토스트와 함께 경고 토스트를 하나 더 띄운다. 경고에는 비운 노드의 레이블을 적고 에디터에서 통합을 다시 고르라고 안내한다. 목록 화면의 복제와 가져오기(헤더 `⤓ Import`)가 같은 경고를 띄운다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/workflows/page.tsx` (복제 · 가져오기 성공 뒤 비운 통합 참조 경고 토스트)
- `codebase/frontend/src/lib/integrations/cleared-integration-refs.ts` (`clearedIntegrationRefs` 에서 경고에 적을 노드 레이블을 모은다)
- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`
- `codebase/backend/src/modules/integrations/node-integration-refs.ts`, `codebase/backend/src/modules/integrations/node-integration-ref-check.ts` (복제 · 가져오기의 통합 참조 비우기)
- `codebase/backend/test/integration-personal-use.e2e-spec.ts` (복제 · 가져오기가 쓸 수 없는 참조를 비우고 응답으로 알리는 e2e)

## Rationale

### 1. 가져오기에서 노드 설정은 느슨하게 받는다

가져오기 때 노드 `config` 의 스키마 parse 가 실패해도 거부하지 않고 원래 설정을 보존한다.

- 가져오기 JSON 은 사용자가 손으로 고칠 수 있는 파일이다. 사소한 타입 불일치로 가져오기 전체를 400 으로 거부하면 복구할 길이 없다. 노드 단위로 원래 값을 보존하면 사용자가 에디터에서 그 노드만 고쳐 복구할 수 있다.
- 노드 `type` 허용 목록과 레이블 유일성은 워크플로우 구조 자체의 무결성이다. 그래서 DTO 단계에서 400·409 로 거부한다. 설정 내용(느슨함)과 구조(엄격함)를 나눈 결정이다.
- `applyConfigDefaults` 가 모르는 노드 유형의 설정을 그대로 통과시키는 분기는 앞으로 올 유형에 대비한 방어 코드다. 실제로는 1단계 허용 목록 검사가 먼저 막는다.
- 워크플로우 `settings` 는 이 느슨한 예외에 들지 않는다. 느슨한 정책은 사용자가 손으로 고친 뒤 에디터에서 복구할 수 있는 노드 `config` 에만 쓴다. `settings.maxConcurrentExecutions` 는 동시 실행 상한이라 잘못된 값을 조용히 무시하면 상한 정책이 어긋난다. 그래서 쓰기 경계에서 엄격한 중첩 DTO(`WorkflowSettingsDto`)로 거부한다. 가져오기와 PATCH(`UpdateWorkflowDto`)가 같은 규칙을 쓰고 데이터 모델도 `Workflow.settings` 를 이 키로 한정한다(2026-07-04 결정).

### 2. 가져오기·복제는 쓸 수 없는 통합 참조를 비우고 경고한다 (2026-10-24)

개인 통합은 통합 소유자가 작성한 워크플로우에서만 쓰도록 정했다(2026-10-24 사용자 결정. 근거는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale). 가져오기와 복제로 만든 워크플로우의 작성자는 요청 사용자다. 그래서 다른 사람의 개인 통합을 가리키는 참조는 새 워크플로우에서 실행될 수 없다.

- **거부하지 않는 이유**: 1번과 같다. 파일이나 원본 워크플로우를 이 자리에서 고칠 수 없어 거부하면 복구할 길이 없다. 비우면 사용자는 에디터에서 그 노드의 통합만 다시 고른다.
- **값을 보존하지 않고 비우는 이유**: 1번은 parse 에 실패한 설정을 그대로 둔다. 그렇게 둔 설정에서도 통합 참조는 비운다. 비우기를 parse 에 성공한 설정에만 걸면 손으로 고친 파일로 남의 개인 통합 참조를 남길 수 있다. 통합 참조를 그대로 두면 노드는 실행할 때마다 실패한다. 또 남의 개인 통합만 비우고 없는 통합은 남기면 결과만 보고 그 ID 가 남의 개인 통합이었는지 알 수 있다. 그래서 세 경우를 같게 비운다. 이 부분은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) Rationale 이 정한다.
- **문자열이 아닌 참조 값도 비우는 이유**(2026-10-25 구현 확인): 고르지 않은 자리가 아닌데 문자열도 아닌 값은 어느 통합도 가리키지 못해 그대로 두면 노드가 실행할 때마다 실패한다. 캔버스 저장도 같은 값을 없는 통합과 같이 거절한다. `mcpServers` 가 배열이 아닌 경우처럼 자리 자체를 읽을 수 없으면 어느 값이 참조인지 알 수 없으므로 그대로 두고 실행 시점 판정에 맡긴다.
- **그대로 둔 참조가 남의 개인 통합으로 실행되지 않는 이유**: 가져오기 · 복제로 만든 워크플로우는 요청 사용자가 작성자이자 저장자다. 실행 시점 판정은 워크플로우 작성자가 통합 소유자인지 본다. 그래서 이 경로에서는 실행 시점 판정이 저장 검사의 조건을 대신한다. 자리를 읽을 수 없어 남은 참조도 실행할 때 남의 개인 통합으로 쓰이지 않는다.
- **경고로 알리는 이유**: 조용히 비우면 사용자는 실행해 보고 나서야 노드가 빈 것을 안다. 레이블을 보이면 고칠 노드를 바로 안다.

기각한 대안: **문자열이 아닌 값을 그대로 두는 안**. 노드가 실행할 때마다 실패하고 캔버스 저장은 같은 값을 거절해 경로마다 기준이 갈린다.
