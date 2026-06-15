---
checker: convention-compliance
mode: impl-done
scope: exec-single-node (§1.3 단일 노드 실행)
diff_base: 015b11df38531ae9fd291d99e8634a21b4a8f8c7
generated_at: 2026-06-15T15:36:35Z
---

# 정식 규약 준수 검토 결과

## 발견사항

### [INFO] API endpoint — 3단계 중첩이나 정식 허용 패턴 검토 필요
- target 위치: `spec/3-workflow-editor/3-execution.md §9`, `codebase/backend/src/modules/workflows/workflows.controller.ts:328`
- 위반 규약: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지: `/api/{resource}/{id}/{sub-resource}`" / "3단계 이상은 최상위로 분리"
- 상세: `POST /api/workflows/:id/nodes/:nodeId/execute` 는 `resource(workflows) / id / sub-resource(nodes) / sub-id(nodeId) / action(execute)` 로 4세그먼트 깊이다. 단순 중첩 2단계 규칙 문면(`/api/{resource}/{id}/{sub-resource}`)을 초과한다. 단, spec 자체 (`spec/3-workflow-editor/3-execution.md §9`, caller 시스템 메시지)가 "규약 준수 endpoint" 로 명시 채택하고 있으며, `api-convention.md §2.2` 의 허용 예외 패턴("RPC-style sub-channel action: `/api/{resource}/{id}/{channel}/{action}`")과 구조적으로 동형이다 — `nodes` 가 channel 역할, `execute` 가 action 역할. 허용 예외 텍스트에 nodes 예시가 없어 명시 열거 범위 밖이라는 점이 INFO 등급 지적의 근거다.
- 제안: `api-convention.md §2.2` 의 RPC-style 허용 예외 예시에 `/api/workflows/:id/nodes/:nodeId/execute` 형태를 추가해 문서를 보완하거나, 현 endpoint를 채택 근거(`nodes/:nodeId` = Node 하위 자원의 단일 액션)로서 명시 승인한다. 구조 자체는 기존 허용 패턴과 동형이므로 endpoint 변경은 불필요하다.

### [INFO] 에러 코드 `NODE_NOT_IN_WORKFLOW` / `PREVIOUS_EXECUTION_NOT_FOUND` — 신규 코드 등록 확인
- target 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:386, 400`
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명) + `spec/5-system/3-error-handling.md §1`의 카탈로그 등록 원칙
- 상세: 두 코드는 모두 `UPPER_SNAKE_CASE`를 준수하고(표기 규약 적합), 의미 기반 명명 원칙(§1)을 충족한다 — `NODE_NOT_IN_WORKFLOW`(노드-워크플로우 소속 불일치)와 `PREVIOUS_EXECUTION_NOT_FOUND`(전전 실행 ID 미발견)는 조건의 의미를 이름만으로 식별 가능하다. 다만 `error-codes.ts` 중앙 enum과 `3-error-handling.md §1` 카탈로그에 신규 추가됐는지 확인이 필요하다. controller에서 인라인 문자열(`code: 'NODE_NOT_IN_WORKFLOW'`)로 직접 발행하는 패턴은 `error-codes.md §1`("인라인 문자열 금지")에 저촉될 수 있다.
- 제안: `codebase/backend/src/nodes/core/error-codes.ts`의 `ErrorCode` enum에 두 코드가 등록됐는지 확인하고, controller 발행 시 enum 값으로 참조하도록 보강한다. 미등록이면 추가 필요.

### [INFO] 마이그레이션 명명 — V098 규약 준수 확인
- target 위치: `codebase/backend/migrations/V098__execution_single_node.sql`
- 위반 규약: `spec/conventions/migrations.md §1` (명명 규약)
- 상세: `V098__execution_single_node.sql` — 번호 단조 증가 · `__` 구분자 · `snake_case` 설명자 모두 규약을 충족한다. 두 컬럼(`single_node_id`, `previous_execution_id`) 모두 `NULLABLE DEFAULT NULL`로 추가하여 기존 행 회귀 없이 append-only 원칙(§3)을 준수한다. 명시적 FK 제약 미설정도 `re_run_of` 선례를 따른 것으로 주석에 명시되어 있어 의도적 일탈임이 기록됐다.
- 제안: 특이사항 없음. INFO 는 V097(WorkflowTestDataset)과 V098이 연속 번호로 같은 PR 범위인지 확인 권장 수준.

### [INFO] DTO 명명 — `ExecuteNodeDto` 패턴 준수
- target 위치: `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`
- 위반 규약: `spec/conventions/swagger.md §1` (DTO 패턴)
- 상세: `ExecuteNodeDto` — PascalCase + `Dto` 접미사 패턴 적합. 필드에 `@ApiPropertyOptional` 및 JSDoc(영문)이 부착되어 있어 swagger 컨벤션을 따른다. 단, swagger.md §1-1에서 JSDoc은 "한국어" 권장이나 `execute-node.dto.ts`의 JSDoc은 영문으로 작성됐다. 기능적 영향은 없으며 기존 DTO 중 영문 JSDoc이 혼재하는 패턴도 존재하는 것으로 파악된다.
- 제안: 엄격 준수 시 JSDoc을 한국어로 변환. 단 기존 혼재 패턴을 고려하면 규약 자체에 "영문 허용" 예외를 명시하거나, 일괄 정책을 결정하는 것이 근본 해결이다.

### [INFO] 문서 구조 — spec 3-execution.md 섹션 구성 확인
- target 위치: `spec/3-workflow-editor/3-execution.md`
- 위반 규약: CLAUDE.md 문서 구조 권장 (Overview / 본문 / Rationale 3섹션)
- 상세: `3-execution.md`에는 `## Rationale` 섹션이 존재하며(§1.3 범위 한계 설명 포함) CLAUDE.md 권장 구조를 따른다. `§1.3 단일 노드 테스트` 신규 절은 기존 문서 구조 안에 정상 삽입됐다. frontmatter(`status: partial`, `pending_plans` 유지)도 `spec/conventions/spec-impl-evidence.md §2` 스키마에 부합한다. 특이사항 없음.
- 제안: 없음.

---

## 요약

정식 규약 준수 관점에서 전체적으로 양호한 수준이다. endpoint `POST /api/workflows/:id/nodes/:nodeId/execute`는 `api-convention.md §2.2`의 "중첩 2단계" 문면을 형식상 초과하나 동일 절의 RPC-style 허용 예외 패턴과 구조적으로 동형이고 spec이 직접 채택을 명시하므로 실질적 규약 위반이 아니다 — 다만 허용 예외 예시에 해당 패턴이 미열거된 문서 갭이 남아 있다. `NODE_NOT_IN_WORKFLOW` / `PREVIOUS_EXECUTION_NOT_FOUND` 두 에러 코드는 표기(UPPER_SNAKE_CASE)와 의미 기반 명명 모두 규약에 부합하나, controller 인라인 문자열 발행 패턴이 `error-codes.ts` enum 중앙화 원칙과의 정합성 확인을 요한다. 마이그레이션 V098과 DTO는 각 규약을 준수하고 있다. CRITICAL 또는 WARNING 등급 발견사항은 없으며, 모두 사소한 문서 보완 또는 구현 확인 수준의 INFO다.

## 위험도

LOW
