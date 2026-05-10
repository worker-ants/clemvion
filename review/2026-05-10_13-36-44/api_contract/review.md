### 발견사항

---

- **[CRITICAL]** Sync 모드 출력 형식 파괴적 변경 (Breaking Change)
  - 위치: `workflow.handler.ts`, `workflow.schema.ts`, `spec/4-nodes/2-flow/1-workflow.md §5.1`
  - 상세: `output: <sub-workflow output>` → `output: { result: <sub-workflow output> }` 로 1단 래핑됨. 기존에 `$node["X"].output.<field>` 로 접근하던 모든 다운스트림 워크플로우 expression 이 즉시 `undefined` 반환. 저장된 워크플로우 데이터(DB)를 마이그레이션 없이 변경하는 zero-notice breaking change.
  - 제안: 버전 플래그(`outputVersion: 2`) 또는 피처 플래그로 단계적 롤아웃. 최소한 migration guide와 함께 major version bump 필요. 기존 표현식 자동 변환 스크립트 또는 호환성 어댑터 고려.

---

- **[CRITICAL]** `mappingDefSchema` 필드명 파괴적 변경 (`target`/`source` → `paramName`/`expression`)
  - 위치: `workflow.schema.ts:9-26`
  - 상세: 이미 저장된 워크플로우 config JSON에 `target`/`source` 키를 가진 `inputMapping` 항목이 있으면, 핸들러가 `paramName`/`expression` 을 읽으므로 `subInput = { undefined: value }` 가 된다. DB에 저장된 모든 기존 워크플로우가 즉시 broken.
  - 제안: DB migration으로 기존 `inputMapping` 레코드의 키를 일괄 변환하거나, 핸들러에서 `paramName ?? target`, `expression ?? source` 폴백 읽기를 임시 지원한 뒤 제거.

---

- **[WARNING]** Async 모드 `meta.status` 제거 (Breaking Change)
  - 위치: `workflow.handler.ts:101-108`, spec `§5.2`
  - 상세: 이전 응답: `meta: { status: 'started' }` → 신규 응답: `status: 'started'` (top-level). `meta.status` 를 읽던 모든 클라이언트/다운스트림 expression(`$node["X"].meta.status`)이 `undefined` 반환. `output.status` 추가와 top-level `status` 추가는 additive이지만, `meta.status` **제거**는 destructive.
  - 제안: 릴리즈 기간 동안 `meta.status` 를 deprecation 경고와 함께 유지(`meta: { status: 'started', _deprecated: true }`)하거나, 전체 워크플로우 expression 일괄 마이그레이션 후 제거.

---

- **[WARNING]** 에러 코드 매핑이 executor 메시지 문자열 패턴 매칭에 의존
  - 위치: `workflow.handler.ts:198-218` (`mapSubWorkflowError`)
  - 상세: `"Workflow not found"`, `"timed out"`, `"queue"` 등 executor가 던지는 예외 메시지를 문자열 패턴으로 분류. executor 구현이 메시지 문자열을 변경하면 (예: `"workflow 'X' was not found"` 로 변경) 잘못된 에러 코드가 API 응답에 노출되는 계약 위반. 현재 계약이 executor 구현 내부에 암묵적으로 결합됨.
  - 제안: executor 가 구조화된 에러 타입(`WorkflowNotFoundError`, `WorkflowTimeoutError` 등)을 throw 하도록 인터페이스를 수정하고, `mapSubWorkflowError` 대신 `instanceof` 분기로 전환. 주석에도 이 임시 접근법의 한계를 명시(`// TODO: remove once executor throws typed errors`).

---

- **[WARNING]** `workflowNodeOutputSchema` 가 `meta` 필드를 여전히 포함
  - 위치: `workflow.schema.ts:48-56`
  - 상세: 핸들러에서 async 응답의 `meta.status` 를 제거했지만 `workflowNodeOutputSchema` 의 `meta: z.object({ status: z.string().optional() })` 는 그대로 남아 있음. 스키마와 실제 핸들러 반환값 간 불일치 — 스키마가 제거된 필드를 여전히 허용하는 것으로 문서화됨.
  - 제안: `meta` 필드를 스키마에서 제거하거나, async 케이스에서만 `status` 를 top-level에 추가하는 union 타입으로 정교화.

---

- **[INFO]** 신규 에러 코드 추가 (`SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED`) — Additive
  - 위치: `error-codes.ts:38-41`
  - 상세: 기존 `SUB_WORKFLOW_FAILED` 를 fallback으로 유지하므로, 에러 코드를 `switch`/`if` 로 구분하지 않는 기존 클라이언트는 영향 없음. 단, 에러 포트에서 `code === 'SUB_WORKFLOW_FAILED'` 를 전수 조건으로 쓰는 클라이언트는 새 코드를 미처리하게 되므로 주의 안내 필요.
  - 제안: 릴리즈 노트에 "에러 포트 핸들러는 알 수 없는 코드를 graceful하게 처리해야 합니다" 가이드 추가.

---

- **[INFO]** 문서(`flow.en.mdx`, `flow.mdx`) 와 spec(`1-workflow.md`) 이 코드 변경과 일관되게 갱신됨
  - 위치: 모든 문서 파일
  - 상세: Expression 접근 경로, 필드명, 에러 코드표가 핸들러 구현과 정합. API 계약 문서화 측면에서 긍정적.

---

### 요약

이번 변경은 Sub-Workflow 노드의 출력 계약을 세 가지 방향으로 동시에 변경한다: **(1)** sync 출력의 1단 래핑(`output.result`), **(2)** async 출력에 `workflowId`/`status` 추가 및 `meta.status` 제거, **(3)** `inputMapping` 스키마 키 재명명(`target`→`paramName`, `source`→`expression`). 세 변경 모두 이미 저장된 워크플로우 데이터 및 다운스트림 expression에 즉각적인 파괴적 영향을 준다. plan 문서에 "호환성 무시" 정책이 명시되어 있으나, 이는 DB 마이그레이션 없는 키 변경·출력 구조 변경이 실제 운영 환경에서 silent breakage를 유발할 수 있음을 의미한다. 에러 코드 세분화(A-3)와 신규 필드 추가는 additive이므로 계약 측면에서 양호하나, `mapSubWorkflowError` 의 문자열 패턴 매칭은 executor 구현과의 암묵적 결합을 도입하여 장기적 계약 안정성을 해친다.

### 위험도
**HIGH**