### 발견사항

- **[INFO]** `static` 모드 rows에 내부 `id` 필드 노출
  - 위치: `presentation-configs.tsx` — `addRow()`, `table.handler.ts` — `execute()` static 분기
  - 상세: 프론트엔드에서 행 관리용으로 추가한 `{ id: ++tableRowId }` 필드가 config에 저장되고, 백엔드 static 모드에서는 `config.rows`를 그대로 `dataRows`로 사용하므로, 실행 결과의 `rows` 배열에 `id: number` 필드가 포함되어 출력됨. 이 내부 키가 소비 측(렌더러, 다운스트림 노드)에서 노출될 수 있음.
  - 제안: 백엔드 static 분기에서 `id` 필드를 제거하거나, 프론트엔드에서 저장 전 `id` 제거; 또는 `TableRow` 인터페이스를 프론트엔드 전용으로 유지하고 저장 직전에 `id`를 strip.

- **[INFO]** `dataSource` 검증 누락
  - 위치: `table.handler.ts` — `validate()`
  - 상세: dynamic 모드에서 `dataSource`가 존재할 경우 형식(문자열 표현식 또는 배열)에 대한 검증이 없음. 현재는 `config.dataSource != null` 이면 그대로 사용하므로 잘못된 타입이 들어와도 조용히 무시됨.
  - 제안: 엄격한 검증이 필요하다면 `dataSource`가 string 또는 배열인지 확인하는 검증 추가. 현재 아키텍처상 표현식 해석이 상위 레이어에서 처리된다면 INFO 수준으로 유지.

- **[INFO]** `execute()` 시그니처 변경 (`async` 제거) — 인터페이스 계약 유지 확인
  - 위치: `table.handler.ts:44`
  - 상세: `async execute(...)` → `execute(...): Promise<unknown>`로 변경. `NodeHandler` 인터페이스가 `Promise<unknown>` 반환을 요구한다면 문제없으나, 인터페이스 정의에서 `async` 여부를 암시하는 경우 혼선 가능. 기능적으로는 동일.
  - 제안: `NodeHandler` 인터페이스 시그니처와 일치하는지 확인. 현재 코드는 `Promise.resolve()`로 래핑되어 있어 계약상 문제없음.

- **[INFO]** `tableSummary` 출력 형식 변경 (소비 측 호환성)
  - 위치: `node-config-summary.ts:182–192`
  - 상세: `"3 columns · pagination"` → `"dynamic · 3 columns · pagination"`으로 형식 변경. 이 문자열을 파싱하거나 스냅샷으로 비교하는 코드가 있다면 breaking change. 테스트는 이미 갱신되어 있음.
  - 제안: UI 표시 전용이라면 문제없음. 외부로 직렬화되거나 API 응답에 포함되는 경우 버전 고려 필요.

---

### 요약

이번 변경은 HTTP REST 엔드포인트가 아닌 내부 실행 엔진 핸들러(`NodeHandler` 인터페이스)와 프론트엔드 설정 컴포넌트에 대한 수정으로, API 계약 관점에서 실질적인 breaking change는 없다. `mode` 기본값을 `dynamic`으로 설정하여 기존 설정과의 하위 호환성을 유지하고, 출력 구조(`type/columns/rows/totalRows/rendered`)도 보존되었다. 다만 static 모드에서 프론트엔드 내부 관리용 `id` 필드가 실행 결과 `rows`에 포함되어 다운스트림으로 노출되는 점이 미세한 계약 오염 요인이며, 이를 백엔드에서 필터링하는 것이 권장된다.

### 위험도

**LOW**