## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** 모듈 수준 가변 상태 (`tableRowId`)
- 위치: `presentation-configs.tsx:146` — `let tableRowId = 0;`
- 상세: 모듈 수준 변수로 행 ID를 관리하는 방식은 `carouselItemId`와 동일한 패턴이지만, 여러 `TableConfig` 인스턴스가 존재할 경우 ID가 공유됨. 페이지 리로드 없이 여러 테이블 노드를 오가면 ID 충돌 위험이 있음. 또한 `id` 필드가 `TableRow` 인터페이스에 필수(`number`)로 정의되어 있어 외부에서 로드된 config 데이터가 이 구조와 맞지 않을 수 있음.
- 제안: React의 `useRef` 또는 `crypto.randomUUID()`를 사용하거나, `Date.now()` 기반 ID를 사용하여 컴포넌트 인스턴스 단위로 격리.

---

**[WARNING]** `handleModeChange`의 `void` 표현식을 통한 변수 무효화
- 위치: `presentation-configs.tsx:156` — `void _rows; void dataSource;`
- 상세: 구조 분해 후 `void` 표현식으로 lint 경고를 억제하는 방식은 가독성을 해침. 같은 파일의 `CarouselConfig.handleModeChange`도 동일한 패턴을 사용하나, 이 패턴이 코드베이스에 확산될 경우 의도가 불명확해짐.
- 제안: `_` prefix 변수는 TypeScript의 `noUnusedLocals` 설정에서 자동으로 제외되므로 `void` 표현식 없이 `const { rows: _rows, dataSource: _dataSource, ...rest } = config;` 만으로 충분. 또는 단순히 `omit` 패턴 유틸리티 함수로 추출.

---

**[WARNING]** `mode` 상수 중복 파싱
- 위치: `table.handler.ts:47, 53` — `execute` 메서드 내 `mode` 변수가 `validate`와 독립적으로 파싱됨
- 상세: `validate`와 `execute` 모두 `(config.mode as string) ?? 'dynamic'`을 반복하고 있음. 유효한 mode 타입(`'static' | 'dynamic'`)이 타입 시스템에 표현되지 않고 문자열 비교로만 처리됨.
- 제안: 파일 상단에 `type TableMode = 'static' | 'dynamic';` 타입과 `const DEFAULT_MODE: TableMode = 'dynamic';` 상수 정의. 파싱 로직을 헬퍼 함수로 추출:
  ```ts
  private getMode(config: Record<string, unknown>): TableMode {
    const mode = config.mode as string;
    return mode === 'static' || mode === 'dynamic' ? mode : 'dynamic';
  }
  ```

---

**[WARNING]** `execute` 메서드에서 `async` 제거 후 불필요한 `Promise.resolve()` 래핑
- 위치: `table.handler.ts:49, 90-97`
- 상세: 인터페이스가 `Promise<unknown>`을 반환하도록 정의되어 있어 `async`를 제거하고 `Promise.resolve()`를 명시적으로 사용한 것으로 보임. eslint의 `@typescript-eslint/no-unused-vars` 주석도 추가됨. 그러나 이 방식은 인터페이스 시그니처와의 일관성이 떨어지며 다른 핸들러들이 `async`를 사용한다면 패턴이 불일치함.
- 제안: 인터페이스 구현 일관성을 위해 `async execute(...)` 유지 (async 함수는 자동으로 Promise로 래핑). `eslint-disable` 주석도 제거 가능.

---

**[INFO]** `tableSummary`에서 하드코딩된 unicode 구분자 혼용
- 위치: `node-config-summary.ts:188` — `parts.join(" · ")`
- 상세: 다른 summary 함수들은 `\u00b7`를 사용하는데 (`carouselSummary` 등), `tableSummary`는 리터럴 `·` 문자를 사용하고 있음. 기능적으로는 동일하지만 코드베이스 일관성이 떨어짐.
- 제안: `\u00b7`로 통일하거나, 파일 상단에 `const SEPARATOR = ' \u00b7 ';` 상수를 정의하여 모든 summary 함수에서 공유.

---

**[INFO]** static mode에서 `addRow` 시 columns 필드 사전 초기화의 부작용
- 위치: `presentation-configs.tsx:183-187`
- 상세: `addRow`는 현재 columns를 순회하여 빈 값으로 초기화하지만, 이후 column이 추가/제거될 경우 기존 row 객체와 불일치 발생. 단, 렌더링 시 `row[col.field] ?? ""`로 안전하게 처리되므로 런타임 에러는 없음. 그러나 config에 orphan 필드가 남는 문제가 있음.
- 제안: `addRow` 시 빈 초기화 대신 row를 `{ id: ++tableRowId }`만으로 생성하고, 렌더링에서 `??` 처리에 완전히 의존. Column 변경 시 row 정리 로직은 별도로 고려.

---

**[INFO]** `columns` key로 배열 인덱스 사용
- 위치: `presentation-configs.tsx:208` — `key={i}`
- 상세: 컬럼 렌더링 시 `key={i}`를 사용하고 있어 컬럼 순서 변경 시 React reconciliation 이슈 가능. `rows`는 `key={row.id ?? ri}`로 안전하게 처리하는 반면 columns는 고유 ID가 없음.
- 제안: column 추가 시 `field` 값으로 key를 사용(`key={col.field || i}`)하거나, column에도 고유 ID 부여.

---

### 요약

전반적으로 코드는 static/dynamic mode 분기가 명확하고 테스트 커버리지가 충실하여 유지보수성이 양호함. 가장 주목할 문제는 모듈 수준 가변 ID 상태(`tableRowId`)와 `mode` 문자열의 타입 표현 부재로, 이 두 가지가 코드베이스 확장 시 잠재적 버그의 진입점이 될 수 있음. `void` 표현식 패턴과 unicode 구분자 혼용은 팀 내 일관성 관점에서 정리가 필요하며, `execute` 메서드의 `async` 제거 및 `Promise.resolve()` 명시 래핑은 다른 핸들러와의 패턴 일치 여부를 확인하여 통일하는 것이 바람직함.

### 위험도

**LOW**