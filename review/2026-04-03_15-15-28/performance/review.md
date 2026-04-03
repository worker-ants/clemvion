## 성능 코드 리뷰

### 발견사항

---

**[INFO]** `execute`가 `async` 제거 후 `Promise.resolve()` 래핑
- 위치: `table.handler.ts:50`, `table.handler.ts:87-94`
- 상세: `async` 키워드 제거는 불필요한 Promise 래핑 오버헤드를 줄이는 올바른 방향이나, 반환 시 `Promise.resolve({...})`를 사용하는 것은 여전히 매 호출마다 새 Promise 객체를 생성합니다. 인터페이스가 `Promise<unknown>`을 요구한다면 불가피하지만, 동기 계산 결과를 그대로 반환할 수 있다면 인터페이스 타입을 `unknown | Promise<unknown>`으로 확장하는 것이 더 효율적입니다.
- 제안: 인터페이스 변경이 가능하다면 동기 반환을 허용하도록 수정. 현 구조 유지 시 이 수준은 무시 가능.

---

**[INFO]** dynamic 모드에서 필드 필터링 후 정렬 시 불필요한 배열 복사
- 위치: `table.handler.ts:70-78`
- 상세: dynamic 모드에서 이미 `.map()`으로 새 배열을 생성(`dataRows`)하므로, 정렬 시 `[...dataRows].sort()`의 spread 복사가 불필요합니다. static 모드에서는 `config.rows`를 직접 참조하므로 복사가 필요하지만, 두 경우를 구분하지 않고 항상 복사합니다.
- 제안:
  ```ts
  // static 모드에서만 복사 필요
  if (sortBy) {
    const sortable = mode === 'static' ? [...dataRows] : dataRows;
    sortable.sort(...);
    dataRows = sortable;
  }
  ```

---

**[INFO]** `renderHtml`에서 문자열 연결 방식의 잠재적 성능 이슈
- 위치: `table.handler.ts:99-121`
- 상세: 현재 `.map().join('')` 체인 방식은 중간 배열을 생성하지만 JavaScript 엔진에서 일반적으로 최적화됩니다. 그러나 수천 행 규모의 데이터에서는 `Array.join`보다 단일 문자열 누적(`reduce` 또는 `StringBuilder` 패턴)이 메모리 효율적일 수 있습니다. 현재 use case(UI 미리보기 렌더링)를 고려하면 실질적 문제는 아닙니다.
- 제안: 대규모 데이터셋이 예상되는 경우에만 최적화 고려. 현재 수준은 적절.

---

**[INFO]** 모듈 수준 전역 변수 `tableRowId` — 메모리/상태 누수 패턴
- 위치: `presentation-configs.tsx:146`
- 상세: `let tableRowId = 0`은 모듈 레벨 뮤터블 변수로, 클라이언트 사이드에서는 앱이 살아있는 동안 계속 증가합니다. 기능상 문제는 없으나 (같은 패턴이 `carouselItemId`에도 사용됨), React의 `useRef`나 `crypto.randomUUID()`를 사용하면 모듈 상태 오염 없이 고유 ID를 생성할 수 있습니다.
- 제안:
  ```ts
  const addRow = () => {
    const newRow: TableRow = { id: Date.now() }; // 또는 crypto.randomUUID()
    ...
  };
  ```

---

**[INFO]** `handleModeChange`에서 `void _rows; void dataSource;` 패턴
- 위치: `presentation-configs.tsx:157-158`
- 상세: 모드 전환 시 기존 `rows`/`dataSource`를 구조 분해 후 `void`로 폐기하는 방식은 불필요한 구조 분해 연산을 수행합니다. 성능 영향은 무시할 수준이나 `eslint-disable-next-line` 주석이나 명시적 제거가 더 명확합니다.
- 제안: 코드 가독성/린트 규칙 측면의 개선이지 성능 이슈는 아닙니다.

---

**[INFO]** static 모드 행 렌더링 시 중첩 루프 (rows × columns)
- 위치: `presentation-configs.tsx:248-258`
- 상세: `rows.map()` 내부에서 `columns.map()`을 호출하는 O(n×m) 패턴입니다. 설정 UI 컨텍스트에서 행/열 수가 수십 개 이하라면 문제없으나, 이론적으로 대규모 정적 데이터를 다룰 경우 렌더 성능에 영향을 줄 수 있습니다. 현재 `pageSize` 제한(기본 100)이 있어 실용적 한계가 있습니다.
- 제안: 현재 use case에서 최적화 불필요.

---

### 요약

전반적으로 이번 변경은 성능 측면에서 양호합니다. `async` 제거로 불필요한 microtask 큐 등록을 줄였고, dynamic 모드에서 `map` 후 필요한 필드만 추출하여 메모리 사용을 줄였습니다. 주요 성능 이슈는 없으며, static 모드에서도 정렬 시 불필요하게 배열을 복사하는 소소한 비효율과 모듈 레벨 전역 카운터(`tableRowId`) 패턴이 존재하지만 실제 운영 환경에서 병목이 될 수준은 아닙니다. 대용량 데이터(수천 행)를 Table 노드에서 처리할 경우 `renderHtml`의 문자열 빌드 방식과 서버 측 페이지네이션 부재가 잠재적 이슈가 될 수 있으나, 현재 `pageSize` 기본값(20)으로 실질적으로 제어됩니다.

### 위험도

**LOW**