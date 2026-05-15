## 리뷰 결과

### 발견사항

- **[WARNING]** 모듈 수준 가변 변수 `tableRowId`의 경쟁 조건 가능성
  - 위치: `presentation-configs.tsx:145` — `let tableRowId = 0;`
  - 상세: `tableRowId`는 모듈 스코프의 가변 전역 변수로, `++tableRowId` 프리픽스 증가 연산을 통해 Row ID를 생성합니다. 동일한 패턴이 `carouselItemId`(line 13)에도 존재합니다. Next.js 서버 컴포넌트 환경에서는 모듈이 서버 인스턴스 전역에 공유될 수 있으며, 여러 요청이 동시에 `addRow()`를 호출하면 ID 중복 또는 예측 불가능한 증가가 발생할 수 있습니다. 클라이언트 전용(`"use client"`)이므로 실제 경쟁 조건 발생 가능성은 낮지만, 탭을 여러 개 열거나 React StrictMode의 이중 렌더링 환경에서도 동일한 ID가 중복 발행될 위험이 있습니다.
  - 제안: `useRef`를 사용해 컴포넌트 인스턴스별 카운터를 관리하거나, `crypto.randomUUID()` / `Date.now() + Math.random()` 조합으로 전역 상태 의존을 제거하세요.

    ```tsx
    // 권장: 컴포넌트 내부에서 useRef 사용
    const rowIdRef = useRef(0);
    const addRow = () => {
      const newRow: TableRow = { id: ++rowIdRef.current };
      ...
    };
    ```

- **[INFO]** `execute` 메서드의 동기 로직에서 불필요한 `Promise.resolve()` 래핑
  - 위치: `table.handler.ts:83–91`
  - 상세: `execute`가 `async` 키워드를 제거하고 `Promise.resolve()`로 명시 래핑하도록 변경되었습니다. 이는 기능상 동일하지만, 인터페이스 시그니처(`Promise<unknown>`)를 만족하기 위한 의도적 선택으로 보입니다. 비동기 작업이 없는 메서드이므로 동시성 문제는 없습니다.
  - 제안: 인터페이스 준수 목적이라면 현재 방식도 무방하나, `async execute(...)` 유지 방식이 가독성 측면에서 더 명확합니다.

- **[INFO]** `static` 모드에서 `config.rows` 배열을 복사 없이 직접 참조
  - 위치: `table.handler.ts:57–60`
  - 상세: `dataRows = config.rows as Record<string, unknown>[]`로 원본 배열을 그대로 참조합니다. 이후 `sortBy`가 있을 경우 `[...dataRows].sort()`로 스프레드 복사가 이루어지므로 원본 변경은 없습니다. 단, `pageSize`만 적용되는 경우 `dataRows.slice()`는 새 배열을 반환하므로 역시 안전합니다. 현재 코드 흐름에서는 원본 `config.rows` 변이 없음이 확인됩니다.

---

### 요약

분석된 코드는 주로 동기적 데이터 변환 로직과 React 컴포넌트 상태 관리로 구성되어 있어 전반적인 동시성 위험도는 낮습니다. 가장 주목할 문제는 `presentation-configs.tsx`의 모듈 수준 `tableRowId` (및 기존에 존재하던 `carouselItemId`) 가변 전역 변수로, `"use client"` 컴포넌트임에도 불구하고 모듈 스코프 공유 상태로 인해 다중 컴포넌트 인스턴스 간 ID 중복 가능성이 있습니다. 백엔드 `TableHandler`는 상태를 보유하지 않는 순수 변환 클래스이므로 동시성 이슈가 없고, `async→sync+Promise.resolve` 전환도 기능적으로 안전합니다.

### 위험도

**LOW**