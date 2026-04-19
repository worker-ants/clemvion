### 발견사항

---

**[CRITICAL] send-email.handler.ts — 양 분기가 동일 값을 반환하는 dead code**
- 위치: `send-email.handler.ts`, `buildSubWorkflowError` 직전 `code` 변수 선언부
- 상세:
  ```typescript
  const code =
    err instanceof IntegrationError
      ? 'EMAIL_SEND_FAILED'
      : 'EMAIL_SEND_FAILED';
  ```
  `IntegrationError` 여부와 무관하게 동일 값을 반환합니다. 원래 의도는 `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE` 등 통합 오류 코드를 구분하려 했던 것으로 보입니다. 현재 코드는 오류 코드 체계를 파괴하며, `details.integrationCode` 에 넣은 값이 관찰성 대시보드에서 실제로 쓸모 없어집니다.
- 제안:
  ```typescript
  const code = err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED';
  ```

---

**[WARNING] send-email.handler.ts / output-shape.ts 등 — 에러 코드 상수 중앙화 없음**
- 위치: `http-request.handler.ts`, `code.handler.ts`, `send-email.handler.ts`, `workflow.handler.ts`, `database-query.handler.ts`, `text-classifier.handler.ts`
- 상세: `'HTTP_4XX'`, `'HTTP_5XX'`, `'HTTP_TRANSPORT_FAILED'`, `'SUB_WORKFLOW_FAILED'`, `'EMAIL_SEND_FAILED'`, `'CODE_TIMEOUT'`, `'CODE_EXECUTION_FAILED'`, `'DB_QUERY_FAILED'`, `'LLM_CALL_FAILED'` 등이 핸들러마다 문자열 리터럴로 흩어져 있습니다. 한 곳에서 오타가 생기거나 rename이 필요할 때 전체를 수동으로 찾아야 합니다.
- 제안: `backend/src/nodes/core/error-codes.ts` 에 `export const NodeErrorCode = { ... } as const` 형태의 enum-like 객체를 두고 핸들러에서 임포트하여 사용.

---

**[WARNING] code.handler.ts — 인라인 에러 코드 정규화 로직의 불투명성**
- 위치: `code.handler.ts`, `buildErrorReturn` 내 `normalizedCode` 블록
- 상세:
  ```typescript
  const normalizedCode =
    errorCode === 'EXECUTION_TIMEOUT'
      ? 'CODE_TIMEOUT'
      : errorCode === 'CODE_RUNTIME_ERROR' || errorCode === 'CODE_SYNTAX_ERROR'
        ? 'CODE_EXECUTION_FAILED'
        : errorCode;
  ```
  매핑 의도가 코드에서 보이지 않고, `errorCode`가 다른 값일 경우 정규화 없이 그대로 통과되어 일관성이 깨집니다. 외부 계약(`meta.errorCode`)과 내부 `output.error.code` 간 이중 코드 체계가 병존합니다.
- 제안: `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` 매핑을 `const CODE_MAP` lookup으로 분리하거나, 에러 코드 상수 모듈에서 일관된 집합을 정의.

---

**[WARNING] conversation-utils.ts / output-shape.ts / conversation-inspector.tsx — 중복 fallback 패턴 미추상화**
- 위치: 세 파일 전반
- 상세: `output.result.X ?? output.X` 형태의 이주 전/후 호환 fallback이 각 파일에 개별적으로 작성되어 있습니다. 신규 필드가 이주될 때마다 세 곳을 각자 수정해야 합니다. 특히 `messages`, `turnCount`, `endReason`, `metadata` 가 동일 패턴으로 세 파일에 반복됩니다.
- 제안: `output-shape.ts` 에 `resolveResultField(output, key)` 헬퍼를 두고 세 파일이 공유.

---

**[WARNING] presentation handlers (carousel/chart/table/template) — `durationMs: 0` 하드코딩**
- 위치: `carousel.handler.ts:244`, `chart.handler.ts:89`, `table.handler.ts:181`, `template.handler.ts:47`
- 상세: `meta: { interactionType: 'buttons', durationMs: 0 }` 처럼 `0`이 고정값으로 삽입되어 있습니다. 실제 핸들러 실행에는 시간이 소요되며, 이 값은 관찰성 도구에서 잘못된 인상을 줍니다. 같은 이유로 `form.handler.ts`도 동일 패턴입니다.
- 제안: 핸들러 진입 시 `const startedAt = Date.now()` 를 찍고 반환 시 `durationMs: Date.now() - startedAt` 를 사용. 또는 waiting tick은 의도적으로 `0`임을 주석으로 명시.

---

**[WARNING] handler-output.adapter.ts — 주석과 실제 동작 불일치**
- 위치: `handler-output.adapter.ts` bare object 분기 직전 주석
- 상세: "Test fixtures and a handful of one-off mock handlers still return bare objects / primitives. Production handlers are type-checked against `NodeHandlerOutput`; this branch is effectively reached only by legacy test doubles." 라고 쓰여 있으나, 동일 분기에서 `_resumeState` 를 프로덕션 경로에 필요한 방식으로 lift합니다. 주석이 독자를 오도합니다.
- 제안: "Production multi-turn handlers that emit bare objects (e.g. waiting response) also rely on this path for `_resumeState` lifting" 으로 주석 수정.

---

**[WARNING] output-shape.ts — `extractIeSnapshot` 함수의 높은 순환 복잡도**
- 위치: `output-shape.ts`, `extractIeSnapshot` 함수
- 상세: 함수 하나에서 `partial` top-level 확인 → `output.partial` 확인 → `convConfig.extracted` 확인 → `output.result.extracted` 확인 → `output.extracted` 확인의 5개 분기를 순차 처리합니다. 분기별 리턴이 빠르고 가독성은 유지되나, 새 fallback 경로 추가 시 복잡도가 누적됩니다.
- 제안: 각 fallback 경로를 이름 있는 헬퍼(`tryExtractFromPartial`, `tryExtractFromConvConfig`, `tryExtractFromFinalised`)로 분리.

---

**[INFO] ai-agent.handler.ts — 인라인 `// CONVENTIONS §N` 주석의 과용**
- 위치: `ai-agent.handler.ts`, 여러 반환문 직전
- 상세: `// CONVENTIONS §8`, `// CONVENTIONS §4.3` 등의 참조가 코드 여러 곳에 분산되어, 스펙 문서 없이는 의미 파악이 불가합니다. 코드 자체가 이미 구조를 나타내는데 중복 설명이 됩니다.
- 제안: 핸들러 클래스 상단 JSDoc에 한 번만 참조하고, 인라인에서는 비자명한 이유가 있을 때만 주석을 남김.

---

**[INFO] 테스트 서술 스타일 불일치**
- 위치: `form.handler.spec.ts` (변경분에서 should → 동사형으로 변환), `workflow.handler.spec.ts` (설명형으로 변환), 나머지 spec 파일은 여전히 `should` 사용
- 상세: 이번 변경에서 일부 테스트는 `should` 접두사를 제거했으나 다른 파일들은 그대로입니다.
- 제안: 스타일 통일 여부를 결정 후 일괄 적용(또는 기존 스타일 유지).

---

### 요약

이번 변경은 노드 출력 구조를 `{ config, output, meta, port, status }` 통합 계약으로 이주하는 대규모 리팩터링으로, 방향성과 설계는 명확하고 이주 전략(fallback 유지)도 의도적입니다. 다만 `send-email.handler.ts`의 `code` 변수 dead branch는 에러 코드 체계를 실질적으로 파괴하는 버그이며 즉시 수정이 필요합니다. 그 외 에러 코드 상수 분산, 이주 fallback 패턴의 3중 복제, `durationMs: 0` 하드코딩은 이 규모의 리팩터링에서 예상 가능한 기술 부채이지만, 이주가 완료되면 정리가 필요한 항목들입니다.

### 위험도

**MEDIUM** (CRITICAL 버그 1건 포함, 나머지는 이주 중 발생하는 유지보수성 부채)