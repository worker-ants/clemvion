## 보안 코드 리뷰 결과

---

### 발견사항

---

**[INFO]** HTML 이스케이프 처리 적절
- 위치: `table.handler.ts` — `escapeHtml()`, `toDisplayString()`
- 상세: `renderHtml`에서 모든 셀 값을 `escapeHtml`로 처리하며, `toDisplayString`에서 객체를 `JSON.stringify`한 후에도 `escapeHtml`을 거치므로 XSS 방어가 정상 동작합니다. 테스트에서도 `<script>alert("xss")</script>` 케이스를 커버합니다.
- 제안: 현행 유지

---

**[WARNING]** `config.rows` 미검증 상태로 실행 코드에 직접 사용
- 위치: `table.handler.ts:60-62`
  ```ts
  dataRows = Array.isArray(config.rows)
    ? (config.rows as Record<string, unknown>[])
    : [];
  ```
- 상세: `validate()`는 `rows`가 비어 있는지만 검사하지만, `execute()`는 `validate()`가 먼저 호출되었다고 가정합니다. 그러나 `execute()`는 독립적으로 호출 가능하므로 `config.rows`의 각 항목이 객체인지 보장되지 않습니다. 악의적이거나 잘못된 호출자가 `rows: [null, "<script>"]` 등을 전달하면 런타임 오류 또는 예기치 않은 동작이 발생할 수 있습니다.
- 제안:
  ```ts
  dataRows = Array.isArray(config.rows)
    ? (config.rows as unknown[]).filter(
        (r): r is Record<string, unknown> =>
          r !== null && typeof r === 'object' && !Array.isArray(r),
      )
    : [];
  ```

---

**[WARNING]** `sortBy`가 column 목록에 없는 임의 필드를 허용
- 위치: `table.handler.ts:68-75`
  ```ts
  const sortBy = config.sortBy as string | undefined;
  ...
  dataRows = [...dataRows].sort((a, b) => {
    const aVal = a[sortBy];
  ```
- 상세: `sortBy` 값이 컬럼 정의에 없는 임의의 키일 수 있습니다. 현재 코드에서는 단순히 `undefined` 비교로 귀결되어 직접적인 취약점은 없지만, 향후 로직 확장 시 의도치 않은 데이터 접근으로 이어질 수 있습니다. 또한 `validate()`에서 `sortBy`가 유효한 컬럼의 `field` 값인지 검증하지 않습니다.
- 제안: `validate()`에 `sortBy` whitelist 검증 추가
  ```ts
  if (config.sortBy) {
    const validFields = new Set((config.columns as ColumnConfig[]).map(c => c.field));
    if (!validFields.has(config.sortBy as string)) {
      errors.push('sortBy must refer to a defined column field');
    }
  }
  ```

---

**[WARNING]** 모듈-수준 변경 가능한 카운터 (`tableRowId`, `carouselItemId`)
- 위치: `presentation-configs.tsx:146` (`let tableRowId = 0`), 및 Carousel 동일 패턴
- 상세: 모듈 전역 변수로 선언된 `tableRowId`는 서버 사이드 렌더링(Next.js) 환경에서 요청 간 상태가 공유될 수 있습니다. 직접적인 보안 취약점은 아니지만, 예측 가능한 순차 ID는 클라이언트에서 행 순서 추정을 가능하게 합니다. 또한 ID가 config 객체에 저장되어 백엔드로 전송될 경우 불필요한 정보 노출이 됩니다.
- 제안: `crypto.randomUUID()` 또는 `Math.random().toString(36)`을 사용하거나, `useRef`로 컴포넌트 내부 상태로 관리

---

**[INFO]** `pageSize` 상한선 미적용 (백엔드)
- 위치: `table.handler.ts:77-79`
  ```ts
  if (pageSize) {
    dataRows = dataRows.slice(0, pageSize);
  }
  ```
- 상세: 프론트엔드의 `NumberField`는 `max={100}`으로 제한하지만, 백엔드 `execute()`는 `pageSize`에 상한을 두지 않습니다. 신뢰할 수 없는 입력이 직접 도달한다면 매우 큰 값이 들어올 수 있습니다. 현재 아키텍처에서 `dataRows`는 이미 메모리에 적재된 데이터이므로 실질적인 DoS 위험도는 낮지만 방어적 처리가 권장됩니다.
- 제안:
  ```ts
  const MAX_PAGE_SIZE = 1000;
  const effectivePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  dataRows = dataRows.slice(0, effectivePageSize);
  ```

---

**[INFO]** `mode` 값이 `execute()`에서 재검증되지 않음
- 위치: `table.handler.ts:48`
- 상세: `execute()`는 `validate()`와 독립적으로 동작 가능합니다. `mode`가 `'static'`도 `'dynamic'`도 아닐 경우 `dynamic` 경로로 폴백되므로 논리적으로 안전하지만, 명시적이지 않습니다.
- 제안: 구조상 허용 가능한 수준. 필요시 `execute()` 내부에서도 whitelist 체크 추가

---

### 요약

전반적으로 XSS 방어(`escapeHtml`)와 HTML 렌더링 처리는 잘 구현되어 있습니다. 주요 위험은 `execute()`가 `validate()`를 거치지 않고 직접 호출될 때 `config.rows` 항목의 타입이 보장되지 않는 점, 그리고 `sortBy`가 컬럼 whitelist 검증 없이 데이터 접근에 사용되는 점입니다. 프론트엔드의 모듈 전역 카운터는 SSR 환경에서 요청 간 상태 공유 가능성이 있으며, `pageSize`의 백엔드 상한 부재도 방어적 관점에서 보완이 필요합니다. 하드코딩된 시크릿, 인증/인가 우회, 암호화 문제는 발견되지 않았습니다.

---

### 위험도

**LOW**