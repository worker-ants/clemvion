### 발견사항

- **[INFO]** `execute()` 메서드의 `async` 제거 후 `Promise.resolve()` 래핑
  - 위치: `table.handler.ts:49-99`
  - 상세: `NodeHandler` 인터페이스가 `Promise<unknown>`을 반환하도록 선언되어 있어 동기 함수에서 `Promise.resolve()`로 감싸는 패턴은 허용 범위이나, 인터페이스 설계 의도(비동기 핸들러)와 구현(순수 동기 로직)의 불일치가 존재. 다른 핸들러들이 실제로 비동기 작업(I/O 등)을 수행하는 경우와 혼용 시 일관성이 낮아짐.
  - 제안: 인터페이스에 동기 핸들러를 위한 오버로드 또는 별도 추상 기반 클래스(`SyncNodeHandler`)를 두거나, 현재처럼 `Promise.resolve()`로 일관되게 유지하되 주석으로 명시

- **[WARNING]** 모듈 수준 가변 상태 (`let tableRowId = 0`)
  - 위치: `presentation-configs.tsx:146`
  - 상세: `tableRowId`가 모듈 스코프의 가변 변수로 선언되어 있어 컴포넌트 언마운트/재마운트 사이클과 무관하게 전역적으로 누적됨. 동일 패턴이 `carouselItemId`에도 존재. 이는 React의 선언적 상태 관리 원칙에 반하며, 서버 사이드 렌더링 환경에서 인스턴스 간 ID 공유 위험이 있음.
  - 제안: `useRef`로 컴포넌트 인스턴스에 종속시키거나, `crypto.randomUUID()` / `Date.now()` 기반으로 대체

- **[WARNING]** 프론트엔드 컴포넌트가 백엔드 도메인 로직을 중복 구현
  - 위치: `presentation-configs.tsx:160-175` (mode 전환 시 `rows`/`dataSource` 필드 제거 로직)
  - 상세: mode 변경 시 config에서 어떤 필드를 제거할지(`rows`, `dataSource`)를 프론트엔드가 직접 판단하고 있어 백엔드 `validate()`의 모드별 필수 필드 규칙과 암묵적으로 결합되어 있음. 백엔드 스펙이 변경될 때 프론트엔드도 함께 변경해야 하는 숨겨진 결합도.
  - 제안: 모드 전환 시 허용 필드 집합을 단일 소스(스펙 상수 또는 Zod 스키마)로 정의하고 공유하거나, 최소한 이 로직을 별도 유틸 함수로 분리하여 명시적으로 만들 것

- **[INFO]** `validate()`와 `execute()` 간 mode 추출 로직 중복
  - 위치: `table.handler.ts:16`, `table.handler.ts:50`
  - 상세: `(config.mode as string) ?? 'dynamic'` 표현식이 두 메서드에서 동일하게 반복됨. 현재 규모에서는 허용 범위이나 mode 리터럴(`'static' | 'dynamic'`)이 타입으로 정의되지 않아 오타 방지 불가.
  - 제안: `type TableMode = 'static' | 'dynamic'`를 별도 타입으로 선언하고, private 헬퍼 `resolveMode(config): TableMode`로 추출

- **[INFO]** 렌더링 책임의 핸들러 내 위치
  - 위치: `table.handler.ts:103-126` (`renderHtml`, `toDisplayString`, `escapeHtml`)
  - 상세: 실행 핸들러가 HTML 렌더링 책임을 함께 가짐. 현재는 단순하여 문제가 없으나, 렌더링 전략이 다양해질 경우(e.g., Markdown, JSON 출력 추가) 단일 책임 원칙(SRP) 위반 소지가 있음.
  - 제안: 당장 분리할 필요는 없으나, 렌더링 전략이 2개 이상이 되는 시점에 `TableRenderer` 인터페이스로 분리를 고려

- **[INFO]** 정렬 비교 로직의 엣지 케이스
  - 위치: `table.handler.ts:72-77`
  - 상세: `aVal != null && bVal != null && aVal < bVal ? -1 : 1` — 한쪽만 null인 경우 항상 `1`을 반환하여 null 값의 정렬 위치가 비결정적. 아키텍처 문제는 아니나 동작 예측 가능성(Principle of Least Surprise) 관점에서 명시적 null 처리 권장.

### 요약

전체적으로 `TableHandler`의 backend 구현은 static/dynamic 모드 분기를 단일 클래스 내에서 명확하게 처리하고 있으며, 기존 인터페이스(`NodeHandler`)와의 계약을 유지한다. 프론트엔드의 `TableConfig`는 기능 완결성은 높지만 모듈 수준 가변 ID 카운터(`tableRowId`)와 백엔드 도메인 규칙의 암묵적 중복이 응집도를 해치는 주요 약점이다. 인터페이스 계층에서 mode 타입이 명시적으로 정의되지 않아 frontend-backend 계약이 문자열 리터럴에 의존하는 점도 장기적인 유지보수 부담이다. 현재 규모에서는 즉각적인 위험도는 낮으나, 모드 수 확장 또는 렌더링 전략 다양화 시점에 리팩터링이 필요하다.

### 위험도

**LOW**