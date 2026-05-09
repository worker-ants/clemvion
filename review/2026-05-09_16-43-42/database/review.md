## 발견사항

- **[WARNING]** `rendered` HTML이 캡 적용 전 전체 배열에서 생성됨
  - 위치: `carousel.handler.ts` — `renderHtml(items, layout)` 호출 후 `truncateArrayForOutput` 적용 / `table.handler.ts` — `renderHtml(resolvedColumns, columns, dataRows)` 호출 후 `cappedRows` 적용
  - 상세: `rendered`는 full `items`/`dataRows`로 먼저 생성되고, 이후에 `cappedItems`/`cappedRows`가 계산된다. 6개 × 200KB 아이템이면 `items`는 1MB 이하로 잘리지만 `rendered` HTML은 ~1.2MB+ 그대로 `NodeExecution.outputData` JSONB에 기록된다. spec은 "items/rows가 잘리면 rendered도 자동으로 작아진다"고 기술하지만 구현은 그렇지 않다 — rendered는 캡 이전 전체 배열 기반으로 만들어진다.
  - 제안: `rendered = this.renderHtml(cappedItems.value, layout)` 순서로 변경하거나, `rendered`에도 `truncateBodyForOutput`을 적용해 JSONB 기록 전 크기를 보장한다. 또는 렌더링 자체를 capped 배열에서 수행하도록 순서를 `truncateArrayForOutput` → `renderHtml` 로 바꾼다.

- **[INFO]** `rawConfig`가 `MultiTurnState` JSONB에 중복 저장될 수 있음
  - 위치: `information-extractor.handler.ts:305` `stateBase.rawConfig`, `execution-engine.service.ts:1838` (resume 시 engine이 node.config를 rawConfig로 merge)
  - 상세: 핸들러가 직접 `stateBase.rawConfig = context.rawConfig ?? config`를 설정하고, 엔진도 첫 waiting tick 시 `rawConfig`를 `resumeState`에 merge한다. 두 경로가 모두 동일 키에 쓰면, 첫 turn이 ended 경로(waiting tick 없이 종료)에서는 handler 설정값만, resumed 경로에서는 engine merge값이 덮어쓴다. 이 자체는 기능적으로 안전하지만 JSONB state 컬럼에 rawConfig가 두 번 기록되는 경우 불필요한 space가 생길 수 있다.
  - 제안: 현재 구현 의도(초기 ended path 일관성 보장)를 주석으로 명확히 하고 있으므로 기능 상 문제는 없음. 다만 engine merge 경로와의 충돌 가능성을 통합 테스트로 검증 필요.

- **[INFO]** `totalRows`와 `rowsTotalCount`가 truncation 시 동일한 값을 이중 기록
  - 위치: `table.handler.ts:150-155`
  - 상세: `truncated: true`일 때 `payload.totalRows = dataRows.length`와 `payload.rowsTotalCount = cappedRows.originalLength`는 동일한 값(`dataRows.length`)이다. JSONB output에 같은 숫자가 두 키로 저장된다.
  - 제안: 의도(totalRows는 기존 의미 유지, rowsTotalCount는 truncation 전용 신호)라면 spec 주석으로 명확히 구분. 또는 truncated 시 `rowsTotalCount`만 두고 `totalRows`가 capped 길이를 반영하도록 재정의해 JSONB 크기를 줄인다.

- **[INFO]** `truncateArrayForOutput`의 binary search가 DB write path에서 반복 직렬화 수행
  - 위치: `truncate-body.util.ts:115-135`
  - 상세: O(log n) 반복으로 `JSON.stringify(arr.slice(0, mid))`를 호출한다. 배열이 1MB 경계 근처에 있으면 수백 KB 슬라이스를 ~10회 직렬화한다. Node.js 이벤트 루프를 잡아 DB write 직전 latency spike가 발생할 수 있다.
  - 제안: 현재 1MB × log₂(n) 수준은 실용적으로 허용 범위이나, 추후 배열 원소가 매우 많아지면(>10k rows) 누적 직렬화 비용 모니터링 권장.

---

## 요약

이번 변경의 핵심 DB 관련 사항은 Presentation 노드(Carousel/Table)의 `NodeExecution.outputData` JSONB 컬럼 보호를 위한 1MB cap 도입이다. 방향은 올바르나, **`rendered` HTML이 캡 적용 전 전체 배열에서 생성되어 그대로 JSONB에 기록된다는 구현 버그**가 있다 — spec의 "items가 잘리면 rendered도 자동으로 작아진다" 설명과 실제 코드 순서가 불일치한다. 이 경우 items는 보호되지만 rendered가 DB row size 문제를 그대로 유발할 수 있다. `rawConfig`의 state JSONB 중복 저장 및 `totalRows`/`rowsTotalCount` 이중 기록은 기능 상 안전하나 불필요한 JSONB 비대화를 초래한다.

## 위험도

**MEDIUM** — `rendered` HTML의 미보호 JSONB 기록 경로가 실제 DB row size 초과를 유발할 수 있음.