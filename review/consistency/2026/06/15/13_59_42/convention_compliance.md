# 정식 규약 준수 분석 — execution §1.3 single-node execution (--impl-prep)

검토 대상 변경 요약:
- REST endpoint: `POST /api/workflows/:id/execute-node` (body `{ nodeId, previousExecutionId? }`)
- DB migration V098: 두 컬럼 추가 (`single_node_id`, `previous_execution_id`)
- NestJS DTO + Swagger 애노테이션
- 프론트엔드 i18n ko/en 키 + 노드 우클릭 메뉴 항목

---

## 발견사항

### **[CRITICAL]** REST endpoint action 세그먼트가 kebab-case 규약을 따르지 않는 리소스-동사 혼합 형태

- **target 위치**: 계획된 endpoint `POST /api/workflows/:id/execute-node`
- **위반 규약**: `spec/conventions/` 직접 규약이 아닌 `spec/5-system/2-api-convention.md §2.2` 명명 규칙
- **상세**: `spec/5-system/2-api-convention.md §2.2` 는 "리소스는 복수형 명사" + "케밥 케이스" + "예외 — RPC-style sub-channel action: `/api/{resource}/{id}/{channel}/{action}` 형태" 를 정의한다. 현재 `execute-node` 는 하위 채널 없이 두 단어를 하이픈으로 결합한 동사+명사 형태로, RPC-style 예외(`{channel}/{action}`)도 아니고 일반 명사 sub-resource 도 아니다. 같은 파일 §3 에서 POST 는 "리소스 생성, 액션 실행" 에 사용할 수 있지만, 현재 `execute-node` 는 action verb(execute) + noun(node) 복합 토큰이므로 sub-resource 경로가 아닌 동사형 임을 명확히 해야 한다. 기존 유사 action endpoint 패턴을 보면 `POST /api/executions/:id/stop`, `POST /api/executions/:id/continue`, `POST /api/workflows/:workflowId/test-datasets/:id/clone` 모두 단일 동사 또는 단일 명사이다 (`spec/3-workflow-editor/3-execution.md §9` API 표 참조). `execute-node` 는 이 패턴과 달리 동사+명사 2-token 합성 action 이름이다. 규약에서 허용하는 `/api/{resource}/{id}/{channel}/{action}` 4-segment RPC 패턴에 끼워 맞추면 `channel=nodes`, `action=execute` 로 분리해 `/api/workflows/:id/nodes/:nodeId/execute` 형태가 자연스럽다. 또는 단순히 `/api/workflows/:id/execute` 의 body 에 `nodeId` 를 포함시켜 기존 execute endpoint 를 확장하는 방법도 고려할 수 있다. 현재 계획된 이름은 규약 취지에 어긋나며 다른 시스템(프론트·API 문서)이 가정하는 URL 구조 invariant 를 깨뜨릴 수 있다.
- **제안**: endpoint 경로를 아래 중 하나로 변경한다.
  - (권장) `POST /api/workflows/:id/nodes/:nodeId/execute` — RPC-style 4-segment 패턴 (`{resource}/{id}/{sub-resource}/{action}`)에 부합하며 `nodeId` 를 path parameter 로 올려 body 를 단순화 (`{ previousExecutionId? }` 만 남음).
  - (차선) 기존 `POST /api/workflows/:id/execute` endpoint 를 확장해 body 에 `nodeId` 추가 (§1.2 부분 실행이 `fromNodeId` 로 이미 이 패턴을 사용 — `spec/3-workflow-editor/3-execution.md §1.2`). 단 "노드 1개만" vs "노드부터 하류 끝까지"의 시맨틱 차이가 명확하지 않으면 이 방향은 혼란을 야기할 수 있다.

---

### **[CRITICAL]** DB 컬럼 명 `single_node_id` 가 도메인 의미에서 벗어남

- **target 위치**: 계획된 migration V098 신규 컬럼 `single_node_id`
- **위반 규약**: `spec/conventions/migrations.md §1` (명명 규약: snake_case descriptor), `spec/1-data-model.md §2.13 Execution` 엔티티 컬럼 명명 패턴
- **상세**: `spec/1-data-model.md §2.13` 의 Execution 테이블 기존 컬럼들은 모두 대상 리소스 참조 컬럼을 `{resource}_id` 형태(예: `workflow_id`, `trigger_id`, `parent_execution_id`, `re_run_of`, `executed_by`)로 명명한다. `single_node_id` 는 "단일 실행을 위해 지정한 노드" 를 가리키지만 접두어 `single_` 이 외래키가 가리키는 도메인(`Node`)이 아닌 실행 모드를 기술한다. 같은 테이블에 `parent_execution_id`, `re_run_of` 등 의미 기반 이름이 있는 것과 달리 `single_node_id` 는 구현·역사(단일 노드 실행 모드)를 컬럼 이름에 박는 형태다. `spec/conventions/error-codes.md §1` 의 "의미 기반 명명" 원칙(구현 세부·전이적 맥락을 이름에 박지 않는다)은 에러 코드 전용 SoT 이지만, 동일 철학이 데이터 모델 컬럼 명명에도 일관되게 적용되고 있다(Execution 테이블의 모든 FK 컬럼이 이 원칙을 따름). `single_node_id` 는 추후 "from-a-specific-node" 등 다른 부분 실행 모드가 추가될 때 이름이 거짓이 될 위험이 있다.
- **제안**: 컬럼 이름을 `target_node_id` 로 변경한다. "이 실행이 실행하려는 대상 노드" 의 의미를 기술하며, 향후 실행 모드가 확장되어도 이름이 거짓이 되지 않는다. 또는 endpoint 가 `nodes/:nodeId/execute` 로 변경되면 컬럼도 `node_id` 를 고려할 수 있지만, Execution 테이블에 이미 조인을 통해 알 수 있는 정보를 비정규화한다는 점에서 `target_node_id` 가 더 명시적이다.

---

### **[WARNING]** DTO request body 키 `previousExecutionId` 의 camelCase 사용 — 기존 패턴 검토 필요

- **target 위치**: 계획된 DTO body `{ nodeId, previousExecutionId? }`
- **위반 규약**: `spec/5-system/2-api-convention.md §4` (요청 형식) — 명시적 camelCase/snake_case 규약 미기재
- **상세**: `spec/5-system/2-api-convention.md` 는 요청 본문 JSON 키의 대소문자 스타일을 명시적으로 규정하지 않는다. 그러나 기존 구현된 endpoint body 키를 살펴보면 모두 **camelCase** 를 사용한다 — `POST /api/workflows/:workflowId/test-datasets` 의 `{ name, input, visibility? }`, `POST /api/workflows/:id/execute` 의 `{ input }`, WS 명령의 `formData` / `buttonId` / `nodeId` 등 (`spec/3-workflow-editor/3-execution.md §8`). `nodeId` 와 `previousExecutionId` 는 이 패턴을 따르므로 **camelCase 로서는 기존 관행과 일치한다**. 단 `spec/2-navigation/7-statistics.md §R-2` 가 "쿼리 파라미터도 camelCase 로 통일" 이유를 명시한 만큼, 요청 본문 역시 camelCase 가 사실상 규약임을 `spec/conventions/` 또는 `spec/5-system/2-api-convention.md` 에 명문화하는 것이 좋다. 현재 계획 자체는 관행에 부합하므로 WARNING 이다.
- **제안**: `nodeId` / `previousExecutionId` 를 camelCase 로 유지한다. 단 API 규약 문서(`spec/5-system/2-api-convention.md §4`)에 "요청 본문 JSON 키는 camelCase" 를 명문화하는 별도 스펙 갱신을 추천한다.

---

### **[WARNING]** Swagger DTO 응답 래퍼 — 이 endpoint 의 응답 형태가 정의되지 않음

- **target 위치**: 계획된 NestJS DTO + Swagger 애노테이션
- **위반 규약**: `spec/conventions/swagger.md §5-4` 새 엔드포인트 체크리스트, `§5-1` 응답 DTO 위치
- **상세**: `spec/conventions/swagger.md §5-4` 는 신규 endpoint 체크리스트로 "응답 DTO 가 `dto/responses/` 에 있는지", "`ApiOkWrappedResponse` / `ApiCreatedWrappedResponse` 등 적절한 래퍼 사용", "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용", "`@Roles(...)` 붙은 endpoint 는 `@ApiForbiddenResponse` 추가" 를 요구한다. 계획 문서에는 DTO 이름과 응답 shape 이 정의되어 있지 않아 구현 시 누락 위험이 있다. 특히 `POST /api/workflows/:id/execute-node` 는 새 Execution 을 생성한다면 `201 Created + ApiCreatedWrappedResponse(ExecutionDto)` 가 되어야 하고, 기존 Execution 에 단일 노드를 추가 실행하는 경우라면 `202 Accepted + ApiAcceptedWrappedResponse(...)` 패턴이 된다. 어느 쪽인지 spec 에 명시되어 있지 않아 구현자가 다른 패턴을 선택할 경우 규약 위반이 된다.
- **제안**: impl spec(§1.3)에 다음을 명시한다: (1) 이 endpoint 가 반환하는 HTTP status code (201 vs 202), (2) 응답 DTO 이름 및 `dto/responses/` 내 위치, (3) `:id` path parameter 에 `@ApiParam({ name: 'id', format: 'uuid' })` 적용 여부.

---

### **[WARNING]** migration V098 descriptor 명명 — `single_node_execution` 이 `single_node_id` 컬럼을 반영

- **target 위치**: 계획된 migration 파일 이름 (예상: `V098__single_node_execution.sql` 또는 유사)
- **위반 규약**: `spec/conventions/migrations.md §1` (설명자는 snake_case, 권장 문자집합 영문 소문자 + 숫자 + `_`)
- **상세**: migrations.md §1 의 설명자 권장 문자집합 기준은 만족하나, CRITICAL §2 에서 `single_node_id` 컬럼 이름 변경을 권고했으므로 migration descriptor 도 `target_node_execution` 등으로 맞춰야 한다. 만약 컬럼 이름을 `target_node_id` 로 변경하면 descriptor 를 `execution_target_node` 또는 `execution_single_node` 등으로 수정해야 일관성이 유지된다. 이 자체는 규약 위반은 아니나 컬럼 이름 변경 시 descriptor 도 함께 갱신해야 함을 경고한다.
- **제안**: CRITICAL §2 의 컬럼 이름 결정 후 descriptor 를 `V098__execution_single_node_columns.sql` 대신 실제 추가되는 컬럼 이름을 반영한 형태로 작성한다. `spec/conventions/migrations.md §5` 의 절차(max V 확인 → `V<max+1>__<descriptor>.sql`)는 V097 이 현재 max 이므로 V098 번호 자체는 올바르다.

---

### **[WARNING]** i18n 키 추가 시 ko/en parity 및 dict section 배치 확인 필요

- **target 위치**: 계획된 프론트엔드 i18n ko/en 키
- **위반 규약**: `spec/conventions/i18n-userguide.md Principle 2` (ko/en 사전 leaf key parity), `Principle 1` (UI 문자열은 dict 키 경유)
- **상세**: `spec/conventions/i18n-userguide.md Principle 2` 는 `dict/ko/<section>.ts` 와 `dict/en/<section>.ts` 의 leaf 키 집합이 항상 일치해야 하며 한쪽에만 키가 존재하는 상태로 commit 금지를 강제한다. 노드 우클릭 메뉴에 추가되는 "단일 노드 실행" 항목과 관련 UI 문자열(예: 메뉴 레이블, 툴팁, 에러 메시지 등)은 `dict/ko/<section>.ts` 와 `dict/en/<section>.ts` 모두에 동시에 추가되어야 한다. `i18n.test.ts` 의 `dict parity (ko ↔ en)` 가드가 하드 fail 로 차단하므로 실제 commit 은 막히지만, 구현 착수 전에 어느 section 파일에 키를 추가할지, 키 이름 패턴을 미리 결정하는 것이 좋다. 또한 Principle 1 에 따라 TSX 안에 한국어 문자열 직접 하드코딩은 금지된다.
- **제안**: 구현 시 아래를 동시에 진행한다: (1) `dict/ko/<section>.ts` 에 메뉴 항목 + 관련 UI 문자열 키 추가, (2) `dict/en/<section>.ts` 에 동일 키 + 영어 문자열 추가, (3) TSX 에는 `t("...")` 호출로만 참조. 추가할 section 을 사전에 결정해 두면 PR 에서 누락이 없다.

---

### **[INFO]** `spec/3-workflow-editor/3-execution.md §1.3` 상태 표기 — 구현 완료 후 갱신 필요

- **target 위치**: `spec/3-workflow-editor/3-execution.md §1.3` "단일 노드 테스트 _(계획·미구현)_"
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 정책 — spec 은 현재 구현 상태를 반영해야 함
- **상세**: 현재 spec 의 §1.3 은 "상태: 미구현 (계획)" 으로 명시되어 있다. 이 구현이 완료되면 `_(계획·미구현)_` 표기와 상태 설명을 제거·갱신해야 한다. 또한 frontmatter 의 `status: partial` 도 재검토가 필요하다. 구현 완료 후 spec 을 갱신하지 않으면 spec-impl-evidence.md 의 gap 이 잔존하게 된다.
- **제안**: 구현 PR 에서 `spec/3-workflow-editor/3-execution.md §1.3` 의 `_(계획·미구현)_` 표시, "상태: 미구현 (계획)" 안내문, 및 §9 API 표의 "전용 부분실행/단일노드 엔드포인트 없음" 주석을 갱신한다.

---

### **[INFO]** Swagger DTO 에 `@ApiForbiddenResponse` 포함 여부

- **target 위치**: 계획된 Controller endpoint Swagger 애노테이션
- **위반 규약**: `spec/conventions/swagger.md §5-4` 체크리스트 항목 — "`@Roles(...)` 가 붙은 엔드포인트는 `@ApiForbiddenResponse` 도 추가"
- **상세**: 단일 노드 실행은 워크플로우 실행 권한(예: Editor+)이 필요할 가능성이 높다. 권한 가드가 붙을 경우 `@ApiForbiddenResponse({ description: '권한 없음' })` 을 함께 등록해야 한다. 구현 시 누락하기 쉬운 항목이므로 체크리스트에 포함한다.
- **제안**: 구현 시 `@Roles(...)` 데코레이터를 붙이면 반드시 `@ApiForbiddenResponse` 를 함께 추가한다. `spec/conventions/swagger.md §2-4` 상태 코드 응답 규칙 표를 참고한다.

---

## 요약

가장 중요한 두 가지 규약 위반은 다음이다. 첫째, 계획된 endpoint `POST /api/workflows/:id/execute-node` 는 `spec/5-system/2-api-convention.md §2.2` 의 URL 명명 패턴(복수형 명사 리소스 + RPC-style `{channel}/{action}` 예외)에 맞지 않는 동사+명사 혼합 토큰(`execute-node`)을 사용한다 — `/api/workflows/:id/nodes/:nodeId/execute` 형태로 분리하는 것이 규약 취지에 부합한다. 둘째, migration V098 의 신규 컬럼 `single_node_id` 는 Execution 테이블의 FK 컬럼 명명 관행(도메인 의미 기술)을 따르지 않으며 구현 모드를 이름에 박는 형태라 `target_node_id` 등 의미 기반 이름이 적합하다. DTO body 키의 camelCase 사용은 기존 관행과 일치하므로 문제없으나, Swagger 응답 DTO 위치·래퍼 선택·HTTP status code 와 i18n parity 의무는 구현 착수 전 미리 결정해 두어야 자동 가드 실패 없이 PR 을 완성할 수 있다.

---

## 위험도

**HIGH**

주요 근거: CRITICAL §1 (endpoint URL 구조 위반)은 프론트엔드 API 호출·OpenAPI 스키마·라우터 등록 등 다수 다운스트림이 의존하는 URL 을 정의하므로, 구현 후 변경 시 breaking 비용이 크다. CRITICAL §2 (컬럼 명 `single_node_id`)는 migration append-only 원칙(`spec/conventions/migrations.md §3`)으로 인해 main 에 들어가면 소급 수정이 불가(새 V<N+1> ALTER 로만 변경 가능)하므로 착수 전 교정이 필수이다.
