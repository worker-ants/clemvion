# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Table 핸들러의 per-item 표현식 평가 구현에서 공유 가변 상태 오염, 레이어 경계 위반, 보안 취약점, 런타임 에러 전파 위험이 복합적으로 발견됨

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 부작용 / 동시성 / 보안 | `context.expressionContext`를 공유 가변 객체에 직접 변이(mutation). 노드 실행 완료 후 잔류하여 다음 노드로 컨텍스트가 누출될 수 있으며, 향후 병렬 실행 도입 시 race condition 유발 | `execution-engine.service.ts:578` | `context.expressionContext = exprContext` 대신 `nodeContext = { ...context, expressionContext: exprContext }`를 생성해 `handler.execute()`에 전달 |
| 2 | 아키텍처 / 의존성 | `TableHandler`가 `ExpressionResolverService`를 우회하여 `evaluate()`를 직접 호출. 표현식 평가 레이어 경계 위반으로 표현식 엔진 변경 시 두 곳을 동시에 수정해야 하는 결합도 발생 | `table.handler.ts:103`, `table.handler.ts:162` | `ExpressionResolverService`에 per-item 컨텍스트 주입 메커니즘(`resolveConfigPerItem`) 추가하여 표현식 해석 책임 서비스 레이어에 유지 |
| 3 | 아키텍처 / 부작용 / 보안 | 표현식 문자열(`{{ $sourceItem.first + " " + $sourceItem.last }}`)이 row 데이터의 key로 사용됨. 클라이언트가 이 key를 읽어야 한다면 API 계약이 표현식 문법에 종속 | `table.handler.ts:113-116` | `col.field` 대신 별도 `col.alias` 또는 인덱스 기반 key 사용하여 출력 데이터 구조를 구현 세부사항으로부터 분리 |
| 4 | 요구사항 / 보안 | 표현식 평가 실패(`evaluate()` 예외) 시 catch 없이 전체 노드 실행 중단. `{{ unclosed` 같은 잘못된 입력도 런타임까지 감지 안 됨 | `table.handler.ts:113-116`, `table.handler.ts:160-163` | `evaluate()` 호출을 try-catch로 감싸 `null` 또는 명시적 에러 반환. `validate()`에서 expression 패턴 감지 시 문법 간단 검증 추가 |
| 5 | 요구사항 | `validate()`에서 expression field/label 형식 검증 없음. 잘못된 표현식이 `execute()` 시점에 런타임 에러 발생 | `table.handler.ts:22-65` | validate 단계에서 `{{ }}` 패턴 감지 시 expression 파서 호출하여 문법 검증 수행 |
| 6 | 요구사항 | `resolveColumnLabels()`가 static 모드에서 label expression을 무시하고 원본 문자열 그대로 반환. static 모드의 label expression 지원 여부가 스펙에 미정의 | `table.handler.ts` — `resolveColumnLabels` | 스펙에서 static 모드의 label expression 지원 여부를 명확히 정의하거나, 지원하지 않는다면 명시적 주석 추가 |
| 7 | 보안 | `$dataSource` 전체 배열이 per-row 표현식 컨텍스트에 노출되어 `{{ $dataSource[0].$sensitiveField }}` 형태로 다른 행의 데이터에 접근 가능 | `table.handler.ts:103-109` | per-row 평가 시 `$dataSource` 전체 배열 대신 현재 항목 데이터만 컨텍스트에 포함하는 방향 검토 |
| 8 | 보안 | `escapeHtml()`에서 single quote(`'`) 이스케이프 누락. HTML attribute 컨텍스트에서 `'`가 사용될 경우 XSS 위험 | `table.handler.ts` — `escapeHtml` | `.replace(/'/g, '&#x27;')` 추가 |
| 9 | 성능 | `EXPRESSION_PATTERN.test(col.field)`가 `sourceArray.map()` 내부에서 컬럼 N × 행 M번 반복 실행. 컬럼 정의는 실행 중 불변임에도 O(N×M) 검사 발생 | `table.handler.ts` — `execute()` `sourceArray.map()` 내부 | map 루프 외부에서 컬럼별 표현식 여부를 `Set`으로 사전 분류 |
| 10 | 성능 / 유지보수성 | `execute()`와 `resolveColumnLabels()` 양쪽에서 `source`/`sourceArray` 계산 로직이 중복. 변경 시 두 곳을 동시에 수정해야 함 | `table.handler.ts:96-100`, `table.handler.ts:167-172` | `private resolveDataSource(config, input): unknown[]` 헬퍼로 추출 |
| 11 | 성능 | `resolveColumnLabels()`에서 `columns.some()` O(N) + `columns.map()` O(N)으로 이중 순회 | `table.handler.ts` — `resolveColumnLabels()` | 단일 `map`으로 합쳐 `hasExpr` 플래그를 함께 추적 |
| 12 | 유지보수성 | `renderHtml(resolvedColumns, originalColumns, rows)`에서 두 컬럼 파라미터의 역할(header용 vs. field key lookup용)이 시그니처만으로 파악 불가 | `table.handler.ts` — `renderHtml` | 파라미터명을 `displayColumns`/`fieldColumns`으로 변경하거나 인라인 주석 추가 |
| 13 | 의존성 | `expression-exclusions.ts`의 `table: columns` 추가와 `TableHandler` 직접 평가 간의 암묵적 결합. 어느 한쪽이 변경되면 전체 동작이 무너질 수 있음 | `expression-exclusions.ts:8` | 결합 관계를 주석으로 명시: `// columns expressions are evaluated per-item inside TableHandler` |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `expression-exclusions.ts` 변경에 대한 단위 테스트 부재 — table 노드의 `columns` 필드가 ExpressionResolverService를 건너뛰는 케이스 미검증 | `expression-exclusions.ts` | `ExpressionResolverService` 테스트에 해당 케이스 추가 |
| 2 | 테스트 | `evaluator.ts`에 추가된 `$dataSource`, `$sourceItem`, `$sourceItemIndex` 변수를 사용하는 표현식 평가 테스트 부재 | `evaluator.ts:38-40` | evaluator 단위 테스트에 신규 컨텍스트 변수 활용 케이스 추가 |
| 3 | 테스트 | `resolveColumnLabels()`의 dynamic 모드에서 label이 일반 문자열인 경우, label에 `{{ $dataSource.length }}` 표현식 사용 케이스 미검증 | `table.handler.ts:151-175` | 해당 분기 테스트 추가 |
| 4 | 테스트 | `renderHtml`에서 `<th>`는 resolved label, `<td>`는 original field key로 조회하는 비대칭 구조에 대한 HTML 렌더링 검증 테스트 부재 | `table.handler.ts:177-200` | label 표현식 포함 컬럼의 렌더링 결과(`<th>` vs `<td>`) 검증 테스트 추가 |
| 5 | 테스트 | `context.expressionContext`가 `nodeMap` 미존재 시 `undefined`가 되는 분기 미검증 | `execution-engine.service.ts:578` | `nodeMap` 없는 경우 fallback 동작(`?? {}`) 검증 테스트 추가 |
| 6 | 아키텍처 | `$dataSource`, `$sourceItem`, `$sourceItemIndex`를 공유 `ExpressionContext` 인터페이스에 직접 추가 — Table 전용 변수가 공유 인터페이스를 비대화할 우려 | `evaluator.ts:38-40` | `[key: string]: unknown` 인덱스 시그니처 활용하여 런타임 동적 주입하거나 핸들러별 확장 타입 별도 정의 고려 |
| 7 | 의존성 | `ExecutionContext.expressionContext`가 `Record<string, unknown>`으로 느슨하게 타입 지정되어 핸들러 내 `as EngineContext` 캐스팅 필요 | `node-handler.interface.ts:18` | `expressionContext?: ExpressionContext`로 타입 명시 |
| 8 | 보안 | `$env` 변수가 `ExpressionContext`에 포함될 경우 Table 노드 표현식으로 환경 변수 접근 가능 여부 미확인 | `evaluator.ts:30`, `execution-engine.service.ts` | `buildExpressionContext()`에서 `$env` 주입 여부 확인; 주입된다면 Table 노드 컨텍스트에서 제외 |
| 9 | 문서화 | `resolveColumnLabels`, `renderHtml` 파라미터 역할, `expression-exclusions.ts`의 table 추가 이유, `ExecutionContext.expressionContext` 용도, `ExpressionContext` 신규 3개 변수 용도에 대한 주석/JSDoc 부재 | 각 해당 위치 | 각 위치에 동작 조건 및 설계 의도 주석 추가 |
| 10 | 유지보수성 | `execute()` 메서드가 static 행 처리 → dynamic 행 처리 → 정렬 → 페이징 → label 해석 → HTML 렌더링까지 단일 메서드에 집중 | `table.handler.ts` — `execute()` | `buildDynamicRows(sourceArray, baseCtx, columns)` private 메서드로 분리 |
| 11 | 유지보수성 | `EXPRESSION_PATTERN = /\{\{/` 상수명이 역할을 충분히 드러내지 않음 | `table.handler.ts:14` | `HAS_EXPRESSION_TEMPLATE` 등 의도를 드러내는 이름으로 변경 |
| 12 | 요구사항 | `resolveColumnLabels`에서 label 표현식 평가 시 `$sourceItem` 미제공 — `{{ $sourceItem.fieldName }}`을 label에 사용하면 ReferenceError | `table.handler.ts:148-166` | label expression에서 `$sourceItem` 지원 여부를 스펙에 명시하거나, 지원 시 첫 번째 item 제공 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 표현식 문자열 직접 실행 컨텍스트 노출, escapeHtml single quote 누락, $env 접근 가능성 |
| architecture | MEDIUM | 공유 컨텍스트 변이, 레이어 경계 위반(evaluate 직접 호출), expression string이 row key로 노출 |
| requirement | MEDIUM | 표현식 평가 실패 미처리, validate에서 문법 검증 없음, static 모드 label 표현식 미지원 |
| side_effect | MEDIUM | 공유 context 오염, dataSource 중복 파싱, expression string이 row key |
| performance | LOW | O(N×M) 패턴 반복, baseCtx 스프레드 중복, 이중 순회, sourceArray 중복 계산 |
| maintainability | LOW | renderHtml 두 파라미터 혼용, dataSource 로직 중복, execute() 다중 책임 |
| testing | LOW | 6개 테스트 케이스 누락 (expression-exclusions, evaluator 변수, 분기 커버리지 등) |
| dependency | LOW | expression-exclusions와 TableHandler 간 암묵적 결합, expressionContext 느슨한 타입 |
| concurrency | LOW | 공유 context 변이로 향후 병렬 실행 시 race condition 잠재 위험 |
| api_contract | LOW | columns[].label이 evaluated 값으로 반환되는 변경 (의도된 개선) |
| documentation | LOW | 신규 메서드/필드/변수 전반의 JSDoc/주석 부재 |
| scope | NONE | 6개 파일이 일관된 목적 하에 수정됨, 불필요한 변경 없음 |
| database | NONE | 데이터베이스와 무관한 변경 |

---

## 발견 없는 에이전트

- **database** — 인메모리 처리 로직 변경으로 DB와 무관
- **scope** — 변경 범위가 명확하고 불필요한 코드 없음

---

## 권장 조치사항

1. **[즉시] `context.expressionContext` 공유 가변 상태 제거** — `{ ...context, expressionContext: exprContext }`를 `handler.execute()`에 직접 전달하도록 변경 (보안·동시성·부작용 위험 동시 해소)
2. **[즉시] 표현식 평가 실패 처리** — `evaluate()` 호출부 전체에 try-catch 추가, 실패 시 `null` 또는 명시적 에러 메시지 반환
3. **[즉시] `escapeHtml` single quote 누락 보완** — `.replace(/'/g, '&#x27;')` 추가
4. **[단기] expression field를 row key로 사용하는 설계 개선** — `col.alias ?? col.field` 또는 인덱스 기반 key로 API 계약 안정화
5. **[단기] `resolveDataSource` 헬퍼 추출** — `execute()`와 `resolveColumnLabels()` 간 중복 로직 제거
6. **[단기] O(N×M) 패턴 최적화** — map 루프 외부에서 컬럼별 expression 여부 사전 분류
7. **[단기] 누락 테스트 추가** — expression-exclusions 동작, evaluator 신규 변수, resolveColumnLabels 분기, renderHtml 비대칭 구조, 표현식 평가 실패 케이스
8. **[중기] `$dataSource` 컨텍스트 노출 최소화** — per-row 평가 시 필요 최소 컨텍스트만 노출하는 방향으로 검토
9. **[중기] static 모드 label expression 지원 여부 스펙 명확화** — 스펙 문서 및 코드 주석에 명시
10. **[중기] 문서화 보완** — `resolveColumnLabels`, `renderHtml`, `expression-exclusions.ts`, `ExecutionContext.expressionContext`, `ExpressionContext` 신규 변수에 주석/JSDoc 추가