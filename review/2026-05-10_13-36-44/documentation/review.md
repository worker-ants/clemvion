### 발견사항

---

- **[CRITICAL]** `spec/4-nodes/2-flow/1-workflow.md` §5.3 JSON 예시의 에러 코드 불일치
  - 위치: `spec/4-nodes/2-flow/1-workflow.md`, §5.3 JSON 예시 블록
  - 상세: 예시의 `message` 가 `"Workflow not found: wf_uuid_9999"` 인데 `code` 는 여전히 `"SUB_WORKFLOW_FAILED"` 로 남아 있음. `mapSubWorkflowError` 구현에 따르면 이 메시지는 `SUB_WORKFLOW_NOT_FOUND` 로 매핑됨. 스펙과 구현이 모순되며, 독자가 실제 동작을 잘못 이해할 수 있음.
  - 제안: JSON 예시의 `code` 를 `"SUB_WORKFLOW_NOT_FOUND"` 로 수정하거나, 일반 fallback 케이스를 보여주려면 `message` 를 `"Node \"Transform\" exceeded maximum iteration count"` 같은 non-matching 메시지로 교체.

---

- **[WARNING]** `workflow.schema.ts` `workflowNodeOutputSchema` 에 스테일 `meta.status` 필드 잔존
  - 위치: `workflow.schema.ts`, `workflowNodeOutputSchema` — `meta` 객체 정의
  - 상세: 핸들러는 async 모드에서 `meta.status: 'started'` 를 더 이상 반환하지 않고 top-level `status: 'started'` 로 이동함. 그런데 출력 스키마의 `meta` 객체에는 `status: z.string().optional()` 가 그대로 남아 있어, 스키마 주석(`meta.status` 폐기)과 스키마 본문이 상충함. 미래 개발자가 `meta.status` 가 유효한 출력인 것으로 오해할 수 있음.
  - 제안: `workflowNodeOutputSchema` 의 `meta` 블록에서 `status` 필드를 제거하거나, 제거하지 않을 이유(후방 호환 파싱 등)가 있다면 주석으로 명시.

---

- **[WARNING]** 테스트 설명과 인라인 주석에 내부 작업 추적 ID 하드코딩
  - 위치:
    - `workflow.handler.spec.ts`: `'(D-1)'`, `'(A-2)'`, `'(A-3 code mapping)'` 포함 test/describe 명
    - `workflow.handler.ts`: `// D-1 —`, `// A-3 —` 주석
    - `error-codes.spec.ts`: `// Sub-workflow specific codes added in Phase 1 A-3.`
  - 상세: `A-2`, `A-3`, `D-1`, `Phase 1` 같은 플래닝 문서 태그가 테스트 이름과 소스 코드 주석에 직접 박혀 있음. 이 태그들은 `plan/` 문서와만 연결되며, 플랜이 `complete/` 로 이동하거나 삭제되면 의미를 잃고 그냥 노이즈가 됨.
  - 제안: 테스트 이름에서 `(A-2)`, `(D-1)` 등 제거하고, 주석은 **왜** 이 동작이 선택되었는지로 대체. 예: `// D-1 — sync result wrapped under output.result` → `// Wrapped so downstream access path is uniform regardless of sub-workflow output shape`.

---

- **[INFO]** 영문 / 한국어 사용자 문서에 async top-level `status` 접근 예시 누락
  - 위치: `flow.en.mdx` 및 `flow.mdx` — async 모드 예시 섹션
  - 상세: async 예시에서 `out port output` 을 보여주며 `output.status`, `output.workflowId` 는 설명하지만, top-level `status: 'started'` 필드와 `$node["X"].status` 접근 경로는 언급되지 않음. 스펙 문서(§5.2)에는 있지만 end-user 문서에는 빠져 있어 사용자가 이 필드를 발견하기 어려움.
  - 제안: 양쪽 MDX 의 async 예시 블록 또는 Tips & notes 섹션에 `$node["X"].status` 접근 예시 한 줄 추가.

---

- **[INFO]** `mapSubWorkflowError` JSDoc — 임시 구현임을 명시했으나 후속 추적 근거 없음
  - 위치: `workflow.handler.ts`, `mapSubWorkflowError` JSDoc
  - 상세: `"until the executor exposes a structured error type"` 로 임시 패턴매칭임을 잘 기술했지만, 언제/어떤 조건에서 제거해야 하는지 추적할 이슈/TODO 링크가 없음. 시간이 지나면 이 코드가 영구 코드가 될 위험이 있음.
  - 제안: JSDoc 에 `TODO: remove pattern-matching once WorkflowExecutor throws a typed error` 한 줄 추가, 또는 `plan/` 에 후속 항목으로 기록.

---

### 요약

전반적으로 문서화 품질은 높습니다. spec, MDX 사용자 문서, 소스 코드 주석, 테스트 설명이 구현 변경에 맞춰 일관되게 갱신되었고, `mapSubWorkflowError` 의 설계 의도도 잘 설명되어 있습니다. 주요 개선 과제는 두 가지입니다: (1) spec §5.3 JSON 예시가 `"Workflow not found"` 메시지와 `SUB_WORKFLOW_FAILED` 코드를 함께 보여줘 구현과 직접 모순되는 점, (2) 플랜 단계 태그(`A-2`, `D-1`)가 테스트 이름과 소스 주석에 박혀 있어 플랜 문서가 archiving 되면 컨텍스트 없이 남는 점입니다.

### 위험도

**MEDIUM** (CRITICAL 이슈 1건 — spec 예시와 구현 간 직접 모순)