# 보안(Security) 코드 리뷰

대상: `workflows.service.ts::duplicate()` 재구현 (nodes/edges 트랜잭션 복제) + 관련 controller/spec/e2e/plan/spec 문서

## 발견사항

- **[INFO]** 인가(authorization) 확인이 트랜잭션 시작 전에 1회만 수행됨 (TOCTOU 여지, 영향 낮음)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:233-236` (`duplicate()`)
  - 상세: `findById(id, workspaceId)` 로 원본 워크플로우의 존재·워크스페이스 소속을 확인한 뒤, 별도 트랜잭션에서 `manager.find(Node/Edge, { where: { workflowId: id } })` 로 다시 조회한다. 확인과 조회 사이에 동시 요청으로 원본이 삭제되면(FK CASCADE) 노드/엣지 조회가 빈 배열을 반환해 "이름만 있고 캔버스가 빈" 사본이 조용히 생성될 수 있다. 다만 이는 인가 우회나 타 워크스페이스 데이터 접근으로 이어지지 않는다 — `id` 는 이미 검증된 워크스페이스에 고정되어 있고, race 의 최악 결과는 자기 자신의 리소스에 대한 드문 데이터 일관성 저하일 뿐이다.
  - 제안: 우선순위 낮음. 완전히 닫으려면 `SELECT ... FOR UPDATE` 또는 트랜잭션 내부에서 존재를 재확인하는 방법이 있으나, 비즈니스 영향이 미미해 필수 조치는 아니다.

- **[INFO]** `node.config` 를 검증/새니타이징 없이 그대로 복사 — 사용자가 직접 입력한 시크릿 형태 값(예: HTTP 노드의 커스텀 `headers` 에 수기 입력한 토큰)도 함께 복제됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:279` (`config: { ...node.config }`)
  - 상세: `http-request.schema.ts` 는 `authentication: 'integration'` 모드 외에 사용자가 `headers` 에 값을 직접 입력하는 경로도 허용한다(자격 증명이 `Integration` 엔티티 참조가 아니라 노드 `config` JSONB 안에 리터럴로 존재할 수 있음). `duplicate()` 는 이 값을 그대로 사본에 복사한다. 다만 사본은 `findById(id, workspaceId)` 로 이미 확인된 **동일 워크스페이스**에만 생성되고(`workspaceId` 가 요청 컨텍스트에서 오며 원본과 강제로 일치), `createdBy` 만 요청자로 바뀌므로 테넌트 경계를 넘는 유출은 아니다 — "복제" 기능의 의도된 동작(캔버스 전체를 그대로 복사)과 일치한다. 정보로만 기록.
  - 제안: 별도 조치 불필요. 다만 향후 워크스페이스 간 "템플릿 공유"나 "다른 조직으로 복제" 같은 기능이 추가될 경우, 이 무검증 config 복사 경로를 재사용하지 않도록 주의(그 시점에는 시크릿 redaction 이 필요해짐).

## 검증한 항목 (문제 없음)

- **인가/IDOR**: `duplicate(id, workspaceId, userId)` 는 트랜잭션 진입 전 `findById(id, workspaceId)` 로 원본이 요청 워크스페이스(`@WorkspaceId()`, JWT/헤더 기반 신뢰 컨텍스트) 소속인지 확인하고, 아니면 `NotFoundException` 을 던져 트랜잭션 자체를 열지 않는다. 새 워크플로우는 항상 `workspaceId = original.workspaceId` 로 생성되어(호출부에서 강제) 타 워크스페이스로 유출되거나 교차 테넌트 자원을 참조할 수 없다. 컨트롤러(`workflows.controller.ts:211`)는 `@Roles('editor')` 로 제한되어 있어 viewer 이하 권한으로는 호출 불가.
- **SQL 인젝션**: 모든 DB 접근이 TypeORM `manager.find`/`manager.insert` 파라미터 바인딩을 사용한다. 원시 SQL 문자열 보간 없음 (참고: 같은 파일의 `findAll()` 정렬 컬럼은 별도의 화이트리스트 `getSortColumn()` 으로 방어되며 이번 diff 대상이 아님).
- **ID 예측 가능성**: 신규 노드/엣지 ID 는 `node:crypto` 의 `randomUUID()` (CSPRNG 기반 UUID v4) 로 발급. 순차 ID 나 예측 가능한 값 없음.
- **참조 무결성/유령 참조 방지**: `remap()` 이 `idMap` 에 없는 참조를 `null` 로 떨어뜨리고(`containerId`/`toolOwnerId`), 매핑 불가 엣지는 아예 insert 대상에서 제외(`if (!sourceNodeId || !targetNodeId) return []`) — 원본의 내부 UUID 가 사본에 잘못 노출되거나 존재하지 않는 노드를 참조하는 상태로 남지 않는다.
- **트랜잭션 원자성**: workflow row 생성부터 node/edge 배치 insert 까지 단일 `dataSource.transaction` 안에서 처리되어, 실패 시 부분 생성된 사본이 남지 않는다(권한 확인만 트랜잭션 밖 — 위 INFO 참고).
- **`manager.insert` 의 hook/cascade 우회**: 주석과 `workflows.service.spec.ts` 하단의 `@BeforeInsert 리스너가 없다` 가드 테스트(이미 `importWorkflow` 에서 동일 전제로 검증됨)로 Node/Edge 엔티티에 우회되는 보안 관련 lifecycle hook 이 없음을 확인. `Node`/`Edge` 엔티티 직접 확인 결과 `@BeforeInsert` 데코레이터 없음.
- **import 전용 게이트 미적용의 의도**: `applyConfigDefaults`/기본 LLM 자동 주입/`label` 중복 409/reserved 변수명 검증을 duplicate 경로에 적용하지 않는 것은 "이미 저장 시점에 검증을 통과한 신뢰 데이터의 재검증 불필요" 라는 명시적 근거(코드 주석 + spec Rationale)가 있고, 오히려 기본 LLM 주입을 적용하면 원본이 의도적으로 비워둔 `llmConfigId` 를 사본이 임의로 채우는 설정 변조가 된다 — 타당한 설계.
- **에러 처리**: `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })` 는 워크스페이스 소속 여부와 무관하게 동일 메시지를 반환(리소스 존재 자체를 다른 워크스페이스 사용자에게 노출하지 않음). 스택 트레이스·내부 쿼리·DB 에러 원문 등 민감 정보 노출 없음.
- **하드코딩된 시크릿**: 전체 diff(controller/service/spec/e2e/plan/spec 문서) 에 API 키·비밀번호·토큰·인증서 리터럴 없음. 테스트 픽스처의 `'wf-uuid-1'`, `'user-uuid-2'` 등은 목(mock) 식별자이며 e2e 의 `ownerToken` 은 테스트 헬퍼(`registerAndLogin`)가 매 실행 시 동적으로 발급.
- **e2e 테스트의 DB 접근**: 신규로 추가된 `db.query('SELECT id FROM node WHERE workflow_id = $1', [dupId])` 등은 파라미터 바인딩(`$1`) 사용 — 테스트 코드 자체에도 SQL 인젝션 없음.
- **의존성 보안**: 이번 diff 는 신규 npm 패키지를 추가하지 않는다(`node:crypto` 내장 모듈만 사용).
- **문서(plan/spec) 변경**: `plan/in-progress/workflow-duplicate-nodes-edges.md`, `spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`, `review/consistency/**` 산출물은 전부 설명 텍스트로, 실행 코드나 시크릿을 포함하지 않는다.

## 요약

이번 변경은 `WorkflowsService.duplicate()` 가 workflow 메타만 복제하던 결함을 고쳐 node/edge 그래프 전체를 트랜잭션으로 복제하도록 재구현한 것이다. 인가 경계(워크스페이스 스코프 `findById` + `@Roles('editor')`)를 그대로 유지하면서 새 워크플로우를 항상 원본과 동일한 워크스페이스에만 생성하도록 강제해 IDOR/교차 테넌트 유출 가능성이 없고, 모든 DB 접근이 TypeORM 파라미터 바인딩을 사용해 인젝션 벡터가 없으며, 신규 ID 는 CSPRNG(`randomUUID`) 로 발급되고, 참조 재매핑 로직이 유령 참조·원본 UUID 유출을 방어적으로 차단한다. import 전용 검증 게이트(기본 LLM 주입 등)를 의도적으로 건너뛰는 설계도 "이미 검증된 신뢰 데이터의 재검증 불필요 + 설정 변조 방지" 라는 타당한 근거가 있다. 하드코딩된 시크릿이나 새로운 의존성도 없다. 발견된 2건은 모두 정보성(INFO) — 인가 확인과 트랜잭션 사이의 극히 드문 TOCTOU 데이터 일관성 갭(권한 우회 아님), 그리고 사용자가 노드에 직접 입력한 시크릿 형태 값이 (같은 워크스페이스 내에서) 함께 복제된다는 점(의도된 "복제" 동작과 일치) 이다. 두 항목 모두 즉시 조치가 필요한 취약점은 아니다.

## 위험도

LOW
