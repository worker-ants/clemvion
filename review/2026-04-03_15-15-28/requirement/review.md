### 발견사항

- **[INFO]** `static` 모드에서 column field 편집 불가 (의도적 설계로 보이나 스펙 확인 필요)
  - 위치: `presentation-configs.tsx` — 컬럼 렌더링 섹션
  - 상세: `static` 모드에서는 `Field` ExpressionInput이 숨겨지고 `addColumn` 시 `col${columns.length}` 자동 생성됨. 컬럼 추가 후 필드명을 변경할 수 없어 고정된 키값을 사용해야 함.
  - 제안: static 모드에서도 field 편집 허용 여부를 스펙에서 확인하고, 허용할 경우 해당 input을 노출해야 함.

- **[WARNING]** `static` 모드에서 컬럼 추가 시 기존 row 데이터에 새 필드가 초기화되지 않음
  - 위치: `presentation-configs.tsx:addColumn`
  - 상세: `addColumn`이 컬럼만 추가하고 기존 `rows` 배열의 각 row에 새 필드를 추가하지 않음. 이후 row 편집 UI에서 새 컬럼에 해당하는 셀이 `row[col.field] ?? ""`로 빈값으로 표시되긴 하지만, 새 row 추가 시에만 현재 컬럼 기준으로 초기화됨 — 기존 row와 신규 컬럼 간 구조적 불일치 발생.
  - 제안: `addColumn` 시 기존 rows에도 `{ ...row, [newField]: "" }` 형태로 새 필드를 추가해 일관성 유지.

- **[WARNING]** `static` 모드에서 컬럼 삭제 시 row 데이터에서 해당 필드가 제거되지 않음
  - 위치: `presentation-configs.tsx:removeColumn`
  - 상세: 컬럼 삭제 후 row 데이터에는 해당 필드가 그대로 남음. 백엔드 execute에서는 columns 기준으로만 데이터를 처리하므로 실행에는 영향 없지만, 저장 데이터가 불필요한 필드를 보유하게 됨.
  - 제안: `removeColumn` 시 rows에서 해당 field key를 제거하는 처리 추가 (`const { [col.field]: _, ...rest } = row`).

- **[WARNING]** `tableRowId`가 모듈 레벨 변수로 선언되어 컴포넌트 간 공유됨
  - 위치: `presentation-configs.tsx:1` (`let tableRowId = 0`)
  - 상세: 동일 패턴의 `carouselItemId`도 같은 방식으로 선언되어 있으나, 이 방식은 SSR 환경에서 서버/클라이언트 간 ID 불일치를 유발할 수 있으며, 테스트 시 상태가 초기화되지 않아 사이드 이펙트 발생 가능.
  - 제안: `useRef`나 `crypto.randomUUID()` 또는 `Date.now()` 기반 ID 생성 방식 고려.

- **[INFO]** `handleModeChange`에서 `void _rows; void dataSource` 패턴 사용
  - 위치: `presentation-configs.tsx:handleModeChange`
  - 상세: 사용되지 않는 변수를 `void`로 처리하는 방식은 lint 우회 목적이나 가독성이 떨어짐. `CarouselConfig`의 동일 패턴과 일관성은 있음.
  - 제안: `const { mode: _mode, ...rest } = config` 형태로 필요한 키만 제외하거나 `eslint-disable` 주석 사용.

- **[INFO]** `execute` 메서드의 반환 타입이 `Promise<unknown>`이나 실제로는 동기 실행
  - 위치: `table.handler.ts:execute`
  - 상세: `async` 제거 후 `Promise.resolve()`로 래핑함. 인터페이스 계약상 문제없으나 불필요한 Promise 래핑임.
  - 제안: 인터페이스 변경 없이 유지 가능하며 현재 구현은 허용 범위 내.

- **[INFO]** `node-config-summary.ts`의 `tableSummary`에서 `·` 문자가 하드코딩 혼용
  - 위치: `node-config-summary.ts:tableSummary`
  - 상세: `parts.join(" · ")`에서 리터럴 `·` (U+00B7)를 직접 사용하고 있으나, 다른 summary 함수들은 `\u00b7` 이스케이프 사용. 동일한 문자이나 코드 일관성 측면에서 불일치.
  - 제안: `\u00b7` 이스케이프로 통일.

---

### 요약

전반적으로 `static`/`dynamic` 모드 분기, dataSource 지원, 정렬/페이지네이션, HTML 렌더링, 요약 레이블 등 핵심 요구사항은 충실히 구현되어 있고 테스트 커버리지도 양호합니다. 다만 프론트엔드의 `TableConfig`에서 **컬럼 추가/삭제 시 기존 row 데이터와의 동기화가 누락**된 점이 `static` 모드 사용자 경험을 저해할 수 있는 실질적인 결함입니다. 모듈 레벨 `tableRowId`는 SSR 환경에서의 잠재적 불안정성을 내포하며, field 편집 가능 여부에 대한 스펙 명확화도 필요합니다.

### 위험도

**MEDIUM**