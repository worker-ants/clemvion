# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - static 모드에서 컬럼-행 데이터 동기화 누락으로 사용자 데이터 불완전성 발생 가능, 모듈 수준 전역 상태 패턴 반복

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Side Effect | **static 모드에서 컬럼 추가 시 기존 row 데이터에 새 field가 초기화되지 않음** — 컬럼 추가 후 기존 row와 신규 컬럼 간 구조적 불일치 발생, 저장 데이터 불완전성 초래 | `presentation-configs.tsx` — `addColumn()` | `addColumn` 시 기존 rows에도 `{ ...row, [newField]: "" }` 형태로 새 필드 추가 |
| 2 | Requirement / Side Effect | **static 모드에서 컬럼 삭제 시 row 데이터에서 해당 field가 제거되지 않음** — orphan 필드가 config에 누적됨 | `presentation-configs.tsx` — `removeColumn()` | `removeColumn` 시 rows에서 해당 field key 제거 처리 추가 |
| 3 | Architecture / Concurrency / Security | **모듈 수준 가변 전역 변수 `tableRowId`** — SSR 환경에서 요청 간 상태 공유 가능, 다중 컴포넌트 인스턴스 간 ID 중복 위험, 기존 `carouselItemId` 동일 패턴 반복 | `presentation-configs.tsx:146` | `useRef`로 컴포넌트 인스턴스별 격리 또는 `crypto.randomUUID()` 사용 |
| 4 | Security | **`config.rows` 항목 타입 미검증** — `execute()`가 `validate()` 없이 직접 호출될 경우 rows 배열 항목이 객체임을 보장하지 않음 | `table.handler.ts:60-62` | `filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object' && !Array.isArray(r))` 적용 |
| 5 | Security | **`sortBy`가 column 목록에 없는 임의 필드를 허용** — `validate()`에서 whitelist 검증 부재 | `table.handler.ts:68-75` | `validate()`에 `sortBy`가 정의된 column field 목록 내 값인지 검증 추가 |
| 6 | Testing | **`toDisplayString`의 object/array 값 렌더링 테스트 누락** — `JSON.stringify` 경로가 테스트로 검증되지 않음 | `table.handler.spec.ts` | `rows`에 중첩 객체/배열 값 포함 시 렌더링 결과 검증 테스트 추가 |
| 7 | Testing | **정렬 로직의 null 값 처리 테스트 누락** — `aVal != null && bVal != null` 조건에서 한쪽만 null일 때 비결정적 정렬 결과 | `table.handler.spec.ts` | null 값 포함 데이터의 정렬 결과 안정성 검증 테스트 추가 |
| 8 | Testing | **`TableConfig` 컴포넌트 단위 테스트 전무** — mode 전환 로직, 자동 field명 생성, 행 추가/삭제/편집 등 복잡한 UI 로직 미검증 | `presentation-configs.tsx` | `handleModeChange` 순수 로직(config 변환)을 최소한 단위 테스트로 커버 |
| 9 | Architecture | **프론트엔드가 백엔드 도메인 규칙을 암묵적으로 중복 구현** — mode 전환 시 제거할 필드 목록을 프론트엔드가 직접 판단, 백엔드 `validate()`와 숨겨진 결합도 존재 | `presentation-configs.tsx:160-175` | 허용 필드 집합을 단일 소스(스펙 상수 또는 공유 스키마)로 정의하거나 별도 유틸 함수로 분리 |
| 10 | Maintainability | **`mode` 타입이 타입 시스템에 표현되지 않음** — `(config.mode as string) ?? 'dynamic'` 표현식이 `validate()`와 `execute()` 양쪽에서 중복되고, 오타 방지 불가 | `table.handler.ts:16, 50` | `type TableMode = 'static' \| 'dynamic'` 선언 후 private 헬퍼 `getMode(config): TableMode`로 추출 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | **static 모드 rows에 내부 `id` 필드가 실행 결과에 포함되어 다운스트림 노출** | `table.handler.ts` static 분기 | 백엔드에서 `id` 필드 strip 처리 또는 저장 전 프론트엔드에서 제거 |
| 2 | Security / Performance | **`pageSize` 백엔드 상한선 미적용** — 프론트엔드는 `max={100}`이나 백엔드 미검증 | `table.handler.ts:81-83` | `Math.min(pageSize, MAX_PAGE_SIZE)` 적용 (MAX=1000 등) |
| 3 | Side Effect | **`execute()`의 `async` 제거로 동기 예외가 호출자의 `.catch()`에서 잡히지 않을 수 있음** | `table.handler.ts:46` | `Promise.resolve()` 호출 전 로직을 `try/catch`로 감싸거나 `async` 유지 |
| 4 | Performance | **dynamic 모드에서 `.map()` 후 이미 새 배열임에도 정렬 시 불필요한 spread 복사** | `table.handler.ts:70-78` | static 모드에서만 `[...dataRows]` 복사, dynamic 모드는 직접 정렬 |
| 5 | Documentation | **`spec/4-nodes/6-presentation-nodes.md` 업데이트 확인 필요** — `mode`, `dataSource`, `rows` 신규 필드가 스펙 문서에 반영되었는지 확인 | `spec/4-nodes/6-presentation-nodes.md` | static 모드의 필수 필드 및 전체 설정 스키마를 스펙 문서에 명시 |
| 6 | Maintainability | **`tableSummary`의 구분자 리터럴 `·` — 파일 내 `\u00b7` 이스케이프와 혼용** | `node-config-summary.ts:188` | `\u00b7`로 통일 또는 `const SEPARATOR` 상수로 추출 |
| 7 | Maintainability | **`void _rows; void dataSource;` 패턴 — lint 우회 의도가 불명확** | `presentation-configs.tsx:155-156` | `const { rows: _rows, dataSource: _dataSource, ...rest } = config;` 만으로 충분 (`_` prefix는 `noUnusedLocals`에서 자동 제외) |
| 8 | Maintainability | **columns 렌더링 시 배열 인덱스 `key={i}` 사용** — 컬럼 순서 변경 시 React reconciliation 이슈 가능 | `presentation-configs.tsx:208` | `key={col.field \|\| i}` 사용 |
| 9 | Architecture | **`execute()` 반환 타입이 `Promise<unknown>`이나 실제 동기 실행** — 다른 핸들러와 패턴 불일치 가능 | `table.handler.ts` | `async execute()` 유지 권장 (자동 Promise 래핑, `eslint-disable` 주석 불필요) |
| 10 | Documentation | **`_context` unused 이유가 주석으로 미설명** | `table.handler.ts:47` | `// _context unused here; required by NodeHandler interface signature` 주석으로 교체 |
| 11 | Testing | **`static` 모드에서 `dataSource` 설정이 있어도 무시되는지 명시적 테스트 없음** | `table.handler.spec.ts` | 두 값이 동시에 있을 때 static rows 우선 검증 테스트 추가 |
| 12 | Testing | **`pageSize: 0` 엣지 케이스 테스트 없음** — falsy 조건으로 전체 행 반환되는 동작 미검증 | `table.handler.ts:81` | 의도된 동작인지 명시적 테스트 추가 |
| 13 | API Contract | **`tableSummary` 출력 형식 변경** (`"3 columns · pagination"` → `"dynamic · 3 columns · pagination"`) — 외부 파싱 코드 영향 가능 | `node-config-summary.ts:182-192` | 이 텍스트를 직접 비교하는 다른 사용처 없는지 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | static 모드 컬럼-행 동기화 누락, 모듈 전역 ID 변수 |
| side_effect | MEDIUM | 컬럼 추가 시 기존 row 미갱신, `async` 제거로 예외 처리 경로 변화 |
| security | LOW | `config.rows` 타입 미검증, `sortBy` whitelist 부재, `pageSize` 상한 미적용 |
| concurrency | LOW | 모듈 수준 `tableRowId` 경쟁 조건 가능성 |
| architecture | LOW | 프론트-백엔드 도메인 규칙 암묵적 결합, `mode` 타입 미정의 |
| testing | LOW | object/array 렌더링 테스트 누락, null 정렬 테스트 누락, 컴포넌트 테스트 전무 |
| maintainability | LOW | `tableRowId` 전역 상태, `mode` 타입 미정의, `void` 패턴 |
| performance | LOW | 불필요한 배열 복사, 모듈 전역 카운터 패턴 |
| documentation | LOW | 스펙 문서 업데이트 확인 필요, JSDoc 부재 |
| scope | LOW | `async` 제거가 기능과 무관한 변경, 불필요한 리팩토링 혼재 |
| dependency | NONE | 외부 의존성 변경 없음, 내부 의존성 구조 적절 |
| api_contract | LOW | static rows의 내부 `id` 필드 노출, `dataSource` 검증 누락 |
| database | NONE | 데이터베이스 관련 코드 없음 |

---

## 발견 없는 에이전트

- **database** — 변경사항이 DB와 무관한 프레젠테이션 레이어에 국한됨

---

## 권장 조치사항

1. **[즉시] static 모드 컬럼-행 동기화 수정** — `addColumn()` 시 기존 rows에 새 field 초기화, `removeColumn()` 시 rows에서 해당 field 제거 (`presentation-configs.tsx`)
2. **[즉시] `toDisplayString` object/array 렌더링 테스트 추가** — `JSON.stringify` 경로 및 null 정렬 동작 검증 (`table.handler.spec.ts`)
3. **[권장] `config.rows` 항목 타입 필터링 추가** — `execute()` 내 rows 배열 항목이 객체인지 보장 (`table.handler.ts:60-62`)
4. **[권장] `mode` 타입 명시화** — `type TableMode = 'static' | 'dynamic'` 선언 및 `getMode()` 헬퍼 추출로 중복 파싱 제거 (`table.handler.ts`)
5. **[권장] `tableRowId` 전역 변수 교체** — `crypto.randomUUID()` 또는 `useRef` 기반으로 컴포넌트 인스턴스 격리 (`presentation-configs.tsx:146`)
6. **[권장] `execute()` `async` 복원** — `Promise.resolve()` 명시 래핑 대신 `async execute()` 유지로 예외 처리 경로 일관성 확보 및 `eslint-disable` 주석 제거
7. **[확인] `spec/4-nodes/6-presentation-nodes.md` 업데이트** — `mode`, `dataSource`, `rows` 신규 필드 및 모드별 필수/선택 필드 명시
8. **[소개선] `tableSummary` 구분자 통일** — `\u00b7` 이스케이프로 통일 (`node-config-summary.ts:188`)
9. **[소개선] columns 렌더링 key 개선** — `key={i}` → `key={col.field || i}` (`presentation-configs.tsx:208`)
10. **[소개선] `sortBy` whitelist 검증 및 `pageSize` 상한 추가** — 방어적 입력 검증 강화 (`table.handler.ts`)