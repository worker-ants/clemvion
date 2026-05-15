# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 커버리지 불균형, 내장 변수 중복 정의, 스펙 미이행 항목(변수 누락, 기능 불일치)이 복합적으로 존재하며, 보안 및 아키텍처 차원의 개선이 필요함

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | `ROOT_VARIABLES`(자동완성)와 `BUILT_IN_VARIABLES`(피커) 중복 정의 — 하나를 수정해도 나머지에 반영 안 됨 | `use-expression-suggestions.ts:19-29`, `variable-picker.tsx:28-35` | `expression-constants.ts`로 추출해 단일 소스로 통합 |
| 2 | Architecture | 레이블 기반 노드 조회 — 사용자가 편집 가능한 레이블이 표현식 식별자로 사용되어 중복·변경 시 조회 실패 | `use-expression-context.ts:129`, `use-expression-suggestions.ts:119` | nodeId를 식별자로 사용하고 레이블은 표시 전용으로 분리 |
| 3 | Architecture / Maintainability | UI 훅 내 노드 타입 문자열 하드코딩 — `"variable_declaration"`, `"table"` 등을 훅이 직접 인식해 OCP 위반 | `use-expression-context.ts:100, 118, 127` | 노드 타입별 전략 패턴(레지스트리) 적용 |
| 4 | Testing | `useExpressionContext` 테스트 완전 부재 — 핵심 데이터 준비 로직(predecessor 탐색, 변수 수집, `sourceItemSample` 해석) 전혀 미커버 | `use-expression-context.ts` 전체 | `use-expression-context.test.ts` 신규 작성 (mocked stores 사용) |
| 5 | Testing | `VariablePicker` 컴포넌트 테스트 없음 — `onInsert` 콜백, 카테고리 토글, `NestedFieldItem` expand/collapse, `MAX_NESTING_DEPTH` 제한 등 미커버 | `variable-picker.tsx` 전체 | `@testing-library/react`로 인터랙션 테스트 추가 |
| 6 | Testing | `$var.` 제안 브랜치 테스트 없음 | `use-expression-suggestions.ts:171-188` | `variables` 배열 필터링 및 `insertText` 형식 검증 테스트 추가 |
| 7 | Testing | `$node["..."]` 레이블 선택 제안 브랜치 테스트 없음 | `use-expression-suggestions.ts:136-154` | `$node["Form` 입력 후 label 필터링 및 `insertText` 형식 검증 테스트 추가 |
| 8 | Side Effect | `ExpressionData` 인터페이스에 필수 필드 `sourceItemSample` 추가로 기존 소비자 코드에 컴파일 에러 발생 가능 | `use-expression-context.ts:33` | 다른 소비자 파일 일괄 점검 후 `sourceItemSample?: ... \| null`로 optional 처리 또는 일괄 업데이트 |
| 9 | Side Effect / Requirement | `$dataSource` 자동완성에는 노출되나 `$dataSource.` 필드 확장 분기 누락 — UX 불일치 | `use-expression-suggestions.ts:213` | `$dataSource.` 입력 시 필드 제안 분기 추가 |
| 10 | Requirement | 스펙 §4.1 변수 누락: `$trigger`, `$env`가 자동완성·피커 양쪽 모두에서 빠져 있음 | `use-expression-suggestions.ts:19-29`, `variable-picker.tsx:28-35` | `ROOT_VARIABLES` 및 `BUILT_IN_VARIABLES`에 `$trigger`, `$env` 추가 |
| 11 | Requirement | 미실행 워크플로우 힌트 미구현 — 스펙 §8.4.2: 실행 결과 없을 시 "워크플로우를 먼저 실행하세요" 안내 필요 | `use-expression-suggestions.ts`, `variable-picker.tsx` 전반 | 빈 suggestions 대신 안내 텍스트 아이템 또는 별도 힌트 렌더링 추가 |
| 12 | Requirement | 함수 자동완성에 시그니처 미포함 — 스펙 §7.1: 함수 목록에 파라미터 시그니처 표시 필요 | `use-expression-suggestions.ts:221-227` | 함수 레지스트리에 시그니처 정보 추가 후 `detail` 필드에 노출 |
| 13 | Requirement | `$dataSource` 피커-자동완성 불일치 — 피커의 `$sourceItem` 섹션에 `$dataSource` 항목 없음 | `variable-picker.tsx:338-367`, `use-expression-suggestions.ts:213` | 피커 섹션에 `$dataSource` 항목 추가, count `+2`로 수정 |
| 14 | Security | 노드 레이블이 검증 없이 표현식 문자열에 직접 삽입 — 특수문자 포함 시 표현식 구문 파괴 가능, 표현식 엔진 종류에 따라 코드 실행 위험 | `use-expression-suggestions.ts:145` | 레이블의 `"`, `\` 등 특수문자 이스케이프 또는 허용 문자 범위 검증 추가 |
| 15 | Performance | `VariablePicker` 함수 목록 전체 렌더링 — 자동완성은 `.slice(0, 10)` 제한하나 피커는 무제한 DOM 생성 | `variable-picker.tsx:441-448` | 상위 N개 제한 또는 가상 스크롤 적용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Prototype Pollution 잠재 위험 — `__proto__`, `constructor` 등의 키가 `Object.keys()`로 열거되어 표현식 경로로 사용될 수 있음 | `use-expression-context.ts:36-43`, `variable-picker.tsx:168` | `Object.keys()` 결과에서 위험 키 필터링 |
| 2 | Security | 전체 노드 실행 결과가 모든 노드 표현식에 노출 — 민감 데이터 포함 가능성 | `use-expression-context.ts:83-94` | 노드 간 데이터 접근 정책 정의, 민감 필드 마스킹 레이어 검토 |
| 3 | Performance / Maintainability | `FUNCTION_NAMES` 모듈 로드 시 즉시 평가 — 동적 함수 등록 시 반영 안 됨, 테스트 mocking 어려움 | `use-expression-context.ts:8` | `useMemo` 내부로 이동 검토 |
| 4 | Performance | Zustand 셀렉터 참조 불안정 가능성 — `nodes`, `edges`, `nodeResults`가 매 렌더마다 새 배열 참조로 반환되면 `useMemo` 무력화 | `use-expression-context.ts:55-169` | Zustand 셀렉터에 `useShallow` 또는 개별 원시값 셀렉터 적용 확인 |
| 5 | Performance | `nodeResults` → `Map` 변환 중복 비용 — 스토어에서 이미 Map 형태라면 불필요 | `use-expression-context.ts:57-60` | 실행 스토어에서 `Map<nodeId, result>` 형태 직접 유지 검토 |
| 6 | Performance | `Object.keys()` 렌더마다 재계산 | `variable-picker.tsx:294, 344` | `useMemo`로 캐싱 |
| 7 | Maintainability | Non-null assertion `!` 사용 — 조건 블록 내부이므로 런타임 안전하나 TypeScript narrowing 미활용 | `variable-picker.tsx:353` | 로컬 변수 추출 후 narrowing 확보 |
| 8 | Maintainability | `expandedCategories` 초기 상태 문자열 키 하드코딩 | `variable-picker.tsx:277-284` | `CATEGORIES` 상수 배열 정의 후 `Object.fromEntries`로 초기화 |
| 9 | Maintainability | `as Record<string, unknown>` 반복 타입 단언 남용 | `use-expression-context.ts:89-93` | `NodeData` 인터페이스 정의 후 스토어 노드 타입에 적용 |
| 10 | Maintainability | `NestedFieldItem`의 childSample 추출 로직과 `use-expression-context.ts:147-156`의 동일 로직 중복 | `variable-picker.tsx:113-128` | `getChildSample()` 유틸 함수로 추출 |
| 11 | Testing | `getExpressionToken` 엣지 케이스 미커버 — 닫힌 블록 커서, `{{` 없는 일반 텍스트, 빈 토큰 등 | `use-expression-suggestions.ts:35-61` | 해당 시나리오 테스트 추가 |
| 12 | Testing | `functionNames` 자동완성 및 `.slice(0, 10)` 제한 검증 테스트 없음 | `use-expression-suggestions.ts:220-227` | `functionNames` 주입 후 필터링/슬라이스 동작 검증 테스트 추가 |
| 13 | Requirement | 배열 인덱스 접근 자동완성 미지원 — `$input.items[0].` 형식 토큰 미인식 (스펙 §3.2) | `use-expression-suggestions.ts` 전반 | `[0]` 인덱스 표기 처리 케이스 추가 |
| 14 | Requirement | `tokenStart: 0, tokenEnd: 0` fallback — 토큰 미발견 시 위치 0을 조작할 위험 | `use-expression-suggestions.ts:105` | `tokenStart: cursorPos, tokenEnd: cursorPos` 또는 null 반환으로 변경 |
| 15 | Scope | 테이블 노드 default mode `"dynamic"` fallback 의도 불명확 | `use-expression-context.ts:120` | 주석으로 의도 명확화 또는 fallback 제거 |
| 16 | Testing | `$dataSource` 미노출 케이스 검증 누락 | `use-expression-suggestions.test.ts:248-256` | `expect(labels).not.toContain("$dataSource")` 추가 |
| 17 | Documentation | 복잡한 정규식, 다중 입력 처리 제한사항, `$dataSource` 컨텍스트 제약 등 주요 주석 부재 | 여러 위치 | 핵심 분기 및 정규식에 의도 설명 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Architecture | MEDIUM | 내장 변수 중복 정의, 레이블 기반 노드 조회 취약성, 노드 타입 하드코딩 |
| Testing | MEDIUM | `useExpressionContext`·`VariablePicker` 테스트 완전 부재, 다수 브랜치 미커버 |
| Side Effect | MEDIUM | `ExpressionData` 파괴적 변경, `$dataSource` 기능 불완전 |
| Requirement | MEDIUM | `$trigger`·`$env` 누락, 미실행 힌트·함수 시그니처 미구현, `$dataSource` UI 불일치 |
| Maintainability | MEDIUM | 변수 목록 중복 정의, `FUNCTION_NAMES` 모듈 레벨 초기화 |
| Security | LOW | 노드 레이블 미검증 표현식 삽입, Prototype Pollution 잠재 위험 |
| Performance | LOW | 함수 목록 전체 렌더링, Zustand 셀렉터 참조 불안정 가능성 |
| Concurrency | LOW | `useMemo` 의존성 참조 불안정 (성능 저하 가능성) |
| Documentation | LOW | 내부 컴포넌트·정규식·제한사항 주석 부재 |
| Scope | NONE | 변경 범위 적절, 불필요한 수정 없음 |
| Dependency | NONE | 신규 외부 의존성 없음, 내부 의존성 구조 양호 |

---

## 발견 없는 에이전트

- **Database** — 프론트엔드 UI 로직으로 DB 관련 사항 없음
- **API Contract** — 백엔드 API 계약과 무관한 클라이언트 사이드 로직

---

## 권장 조치사항

1. **`useExpressionContext` 테스트 작성** (WARNING #4) — 가장 복잡한 로직이 테스트 없이 노출된 최우선 리스크
2. **`ROOT_VARIABLES` / `BUILT_IN_VARIABLES` 단일 소스 통합** (WARNING #1) — `expression-constants.ts` 추출로 변수 목록 불일치 방지
3. **`ExpressionData` 인터페이스 소비자 점검** (WARNING #8) — `sourceItemSample` 필수 필드 추가로 인한 컴파일 에러 영향 범위 파악 및 조치
4. **스펙 누락 변수 추가**: `$trigger`, `$env` (WARNING #10) + `$dataSource` 피커 항목 추가 (WARNING #13)
5. **`$dataSource.` 필드 확장 분기 추가** (WARNING #9) — 자동완성 노출 후 필드 탐색 미지원으로 인한 UX 불일치 해소
6. **노드 레이블 이스케이프 처리** (WARNING #14) — 보안 위험 차단
7. **`VariablePicker` 컴포넌트 테스트 추가** (WARNING #5) — 인터랙션 회귀 방지
8. **`$var.`, `$node["..."]` 브랜치 테스트 추가** (WARNING #6, #7)
9. **함수 자동완성 시그니처 추가** (WARNING #12) — 스펙 §7.1 이행
10. **미실행 워크플로우 안내 힌트 구현** (WARNING #11) — 스펙 §8.4.2 이행