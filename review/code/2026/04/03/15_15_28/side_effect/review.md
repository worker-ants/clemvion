## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] 모듈 레벨 가변 전역 변수 — `tableRowId`**
- 위치: `presentation-configs.tsx:144` — `let tableRowId = 0;`
- 상세: 동일한 패턴이 `carouselItemId`에도 존재하나, `tableRowId`는 신규 추가입니다. 이 변수는 모듈 수명 동안 단조 증가하며, HMR(Hot Module Replacement) 환경에서 모듈이 재평가되지 않으면 값이 누적됩니다. 다만 이 ID는 React 렌더링의 `key`로만 사용되므로 실질적 데이터 손상은 없고, 기존 `carouselItemId`와 동일한 패턴을 따른 의도적 설계로 보입니다.
- 제안: `useRef` 또는 `crypto.randomUUID()`로 교체하면 모듈 상태 오염을 방지할 수 있습니다.

---

**[WARNING] `handleModeChange`에서 `rows` 클로저 캡처 후 config에서 제거하는 불일치**
- 위치: `presentation-configs.tsx` — `handleModeChange` 함수
- 상세: `static → dynamic` 전환 시 `{ rows: _rows, dataSource, ...rest }`로 구조분해하여 두 필드를 제거합니다. `dynamic → static` 전환 시에는 `dataSource`가 함께 제거됩니다. 그러나 `static` 모드에서 이미 존재하는 `rows`는 클로저 변수(`rows`)를 통해 다시 설정됩니다. 이 시점의 `rows`는 `config.rows`에서 파생된 것이므로 본질적으로 동일하지만, `config`와 `rows` 두 소스를 사용하는 것은 혼란스럽습니다. 현재 코드는 정확히 동작하나 향후 유지보수 시 혼동 여지가 있습니다.
- 제안: `static` 분기에서 `rows` 대신 `config.rows as TableRow[] ?? []`를 직접 사용하여 의도를 명확히 하세요.

---

**[WARNING] `addColumn` 시 기존 row 데이터에 신규 field가 추가되지 않음**
- 위치: `presentation-configs.tsx` — `addColumn` 함수
- 상세: `static` 모드에서 컬럼 추가 시 기존 row 객체들에 새 field 키가 반영되지 않습니다. `addRow`는 현재 `columns`를 순회하여 초기값을 설정하지만, 역방향(컬럼 추가 → 기존 row 갱신)은 처리하지 않습니다. 실행 시 백엔드의 `static` 모드는 `config.rows`를 그대로 사용하므로, 새로 추가된 컬럼에 해당하는 셀 값이 누락된 채 저장될 수 있습니다.
- 제안: `addColumn` 내에서 기존 `rows`를 순회하여 `newRow[newField] = ""`를 추가하는 로직을 포함하세요.

---

**[INFO] `execute` 메서드 시그니처 변경 — `async` 제거**
- 위치: `table.handler.ts:46` — `execute(` (이전: `async execute(`)
- 상세: `async` 키워드가 제거되고 `Promise.resolve()`를 명시적으로 반환합니다. 반환 타입 `Promise<unknown>`은 유지되므로 인터페이스(`NodeHandler`) 호환성은 깨지지 않습니다. 호출자가 `await`를 사용하고 있다면 동작은 동일합니다. 단, 내부에서 예외 발생 시 `async`와 달리 `Promise.resolve()` 경로에서는 동기 예외가 그대로 throw되므로 호출자의 `.catch()` 핸들러가 이를 잡지 못할 수 있습니다.
- 제안: `Promise.resolve()` 호출 전 로직을 `try/catch`로 감싸거나, `async`를 유지하세요.

---

**[INFO] `static` 모드에서 `config.rows`를 그대로 출력 반환**
- 위치: `table.handler.ts:62-65`
- 상세: `static` 모드 시 `dataRows = config.rows as Record<string, unknown>[]`로 설정한 후, 정렬/페이지네이션 후 그 참조가 결과 객체에 포함됩니다. 정렬 시 `[...dataRows].sort()`로 새 배열을 생성하므로 원본 `config.rows`는 변경되지 않습니다. 다만 정렬/페이지네이션이 없을 때는 `config.rows`와 동일한 배열 참조가 출력에 포함됩니다. 호출자가 반환값을 수정할 경우 원본 config가 변경될 수 있습니다.
- 제안: 명시적으로 `[...config.rows]` 스프레드하여 참조를 분리하세요.

---

**[INFO] `node-config-summary.ts` — 출력 텍스트 포맷 변경 (breaking change for consumers)**
- 위치: `node-config-summary.ts:182-191`
- 상세: 기존 `"3 columns · pagination"` → 신규 `"dynamic · 3 columns · pagination"` 형식으로 변경됩니다. 이 텍스트를 파싱하거나 스냅샷 테스트하는 외부 코드가 있다면 영향을 받습니다. 테스트 파일이 함께 업데이트되었으므로 내부 테스트는 통과하나, 다른 컴포넌트가 이 텍스트를 직접 비교할 경우 영향이 있습니다.
- 제안: `getConfigSummary` 반환값을 파싱하는 다른 사용처가 없는지 확인하세요.

---

### 요약

전반적으로 변경사항은 의도된 기능 추가(static/dynamic 모드 분리)를 올바르게 구현하고 있으며, 심각한 부작용은 없습니다. 주요 위험은 두 가지입니다: `tableRowId` 전역 변수는 기존 `carouselItemId` 패턴을 따른 것이나 모듈 상태를 오염시킬 수 있고, `static` 모드에서 컬럼 추가 시 기존 row에 신규 field가 자동으로 초기화되지 않아 저장 데이터 불완전성이 발생할 수 있습니다. `execute`의 `async` 제거는 인터페이스 호환성은 유지하지만 예외 처리 경로에서 미묘한 차이를 만들 수 있습니다.

### 위험도

**MEDIUM** — 런타임 오류를 즉시 유발하지는 않으나, static 모드에서 컬럼-행 동기화 누락으로 인해 사용자 데이터 불완전성이 발생할 수 있습니다.