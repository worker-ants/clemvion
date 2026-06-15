# 보안(Security) 리뷰 — execution §1.3 단일 노드 실행

**리뷰 대상**: `POST /api/workflows/:id/nodes/:nodeId/execute` 신설 + `previousExecutionId` pre-seed 로직
**리뷰 일시**: 2026-06-15

---

## 발견사항

### [INFO] IDOR 방어: nodeId 워크플로우 소속 검증 — 올바르게 구현됨

- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `executeNode()` 라인 955-964
- 상세: `nodeRepository.findOneBy({ id: nodeId, workflowId: id })` 로 대상 노드가 path param `:id`(워크플로우)에 실제로 속하는지 DB 수준에서 검증한다. 노드 id 와 워크플로우 id를 동시에 조건으로 사용하므로 타 워크플로우 노드 id를 임의로 전달해 실행시키는 IDOR(Insecure Direct Object Reference)가 차단된다. 추가로 워크플로우 자체도 `workflowsService.findById(id, workspaceId)` 로 워크스페이스 소속 여부를 먼저 검증(라인 952)하므로 크로스-워크스페이스 접근도 방어된다.
- 제안: 현행 유지. 다만 `workflowsService.findById` 가 404 외 다른 예외를 던지지 않는다고 가정하므로 그 내부에서 워크스페이스 검증이 실제로 이루어지는지 정기적으로 확인하는 것이 좋다.

---

### [INFO] IDOR 방어: previousExecutionId 크로스-워크플로우 검증 — 올바르게 구현됨

- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `executeNode()` 라인 968-980
- 상세: `previousExecutionId` 가 전달된 경우 `executionRepository.findOneBy({ id: body.previousExecutionId, workflowId: id })` 로 해당 실행이 **같은** 워크플로우에 속하는지 DB에서 검증한다. null 반환 시 400을 반환하므로 타 워크플로우(또는 타 워크스페이스)의 실행 노드 출력을 seed 출처로 지정하는 공격 경로가 차단된다. 이는 크로스-워크플로우 데이터 노출의 핵심 위험을 올바르게 방어한다.
- 제안: 현행 유지. 단, 워크플로우 검증(findById with workspaceId)이 선행되어야만 `workflowId: id` 조건이 올바른 스코핑을 보장하므로 두 검증의 **순서**(워크플로우 먼저 → 실행 검증 이후)가 유지되어야 한다. 현재 코드는 올바른 순서를 지키고 있다.

---

### [INFO] 인증/인가: @Roles('editor') 적용 확인 — 올바르게 구현됨

- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `executeNode()` 라인 905
- 상세: `@Roles('editor')` 데코레이터가 붙어 있어 editor 이상 권한을 가진 사용자만 단일 노드 실행을 호출할 수 있다. Viewer-only 사용자가 임의 노드를 실행해 외부 부수효과(HTTP 노드, 코드 노드 등)를 유발하는 것이 방지된다. `@CurrentUser()` 로 JWT 페이로드를 추출해 `user.sub` 를 `executedBy` 로 기록하므로 실행 감사 추적도 가능하다.
- 제안: 현행 유지.

---

### [INFO] 입력 검증: DTO UUID 검증 및 path param ParseUUIDPipe 적용 — 올바르게 구현됨

- 위치: `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts` (전체); `workflows.controller.ts` 라인 935-936
- 상세: `@Param('id', ParseUUIDPipe)` 및 `@Param('nodeId', ParseUUIDPipe)` 로 path parameter가 UUID 형식인지 파이프 레벨에서 검증한다. body 의 `previousExecutionId` 에도 `@IsUUID()` 를 적용해 임의 문자열이 DB 쿼리에 전달되지 않는다. `input` 필드는 `@IsObject()` 로 최소 타입 검증을 수행한다.
- 제안: `input` 필드는 `Record<string, unknown>` 으로 열려 있어 임의 구조의 JSON이 허용된다. 이는 스펙 상 의도된 동작(수동 입력)이지만, 값의 크기 제한(payload size limit)이 controller 외부(NestJS `body-parser` 또는 global pipe) 에서 별도 적용되어 있는지 확인하는 것이 좋다. 현재 diff 에서는 size limit 관련 변경이 없으므로 기존 전역 설정에 의존한다.

---

### [INFO] 에러 처리: 에러 응답에 민감 정보 미노출 — 올바르게 구현됨

- 위치: `workflows.controller.ts` 라인 960-964, 974-979
- 상세: 노드 미존재 시 `NODE_NOT_IN_WORKFLOW`, 실행 미존재 시 `PREVIOUS_EXECUTION_NOT_FOUND` 의 코드와 일반 설명 메시지만 반환한다. DB 오류, 내부 스택 트레이스, 실제 쿼리 내용이 클라이언트에 노출되지 않는다. 또한 타 워크플로우의 노드/실행에 접근 시 "없음"으로 처리(존재 자체를 숨김)하므로 정보 열거(enumeration) 공격도 방어된다.
- 제안: 현행 유지. 프론트엔드의 `console.error("Single-node execution failed:", error)` (`workflow-canvas.tsx` 라인 1213)는 클라이언트 사이드 로그이므로 서버 기밀 노출과 무관하나, 프로덕션 환경에서 민감한 응답 데이터가 브라우저 콘솔에 남지 않도록 에러 객체 일부만 로깅하는 방안을 고려할 수 있다. (INFO 수준 — 현재 구현이 잘못된 것은 아님)

---

### [WARNING] getLatestPredecessorOutputs: 워크스페이스 수준 격리 확인 필요

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `getLatestPredecessorOutputs()` 및 `seedSingleNodePredecessorOutputs()`
- 상세: `getLatestPredecessorOutputs()` 는 `executionId` 와 `predecessorNodeIds` 를 받아 `nodeExecutionRepository.find({ where: { executionId, nodeId: In(predecessorNodeIds), status: COMPLETED } })` 를 실행한다. Controller 레벨에서 `previousExecutionId`가 올바른 워크플로우에 속함을 검증한 뒤 `savedExecution.previousExecutionId` 로 engine에 전달되지만, engine 내부의 `getLatestPredecessorOutputs` 자체는 `executionId` 의 워크스페이스/워크플로우 소속을 재검증하지 않는다. 큐 기반 비동기 실행에서 `savedExecution` 은 DB에서 재조회되므로(코드 주석 설명), 재조회 경로에서 `previousExecutionId` 소유권 검증이 누락되어 있을 경우 이론적으로 조작된 `execution` 행이 타 워크플로우 출력을 seed 할 수 있다.

  **실제 위험 평가**: 현재 구현에서 `savedExecution` 은 controller가 생성하고 저장한 행(이미 워크플로우/워크스페이스 검증 완료)을 큐 worker가 재조회한다. 공격자가 `savedExecution.previousExecutionId` 를 조작하려면 직접 DB 쓰기 권한이 필요하므로 실질적 공격 경로는 제한적이다. 다만 방어 심층(defense in depth) 원칙상 engine 레이어도 독립적으로 `previousExecutionId`가 같은 워크플로우에 속하는지 확인하면 더 강건하다.
- 제안: `seedSingleNodePredecessorOutputs` 내부에서 `previousExecutionId` 에 해당하는 실행의 `workflowId` 가 현재 실행의 `workflowId` 와 일치하는지 assertion 또는 DB 조회로 2차 검증하는 것을 권장한다. (WARNING — 현재 구현이 잘못된 것은 아니지만 defense in depth 레이어가 누락됨)

---

### [WARNING] 프론트엔드 노드 출력 JSON.stringify 렌더링: XSS 위험 평가

- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx`, 라인 1352-1355
- 상세: 노드 실행 결과 출력 데이터를 `<pre>` 태그 내에 `{JSON.stringify(latestResult.outputData, null, 2)}` 로 렌더링한다. React의 JSX는 기본적으로 텍스트 노드를 자동 이스케이프하므로, `JSON.stringify` 반환값의 `<script>`, `<img onerror=...>` 등이 포함되어 있어도 텍스트로 렌더링되어 스크립트가 실행되지 않는다. 즉 직접적인 DOM 기반 XSS 위험은 없다.

  단, `latestResult.error` 도 동일하게 `<pre>` 내 `{latestResult.error}` 로 렌더링한다(라인 1343). error가 서버에서 내려오는 문자열이라면 마찬가지로 React가 이스케이프한다. `dangerouslySetInnerHTML` 미사용이 확인되므로 XSS 위험 없음.
- 제안: 현행 유지. 다만 노드 출력이 매우 대용량인 경우(수 MB JSON) 브라우저 성능 문제가 발생할 수 있으므로, 프로덕션에서는 표시 크기 상한(`max-h-60` 클래스로 스크롤은 있음) 외에 JSON 크기 자체를 서버 응답 또는 표시 단계에서 제한하는 것을 고려할 수 있다. (INFO 수준)

---

### [WARNING] executionId를 클라이언트 상태(execution-store)에서 직접 previousExecutionId로 전달

- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `handleRunThisNode()` 라인 1207
- 상세: `execState.executionId ?? undefined` — 프론트엔드 store에 저장된 마지막 실행 id를 `previousExecutionId` 로 그대로 서버에 전송한다. 이 값은 사용자가 직접 조작하거나 XSS/CSRF로 교체될 수 있다. 그러나 서버 측에서 `previousExecutionId`가 같은 워크플로우 소속인지 검증하므로, 교체된 값이 타 워크플로우 id이면 400으로 거부된다. 같은 워크플로우 내 다른 실행 id로 교체하는 것은 `editor` 권한 사용자가 의도적으로 다른 실행 출력을 seed 출처로 선택하는 것과 동일한 효과이므로 별도 위협이 아니다.
- 제안: 현행 유지. 서버 측 검증이 최종 방어선임.

---

### [INFO] 하드코딩된 시크릿 — 없음 확인

- 상세: 리뷰 대상 파일 전체에 API 키, 비밀번호, 토큰, 인증서 등의 하드코딩된 시크릿이 발견되지 않았다.

---

### [INFO] SQL 인젝션 — TypeORM 파라미터 바인딩으로 방어됨

- 위치: `execution-engine.service.ts`, `getLatestPredecessorOutputs()` 의 `nodeExecutionRepository.find({ where: { executionId, nodeId: In(predecessorNodeIds), ... } })`
- 상세: TypeORM의 `find()` 는 모든 값을 parameterized query로 처리하므로 SQL 인젝션 위험 없음. `In()` 오퍼레이터도 TypeORM이 내부적으로 파라미터 바인딩을 사용한다.

---

### [INFO] 암호화 / 평문 전송 — 변경 범위 내 해당 없음

- 상세: 이번 변경에서 암호화 알고리즘이나 전송 계층 설정을 건드리지 않는다. 기존 HTTPS 설정에 의존한다.

---

### [INFO] 의존성 보안 — 신규 라이브러리 추가 없음

- 상세: 이번 변경은 기존 NestJS, TypeORM, class-validator, Lucide React 등을 재사용하며 신규 패키지를 추가하지 않는다.

---

## 요약

이번 변경(`POST /api/workflows/:id/nodes/:nodeId/execute`)의 핵심 보안 위협인 IDOR 및 크로스-워크스페이스 데이터 노출은 controller 레이어에서 2단계 검증(① 워크플로우가 워크스페이스에 속하는지, ② 노드와 previousExecutionId가 해당 워크플로우에 속하는지)으로 올바르게 방어된다. `@Roles('editor')` 인가 제어, ParseUUIDPipe/class-validator 입력 검증, 에러 응답의 정보 은닉도 적절하게 구현되었다. 주목할 만한 취약점은 없다. 다만 engine 내부의 `getLatestPredecessorOutputs` 가 `previousExecutionId` 소유권을 독립적으로 재검증하지 않는 점은 defense in depth 관점에서 WARNING 수준의 개선 여지이며, 프론트엔드에서 execution-store의 executionId를 그대로 previousExecutionId로 전달하는 패턴도 서버 측 검증이 최종 방어선이므로 실질 위험은 없으나 명시적으로 확인하였다. XSS, SQL 인젝션, 하드코딩 시크릿, 커맨드 인젝션 등 다른 OWASP Top 10 항목은 해당 없음 또는 기존 프레임워크 보호에 의해 방어된다.

---

## 위험도

LOW
