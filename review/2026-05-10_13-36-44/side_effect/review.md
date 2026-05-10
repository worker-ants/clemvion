변경 파일들을 분석합니다. 부작용 중심으로 각 파일을 검토하겠습니다.

---

## 발견사항

### [CRITICAL] Sync 모드 output 래핑 — 하위 호환성 없는 파괴적 변경
- **위치**: `workflow.handler.ts:136-142`
- **상세**: `executeInline` 반환값을 이전에는 `output: inlineResult`로 그대로 노출했으나, 이제 `output: { result: inlineResult }`로 1단 래핑한다. DB에 저장된 기존 워크플로우에서 `$node["X"].output.<field>` 형태로 접근하는 expression은 모두 `undefined`를 반환하며, 에러도 발생하지 않는다 (silent data loss). 스펙과 plan 모두 D-category(호환성 무시)로 분류했으나, `passthrough()` 스키마와 expression 언어 특성상 **무음 실패(silent failure)** 가 발생한다.
- **제안**: 마이그레이션 없이 배포할 경우, 영향받는 기존 워크플로우 목록을 DB 쿼리로 사전 식별하고, 배포 후 expression 오류 여부를 모니터링할 관찰 지점을 마련할 것.

---

### [CRITICAL] `mappingDefSchema` 필드 리네임 — 기존 저장 데이터 무음 실패
- **위치**: `workflow.schema.ts:9-27`
- **상세**: `target`→`paramName`, `source`→`expression` 으로 필드명 변경. 스키마에 `.passthrough()`가 적용되어 있어 기존 DB에 `{ target: "userId", source: "..." }` 형태로 저장된 `inputMapping`은 **Zod 유효성 검사를 통과**한다. 그러나 핸들러는 `mapping.paramName`과 `mapping.expression`만 읽으므로, 기존 데이터는 `subInput`에 `{ undefined: undefined }` 형태가 삽입되어 서브 워크플로우가 아무 파라미터도 전달받지 못한다. 실행 자체는 성공하므로 오류가 드러나지 않는다.
- **제안**: DB 마이그레이션 스크립트로 `inputMapping` 배열 내 `target`→`paramName`, `source`→`expression` 필드를 일괄 변환하거나, 핸들러에서 두 키 이름을 모두 읽는 호환 레이어를 일정 기간 유지할 것:
  ```typescript
  subInput[mapping.paramName ?? mapping['target']] = mapping.expression ?? mapping['source'];
  ```

---

### [WARNING] Async `meta.status` 제거 — expression 소비자 무음 파괴
- **위치**: `workflow.handler.ts:101-108`
- **상세**: 이전 반환값 `meta: { status: 'started' }`가 제거되고 top-level `status: 'started'`로 이동. `workflowNodeOutputSchema`는 여전히 `meta` 필드를 `optional`로 정의하므로 스키마 레벨 오류는 없다. 그러나 기존 워크플로우에서 `$node["X"].meta.status === 'started'` 조건 분기를 사용 중이라면 이 expression은 `undefined === 'started'` → `false`가 되어 조건 분기가 비정상 동작한다.
- **제안**: async 성공 시 `meta: { status: 'started' }`를 deprecated alias로 일정 기간 병행 반환하는 방안 검토.

---

### [WARNING] `mapSubWorkflowError` — executor 메시지 텍스트 의존 취약성
- **위치**: `workflow.handler.ts:196-219`
- **상세**: 에러 코드 매핑이 executor가 던지는 `Error.message` 텍스트에 대한 패턴 매칭에 의존한다. executor 구현이 메시지 포맷을 변경하면 (예: `"Workflow not found"` → `"No workflow with id"`) 모든 케이스가 `SUB_WORKFLOW_FAILED`로 폴백하며 코드가 조용히 저하된다. 현재 테스트는 mock 메시지로만 검증하므로 executor의 실제 메시지와 불일치 시 탐지되지 않는다.
- **제안**: 중장기적으로 executor가 구조화된 에러 타입(`class WorkflowNotFoundError extends Error`)을 던지도록 개선하고, `instanceof` 기반 분기로 전환할 것. 단기적으로는 executor 실제 메시지를 검증하는 통합 테스트 추가 권장.

---

### [WARNING] `ErrorCodeValue` 타입 확장 — 소비자 측 exhaustive 검사 영향
- **위치**: `error-codes.ts:38-40`
- **상세**: `ErrorCodeValue`는 `(typeof ErrorCode)[keyof typeof ErrorCode]` 유니온 타입이므로 3개 코드 추가 시 타입 범위가 확장된다. 외부에서 `switch (code)` + `never` exhaustiveness check를 사용하는 코드가 있다면 컴파일 오류가 발생할 수 있다.
- **제안**: `grep -r "ErrorCodeValue\|ErrorCode\." backend/src` 로 소비처를 확인하고 exhaustive check 패턴이 있는지 검토.

---

### [INFO] `mapSubWorkflowError` 공개 export — 암묵적 공개 API 형성
- **위치**: `workflow.handler.ts:195`
- **상세**: `private` 헬퍼 로직이 테스트를 위해 module-level export로 노출됨. 이 함수는 이제 공개 계약이 되어 향후 시그니처 변경 시 외부 호출자를 고려해야 한다. 현재 테스트 파일 외 실사용은 없지만, 임포트 가능한 공개 심볼이 된다.
- **제안**: `@internal` JSDoc 태그 추가 또는 `_mapSubWorkflowError`처럼 접두사로 내부 심볼임을 표시.

---

### [INFO] spec §5.3 에러 예시 코드와 실제 동작 불일치
- **위치**: `spec/4-nodes/2-flow/1-workflow.md`, §5.3 JSON 예시
- **상세**: §5.3 예시 JSON에서 `"code": "SUB_WORKFLOW_FAILED"`로 표기되어 있으나, 해당 케이스의 메시지 `"Workflow not found: wf_uuid_9999"`는 실제로 `mapSubWorkflowError`에 의해 `SUB_WORKFLOW_NOT_FOUND`로 매핑된다. 스펙 예시와 실제 동작이 불일치.
- **제안**: 예시를 `"code": "SUB_WORKFLOW_NOT_FOUND"`로 수정하거나, 별도로 fallback 케이스 예시를 추가.

---

## 요약

이번 변경의 핵심 부작용은 두 가지 **무음 파괴(silent breakage)** 경로다. 첫째, sync 결과 래핑(`output` → `output.result`)과 `mappingDefSchema` 필드 리네임(`target`/`source` → `paramName`/`expression`)은 모두 기존 워크플로우 expression과 저장 데이터에 영향을 주지만, Zod `passthrough()` 및 expression 언어의 `undefined` 처리 특성 덕분에 런타임 오류 없이 잘못된 결과를 생성한다. 에러 코드 세분화(`mapSubWorkflowError`)와 async 출력 보강은 additive 변경으로 위험도가 낮으나, executor 메시지 텍스트 의존 패턴 매칭은 장기 취약점이다. 의도된 호환성 무시(D-category) 마이그레이션이라도 무음 실패 경로에 대한 관찰 지점과 DB 데이터 마이그레이션 계획이 필요하다.

## 위험도

**HIGH** — 기존 저장 워크플로우 및 사용자 expression에 대한 무음 파괴 경로가 2개 이상 존재하며, 정상 실행처럼 보이지만 잘못된 결과를 반환할 수 있다.