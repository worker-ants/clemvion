# 신규 식별자 충돌 검토 — execution §1.3 단일 노드 실행

## 발견사항

### [INFO] `nodeResultOutput` / `nodeResultError` 번역값이 기존 키와 동일

- target 신규 식별자: `editor.nodeResultOutput` ("출력"), `editor.nodeResultError` ("오류")
- 기존 사용처:
  - `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:37` — `output: "출력"` (단독 탭 레이블)
  - `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:168` — `outputsLabel: "출력"` (노드 설정 패널 Outputs 섹션 헤더)
  - `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:242` — `conversation.tabOutput: "출력"` (대화형 노드 탭)
- 상세: 키 이름 자체는 충돌하지 않는다. 그러나 `nodeResultOutput`("출력"), `outputsLabel`("출력"), `output`("출력"), `conversation.tabOutput`("출력") 네 키가 동일한 한국어 번역값 "출력"을 공유한다. 영어(`nodeResultOutput: "Output"`, `outputsLabel` 미추적)도 마찬가지다. 번역 중복이 기능 충돌을 일으키지는 않으나 향후 다국어 번역자가 문맥을 구분하기 어렵다.
- 제안: 중요도가 낮으며 실제 동작 충돌은 없다. 번역 파일에 인라인 주석으로 사용 컨텍스트를 명시하거나(`// 노드 설정 패널 Info 탭 단일 노드 결과`), 키 네이밍에 위치 힌트를 추가(`nodeInfoResultOutput`)하는 것을 고려한다.

---

### [INFO] `isCanonical` 지역 변수와 `isCanonicalHandlerOutput` 함수명 유사

- target 신규 식별자: `export function isCanonicalHandlerOutput(...)` — `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:201`
- 기존 사용처: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:223` — `const isCanonical = ...` (지역 변수, 동일 패턴을 인라인으로 반복)
- 상세: 충돌은 아니다. `isCanonical`은 지역 변수(`execution-context.service.ts` 내부 스코프)이고, `isCanonicalHandlerOutput`은 `handler-output.adapter.ts`에서 export된 함수다. 두 식별자는 다른 파일·스코프에 있다. 단, `execution-context.service.ts`의 인라인 로직은 `isCanonicalHandlerOutput`과 동일한 판별 로직이 중복된 상태다(`ai-review W-13` 조치 대상으로 이미 추적됨).
- 제안: 충돌이 아닌 중복이므로 이 검토 범위를 넘어선다. `execution-context.service.ts`의 지역 `isCanonical` 변수를 `isCanonicalHandlerOutput` 호출로 교체하면 SoT 단일화가 완성된다.

---

### [INFO] `previousExecutionId` — `re_run_of` / `reRunOf` 와 의미상 유사한 이름

- target 신규 식별자: `previousExecutionId` (DB 컬럼 `previous_execution_id`, V098), `ExecuteOptions.previousExecutionId`
- 기존 사용처:
  - `spec/1-data-model.md §2.13` — `re_run_of UUID?` ("Re-run의 직계 부모 Execution")
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:563` — `ExecuteOptions.reRunOf`
- 상세: 두 식별자 모두 "이전 실행의 ID"를 가리키지만 의미가 다르다. `re_run_of`는 Re-run chain에서 직계 부모를 나타내는 chain 관계다. `previous_execution_id`는 단일 노드 실행의 입력 seed 출처로만 쓰이는 참조로, chain 관계가 아니다. spec(`1-data-model.md:506`)과 migration(`V098__execution_single_node.sql:18-20`)에 이 구분이 명시되어 있고, 코드에도 주석이 있다. 혼동 가능성은 신규 개발자 입장에서 존재하나, 실제 충돌은 없다.
- 제안: 현재 수준의 주석·spec 명시로 충분하다. 추가로 `ExecuteOptions` union의 `previousExecutionId` 필드에 `// re_run_of 와 다름 — chain 관계 아님, 입력 seed 참조` 주석을 한 줄 더 달면 오해 예방이 강화된다.

---

## 요구사항 ID 충돌 — 검토 결과 없음

V098은 신규 마이그레이션 번호이며, `V097__workflow_test_dataset.sql` 다음 순번으로 정확하다. 기존 V098 파일이 없었음을 `codebase/backend/migrations/` 목록으로 확인했다.

## API endpoint 충돌 — 검토 결과 없음

`POST /api/workflows/:id/nodes/:nodeId/execute`는 기존 spec(`spec/3-workflow-editor/3-execution.md §9`) 및 코드(`workflows.controller.ts:328`)에 새로 추가된 경로다. 기존 spec에 동일 method+path 조합이 없다. `POST /api/workflows/:id/execute`(전체/부분 실행)와 경로 구조가 달라 라우팅 충돌 없음.

## 엔티티/타입명 충돌 — 검토 결과 없음

`ExecuteNodeDto`는 `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`에 신규 정의되며, 기존 DTO 파일 목록에 동명 파일이 없다. `ExecuteOptions` 타입은 기존에 `execution-engine.service.ts`에 이미 존재하며, 이번 변경은 기존 union에 `singleNodeId`/`previousExecutionId` 필드를 추가한 것이다 — 타입 충돌이 아닌 확장이다.

## 이벤트/메시지명 충돌 — 검토 결과 없음

단일 노드 실행은 기존 `execution.*` WebSocket 이벤트를 그대로 재사용한다. 신규 이벤트명을 도입하지 않았다.

## 환경변수·설정키 충돌 — 검토 결과 없음

신규 ENV var 또는 config key 없음.

## 파일 경로 충돌 — 검토 결과 없음

`V098__execution_single_node.sql`은 V097 다음 순번이며 기존 파일명과 겹치지 않는다. `dto/execute-node.dto.ts`는 신규 파일로 기존 dto 파일과 중복 없음.

## i18n 키 충돌 — 검토 결과 없음 (INFO 1건)

`runThisNode`, `nodeResultTitle`, `nodeResultOutput`, `nodeResultError` 네 키는 `editor` 네임스페이스 내 신규이며, 기존 키와 이름 충돌은 없다. 단 `nodeResultOutput`의 한국어 번역 "출력"이 `output`, `outputsLabel`, `conversation.tabOutput`과 동일한 점이 위 INFO로 기록되었다.

---

## 요약

execution §1.3 단일 노드 실행이 도입하는 신규 식별자(`single_node_id` / `previous_execution_id` DB 컬럼, `V098` 마이그레이션, `ExecuteOptions` union 확장, `isCanonicalHandlerOutput` export, `getLatestPredecessorOutputs` private 메서드, `runThisNode` / `nodeResult*` i18n 키, `POST /api/workflows/:id/nodes/:nodeId/execute` endpoint)는 기존 사용처와 의미상 실질적 충돌이 없다. 각 식별자는 서로 다른 도메인·스코프에 속하며, spec과 코드 양쪽에서 기존 유사 개념(re_run_of, outputsLabel 등)과의 의미 차이가 명시되어 있다. 발견된 사항은 모두 INFO 등급 — 번역값 중복, 유사 함수명 인라인 잔존, 입력 참조 vs chain 관계 혼동 가능성 — 이며 어느 것도 사용자 혼선이나 시스템 오동작을 직접 야기하지 않는다.

## 위험도

NONE
