# 유지보수성(Maintainability) 리뷰 결과

**대상 커밋**: Cafe24 조건부 필수(`constraints`) — backend 구현 (Phase B)
**리뷰어**: Maintainability Sub-agent

---

## 발견사항

### 가독성 / 네이밍

- **[INFO]** `constraintToSuffixLine` 함수 내 `implies` 분기 — fall-through 처리
  - 위치: `cafe24-mcp-tool-provider.ts` `constraintToSuffixLine()` 마지막 분기
  - 상세: `oneOf` · `allOrNone` 를 명시적 `if` 로 처리하고 `implies` 는 주석(`// implies`) 하나로 fall-through. 세 `kind` 가 대등한 discriminated union 임에도 `implies` 만 암묵적 처리여서, 향후 네 번째 `kind` 가 추가될 때 런타임 버그 없이 통과될 수 있다.
  - 제안: `else if (c.kind === 'implies')` 로 명시하고, 마지막에 TypeScript exhaustive check(`c satisfies never`를 반환하는 형태 또는 `throw new Error(...)`)를 추가.

- **[INFO]** `checkOne` 함수도 동일한 fall-through 패턴
  - 위치: `constraint-validator.ts` `checkOne()` 마지막 분기
  - 상세: `// implies` 주석 후 암묵 fall-through. `constraintToSuffixLine` 과 동일 문제. 두 함수가 서로 다른 파일에서 같은 패턴을 반복하므로 향후 `kind` 확장 시 두 곳 모두 수정해야 한다.
  - 제안: 마찬가지로 명시적 `else if (c.kind === 'implies')` + exhaustive guard.

- **[INFO]** `buildToolDescription` 에서 `op` 파라미터명이 다른 문맥(`buildJsonSchema(op)`)과 동일하나 private 메서드에서는 `op`, 외부 export 함수에서도 `op` — 일관성은 유지됨. 단, `Cafe24OperationMetadata` 를 받는 함수들이 `op` · `operation` · `spec` 등 다양한 이름을 사용하는 경향이 보임 (`checkOne(c, fields)` 의 경우 `c` 는 짧지만 제약 루프 안에서 명확하다).
  - 위치: 여러 함수
  - 제안: 큰 문제는 아니나 `operation` / `op` 두 이름 중 하나로 파일 단위 통일 권장 (현재 `buildToolDescription(op, ...)` 은 `op`, `checkOne(c, fields)` 는 `c` — 각각 단일 함수 범위 내 명확함).

---

### 함수 길이 / 책임 분리

- **[INFO]** `buildJsonSchema` 내 `allOf` / `anyOf` 조합 로직이 함수 내부에 인라인 처리됨
  - 위치: `cafe24-mcp-tool-provider.ts` `buildJsonSchema()` 내 라인 ~666–694
  - 상세: 프로퍼티 빌드 루프 + `required`/`allOf` 조합 두 책임이 동일 함수에 있다. 현재 함수 길이(~55줄)는 과도하지 않고, 주석으로 두 단계가 명확히 구분돼 있어 즉각 리팩터링이 필요한 수준은 아니다. 다만 `buildSchemaRequired(op)` 같은 서브 헬퍼로 분리하면 `buildJsonSchema` 자체 테스트가 더 단순해진다.
  - 제안: 현재는 INFO 수준. 향후 `allOrNone` 나 `implies` 의 JSON Schema 변환이 추가될 경우 별도 함수로 분리 권장.

- **[INFO]** `buildToolDescription` 과 `constraintToSuffixLine` 의 분리 — 긍정 평가
  - 위치: `cafe24-mcp-tool-provider.ts` 라인 ~753–788
  - 상세: 두 함수 모두 단일 책임을 명확히 갖는다. `export` 처리로 테스트 용이성을 확보한 것도 좋은 결정.

---

### 중첩 깊이

- **[INFO]** `metadata.spec.ts` invariant 테스트 — 3단 중첩 (`for operation` → `for constraint` → `for field`)
  - 위치: `metadata.spec.ts` 신규 it 블록 라인 ~1071–1117
  - 상세: `listAllCafe24Operations()` → `operation.constraints.entries()` → `c.fields` 3단 루프. 현재 중첩이 허용 범위 내이고 위반 메시지를 `violations[]` 배열로 누적하는 패턴은 오류 가독성 측면에서 좋다. 단, 루프 내 `if/else if` 분기까지 더해지면 인지 부하가 늘어난다.
  - 제안: `validateConstraint(label, idx, c, fieldNames, violations)` 등 헬퍼 함수로 분기 로직 추출 가능. 현재는 INFO 수준.

---

### 매직 넘버 / 매직 문자열

- **[INFO]** `'CAFE24_MISSING_FIELDS'` 문자열 리터럴이 두 파일에 중복 하드코딩
  - 위치: `cafe24.handler.ts` 라인 ~408, `cafe24-mcp-tool-provider.ts` 라인 ~209
  - 상세: 두 경로 모두 같은 오류 코드를 독립적으로 문자열 리터럴로 사용한다. 현재 코드베이스에 `CAFE24_MISSING_FIELDS` 가 상수로 정의된 모듈이 없는 것으로 보인다. 오타나 리팩터링 시 한 곳만 변경될 위험이 있다.
  - 제안: `cafe24-error-codes.ts` 같은 상수 모듈 또는 `constraint-validator.ts` 에 `export const CAFE24_MISSING_FIELDS_CODE = 'CAFE24_MISSING_FIELDS'` 정의 후 두 호출 지점에서 import. 지금은 INFO 수준이나 오류 코드가 더 늘어나면 WARNING 으로 격상.

- **[INFO]** `constraint-validator.ts` 오류 메시지에 `constraint violated:` 접두어 고정 문자열 인라인 반복
  - 위치: `constraint-validator.ts` `checkOne()` 내 세 분기 return 문
  - 상세: 세 return 문 모두 `"constraint violated: ..."` 로 시작한다. 접두어가 고정이므로 공통 헬퍼(`formatViolation(kind, ...)`)나 접두어 상수(`const CONSTRAINT_VIOLATED_PREFIX = 'constraint violated: '`)로 추출 가능. 현재는 중복이 3회에 불과해 허용 범위.
  - 제안: INFO 수준. 필요 시 경량 헬퍼 추출.

---

### 중복 코드

- **[WARNING]** 두 테스트 파일(`cafe24-mcp-tool-provider.spec.ts`, `cafe24.handler.spec.ts`)에서 `{ config: {}, workspaceId: 'ws-1', executionId: 'exec-1' }` 인라인 반복
  - 위치: `cafe24-mcp-tool-provider.spec.ts` 신규 `execute` 테스트 두 곳 (라인 ~123, ~150)
  - 상세: 동일 context literal 이 신규 테스트 두 곳에 직접 인라인으로 작성되었다. 기존 파일 내에 동일 패턴이 이미 여러 번 반복되고 있는지 확인이 필요하나, diff 범위 내에서만 봐도 두 곳이 동일하다.
  - 제안: `const DEFAULT_EXEC_CTX = { config: {}, workspaceId: 'ws-1', executionId: 'exec-1' }` 처럼 상수로 추출하거나, 기존 테스트 유틸 헬퍼가 있다면 그것을 사용. 테스트 유지보수성 향상.

- **[INFO]** `buildTools` 호출 인자(`{ config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] }, workspaceId: 'ws-1', executionId: 'exec-1' }`)가 신규 테스트 두 곳에 동일하게 반복
  - 위치: `cafe24-mcp-tool-provider.spec.ts` 라인 ~42–48, ~89–96
  - 상세: 두 신규 `it` 블록 모두 `integrationsService.getForExecution.mockResolvedValue(makeIntegration())` + `provider.buildTools({...})` 를 동일하게 호출한다. 기존 파일에 `setup()` 패턴이 있는 것으로 보이는데, `buildTools` 용 공통 setup 함수가 없으면 추출 권장.
  - 제안: `beforeEach` 또는 별도 헬퍼로 추출 가능. 현재는 INFO 수준.

---

### 코드 복잡도

- **[INFO]** `buildJsonSchema` 의 `allOf` 조합 분기 — 순환 복잡도 낮음
  - 위치: `cafe24-mcp-tool-provider.ts` `buildJsonSchema()` 라인 ~684–694
  - 상세: `oneOfConstraints.length === 0` 분기 + `requiredClause` null 체크로 4가지 경우를 커버한다. 단순 이진 중첩이라 순환 복잡도 낮음. 주석이 각 케이스를 명확히 설명한다.

- **[INFO]** `checkOne` 함수 — `allOrNone` 분기에서 `present` 배열을 구한 뒤 `missing` 배열을 별도로 다시 필터링
  - 위치: `constraint-validator.ts` `checkOne()` 라인 ~55–59
  - 상세: `present` 와 `missing` 을 각각 `filter` 로 2회 순회한다. 필드 수가 적어 성능 문제는 없으나, `reduce` 한 번으로 두 배열을 동시에 추출하면 더 명시적이다. 현재 가독성에는 문제없음.
  - 제안: 선택 사항. INFO 수준.

---

### 일관성

- **[INFO]** `constraintToSuffixLine` vs `checkOne` 의 오류 메시지 — 동일 제약에 대해 사용자 노출 문구가 다름
  - 위치: `cafe24-mcp-tool-provider.ts` `constraintToSuffixLine`, `constraint-validator.ts` `checkOne`
  - 상세: LLM description suffix 는 `"Constraint: at least one of member_id, group_no, since must be provided."` 형태인 반면, runtime 위반 메시지는 `"constraint violated: oneOf [member_id, group_no, since] requires at least one of these fields to be provided"` 형태다. 동일 의미를 두 가지 어조로 표현하는 것은 의도적 분리(description은 LLM용, 오류 메시지는 디버그용)로 보이나, spec §2 표에 각 채널별 문구가 명시돼 있다면 일관성 보장이 필요하다.
  - 제안: 현재는 채널이 다르므로 INFO 수준. spec §2 표의 정확한 문구가 변경될 경우 두 곳을 모두 수정해야 함을 주석 또는 링크로 명시 권장.

- **[INFO]** `constraintToSuffixLine` 의 `export` 노출 — 동일 파일의 `buildToolDescription` 도 `export`
  - 위치: `cafe24-mcp-tool-provider.ts`
  - 상세: 두 함수를 모두 `export` 로 노출한 것은 테스트 용이성을 위한 의도적 결정으로 보이며, 일관성 있다.

---

## 요약

이번 변경은 `Cafe24FieldConstraint` discriminated union 신설, 공유 validator 분리, 두 실행 경로(handler / MCP tool-provider)에 동일 헬퍼 적용, JSON Schema `anyOf` 변환이라는 명확한 단일 관심사를 구현한다. 전반적으로 코드 구조가 명확하고 함수 분리가 적절하며, 주요 설계 결정(first-violation-only 반환, `CAFE24_MISSING_FIELDS` 코드 재사용, `allOrNone`/`implies` 의 JSON Schema 미변환)에 대한 주석이 충실하다. 주요 개선 여지는 (1) `implies` 분기의 암묵적 fall-through 처리(`constraintToSuffixLine`, `checkOne` 양쪽), (2) `'CAFE24_MISSING_FIELDS'` 문자열의 두 파일 중복 하드코딩, (3) 테스트 내 context literal 중복 세 가지이며, 모두 WARNING/INFO 수준으로 즉각 차단이 필요하지는 않다.

---

## 위험도

LOW
