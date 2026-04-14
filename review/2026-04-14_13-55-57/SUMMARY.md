# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 커버리지 전무 컴포넌트 다수, React 렌더링 모델 위반 패턴, 보안 방어 일관성 결함이 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `chip-input.tsx` 테스트 파일 전무 — 쉼표 추가, Enter commit, Backspace 삭제, blur commit, 중복 방지 등 복잡한 인터랙션 로직이 모두 미검증 | `chip-input.tsx` 전체 | 쉼표 입력 chip 추가, 중복 방지, Backspace 삭제, blur commit, 빈 값 무시 케이스 테스트 작성 |
| 2 | Testing | `defaults.ts` 테스트 파일 전무 — 11개 operation type의 기본값 생성 로직과 `preserve` 파라미터의 field 보존 분기 모두 미검증 | `defaults.ts` 전체 | 타입 변경 시 field 보존, `object_pick`/`object_omit`의 `field: undefined` 분기 등 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Architecture / Concurrency | 렌더 본문에서 `queueMicrotask(() => setIdState(...))` 호출 — React 렌더링 모델 위반. Strict Mode 이중 렌더 시 microtask 중복 등록, 빠른 연속 조작 시 `nextCounter` 롤백으로 ID 충돌 가능 | `index.tsx:88-102` | `useEffect(() => { setIdState(...) }, [operations.length])`로 교체하거나 `useReducer`로 통합 |
| 2 | Side Effect / Concurrency | `nextCounter`가 렌더 중 `let`으로 증가하여 `addOperation`/`duplicateOperation`에 캡처됨 — Concurrent Mode에서 동일 counter 값이 두 번 사용되어 ID 충돌 가능 | `index.tsx`, `addOperation`, `duplicateOperation` | counter를 `useRef`로 관리하거나 `crypto.randomUUID()` 사용 |
| 3 | Security | ReDoS 취약점 — 사용자 입력 문자열이 `new RegExp(compareValue)` / `new RegExp(search, ...)` 로 직접 컴파일됨. 악의적 패턴(`(a+)+`)이 이벤트 루프를 블로킹 가능, 백엔드 재사용 시 서비스 거부 공격 벡터 | `apply-operation.ts`, `evaluateCondition` regex case, `string_op` replace | 정규식 길이 제한(예: 200자), 또는 `safe-regex` 라이브러리로 악성 패턴 사전 차단 |
| 4 | Security | `object_omit` 루트 처리의 `BLOCKED_KEYS` 필터 누락 — `op.keys`에 `__proto__` 등이 포함될 때 `delete data[key]` 호출됨. 다른 경로는 방어되나 이 경로만 불일치 | `apply-operation.ts`, `object_omit` case, `!op.field` 분기 | `for (const key of op.keys) { if (!BLOCKED_KEYS.has(key)) delete data[key]; }` |
| 5 | Side Effect | `object_omit` (field 있는 경우) 내부 참조를 직접 변형 — `structuredClone`으로 `data`를 복사하지만 `getNested`로 얻은 `target`은 내부 참조. `object_pick`과 달리 새 객체를 생성하지 않아 향후 버그 유발 가능 | `apply-operation.ts`, `object_omit` case (field 있는 경우) | `object_pick`처럼 새 객체를 생성 후 `setNested`로 교체하는 방식으로 통일 |
| 6 | Maintainability / Dependency / Architecture | `DATE_UNITS` 상수 중복 정의 — `types/transform.ts`에 이미 export되어 있으나 `apply-operation.ts`에 동일 내용 재선언. 단위 추가 시 한 쪽만 수정하는 실수 가능 | `apply-operation.ts:12-19`, `types/transform.ts` 말미 | `apply-operation.ts`의 로컬 선언 제거 후 `import { DATE_UNITS } from "@/types/transform"` |
| 7 | Side Effect / Maintainability | `chip-input.tsx` 쉼표 처리 시 `setDraft` 이중 호출 — `setDraft(v.slice(0, -1))`를 먼저 호출 후 `setDraft("")`로 덮어써 첫 호출이 무의미. 중복 값 입력 시 draft에 텍스트가 잔존하는 UX 불일치 | `chip-input.tsx:36-47`, `onChange` 핸들러 | 첫 번째 `setDraft(v.slice(0, -1))` 제거, 중복 여부와 무관하게 항상 `setDraft("")` 호출 |
| 8 | Testing | `apply-operation.test.ts` 커버리지 갭 — `string_op`(uppercase/lowercase/replace/join), `math_op`(add/subtract/multiply/divide/zero-divide), `date_op`(add/subtract/diff), `array_filter` 대부분 연산자, prototype pollution 방어 미검증 | `apply-operation.test.ts` | divide-by-zero 방어, `__proto__` 차단, 각 연산자별 케이스 테스트 추가 |
| 9 | Architecture | `TransformPreview`가 전역 store에 직접 의존 — 설정 패널 내부 컴포넌트가 `useEditorStore`, `useExecutionStore`를 직접 구독하여 재사용·단독 테스트가 어려움 | `preview.tsx:4-5` | `latestInput?: Record<string, unknown>` prop을 상위에서 주입받는 구조로 변경 |
| 10 | Requirement | `preview.tsx` 에러 묵살 — `applyOperations` 예외 시 `catch { return [] }` 처리, 사용자는 오류 원인을 알 수 없고 "연산 없음" 메시지만 표시 | `preview.tsx`, `steps` useMemo catch 블록 | 에러 상태를 별도 관리하여 UI에 오류 단계와 메시지 표시 |
| 11 | Requirement | `set_field` 표현식이 Preview에서 평가되지 않음 — `{{ $input.x }}` 형태 입력이 리터럴 문자열로 저장·표시되어 실행 결과와 Preview 불일치 | `ops.tsx` `SetFieldFields`, `apply-operation.ts` `case "set_field"` | Preview 전용 표현식 평가기 연결 또는 "표현식 포함 — 실행 시 평가됨" 별도 표시 |
| 12 | Requirement | `type_convert` boolean 변환 반직관적 — `Boolean("false")` → `true` 반환. 테스트 미커버 | `apply-operation.ts`, `case "type_convert"` → `case "boolean"` | `"false"`, `"0"`, `"no"` 등을 `false`로 처리하는 스마트 변환 또는 UI 경고 |
| 13 | Performance | `applyOperation` 매 호출마다 `structuredClone` — N개 체인에서 N번 전체 복사 발생, Preview 실시간 계산에서 병목 | `apply-operation.ts`, `applyOperation` 첫 줄 | `applyOperations`에서 최초 1회만 clone하고 내부 mutating 버전으로 분리 |
| 14 | Dependency | `customParseFormat` 플러그인 미사용 import — 실제 코드에서 커스텀 포맷 파싱을 사용하지 않으나 번들에 포함 | `apply-operation.ts:2,10` | 사용하지 않는다면 import 및 `extend` 두 줄 제거 |
| 15 | API Contract | `args?: unknown` 느슨한 타입 — `string_op`, `date_op`의 `args`가 `unknown`으로 선언되어 컴파일 타임 구조 검증 불가, 백엔드 계약 불명확 | `types/transform.ts`, `string_op`/`date_op` | 각 operation별 구체적 args 타입 정의 (예: `{ search?: string; replacement?: string; ... }`) |
| 16 | Documentation | `BLOCKED_KEYS` 보안 의도 미문서화 — prototype pollution 방지 핵심 코드에 이유·대상 공격 설명 없음 | `apply-operation.ts:12` | `// Prototype pollution 방지: 객체 프로토타입 체인 오염을 차단합니다.` 주석 추가 |
| 17 | Requirement | Preview 배열 루트 입력 미지원 — `toDisplayObject`가 배열을 `null`로 처리, 실행 결과 `inputData`가 배열이면 샘플 입력으로 폴백 | `preview.tsx`, `toDisplayObject` | 배열 루트 지원 또는 "배열 입력 미지원" 명시 메시지 |
| 18 | Performance | Preview가 키 입력마다 전체 operation 체인 재계산 — `sampleText` 변경 시 JSON parse + 전체 체인 동시 실행 | `preview.tsx`, `steps` useMemo | `sampleText` 변경에 debounce 적용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `TransformConfig` DnD 상태 관리 미검증 — `queueMicrotask` 동기화, `addOperation` counter 증가, `duplicateOperation` 후 ID 중복 방지 등 버그 가능성 높은 로직 미테스트 | `index.tsx` 전체 | React Testing Library로 추가/삭제/중복 후 ID 배열 상태 검증 |
| 2 | Testing | `preview.tsx` 상태 분기 미검증 — `hasExecutionInput` 분기, `parsedSample` 오류 표시, 예외 묵살 패턴 테스트 없음 | `preview.tsx` | 잘못된 JSON 입력 시 오류 메시지, 실행 이력 유/무 분기 테스트 |
| 3 | Testing | `applyOperations` 빈 배열 케이스 누락 | `apply-operation.test.ts` | `applyOperations({a:1}, [])` → `[]` 반환 검증 |
| 4 | Maintainability | `ObjectPickFields`와 `ObjectOmitFields` 구조 완전 동일 — placeholder만 다름 | `ops.tsx:285-323` | 공통 `ObjectKeyFields` 컴포넌트로 추출, label/placeholder prop으로 차별화 |
| 5 | Performance | `TRANSFORM_OPERATION_TYPES.find()` 매 렌더마다 실행 | `operation-card.tsx:45` | 모듈 상단에 Map lookup 객체 미리 생성: `const TRANSFORM_OP_META = Object.fromEntries(...)` |
| 6 | Performance | `DateOpFields` 내 `unitOptions` 매 렌더마다 재생성 | `ops.tsx`, `DateOpFields` | 컴포넌트 외부 상수로 추출: `const DATE_UNIT_OPTIONS = DATE_UNITS.map(...)` |
| 7 | Performance | 인라인 화살표 함수로 `OperationCard` 매 렌더 재생성 | `index.tsx:160-168`, `operations.map` | `OperationCard`를 `React.memo`로 감싸고 핸들러를 `useCallback`으로 안정화 |
| 8 | Performance | `ChipInput`에서 `values.includes()` 중복 탐색 | `chip-input.tsx:18,33` | `const valueSet = useMemo(() => new Set(values), [values])` 후 `valueSet.has()` 사용 |
| 9 | Scope | `preview.tsx`가 `nodeResults[i].inputData` 참조 — execution store에 이 필드 추가 여부 미확인, `undefined` 평가 가능성 | `preview.tsx:28-34` | execution store에 `inputData` 필드 추가 여부 확인 및 변경 포함 |
| 10 | Documentation | `defaultForType`의 `preserve` 파라미터 동작 미문서화 — field만 보존되고 나머지 속성은 버려진다는 비직관적 동작 | `defaults.ts:6-11` | JSDoc: "타입 변경 시 field 경로만 보존, from/to 등 나머지 속성은 이전되지 않음" |
| 11 | Documentation | `queueMicrotask` 선택 이유 미문서화 — `useEffect` 대신 사용한 trade-off가 기록되지 않음 | `index.tsx:88-102` | 선택 근거와 double render, stale closure 위험을 주석으로 명시 |
| 12 | Documentation | `eq`/`neq` 의도적 느슨한 비교(`==`) 미표기 — lint 경고 유발 가능 | `apply-operation.ts:128-129` | `// 의도적 느슨한 비교: "3" == 3 허용` 주석 추가 |
| 13 | Security (INFO) | `eq`/`neq` 느슨한 비교(`==`) — `"0" == false` 등 예상치 못한 필터 통과 가능 | `apply-operation.ts`, `evaluateCondition` | `===`/`!==`로 교체하거나 의도임을 명시적 문서화 |
| 14 | Maintainability | `preview.tsx`의 `key={i}` 사용 — operation 순서 변경 시 DOM 재사용 오동작 가능 | `preview.tsx:83` | `key={\`${i}-${step.op.type}\`}` 사용 |
| 15 | Architecture | `renderOpFields` switch문이 모든 타입을 직접 처리 — 타입 추가 시 5개 파일 수정 필요 | `index.tsx`, `defaults.ts`, `ops.tsx`, `apply-operation.ts`, `types/transform.ts` | operation 레지스트리 패턴 검토 (확장 빈도에 따라 판단) |
| 16 | Requirement | `math_op` divide 전환 시 기본 operand 0 유지 — 결과 무변화 이유를 사용자가 알 수 없음 | `defaults.ts`, `ops.tsx` `MathOpFields` | `divide` 선택 시 기본 operand를 1로 설정 또는 0 입력 시 UI 경고 |
| 17 | Requirement | `date_op` add/subtract 결과가 항상 ISO 8601 — 원본 포맷(`"2024-01-15"`) 무관하게 시간 포함 문자열로 변환 | `apply-operation.ts`, `date_op` add/subtract | 원본 포맷 보존 또는 스펙에 "결과는 ISO 8601" 명시 후 UI 안내 |
| 18 | Requirement | `apply-operation.test.ts` 추가 누락 케이스 — `rename_field` 존재하지 않는 필드, `object_pick` root level, `array_filter` 비배열 대상 no-op | `apply-operation.test.ts` | 위 케이스 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | HIGH | UI 컴포넌트 및 유틸 함수 테스트 전무, apply-operation 커버리지 낮음 |
| Security | MEDIUM | ReDoS (사용자 입력 정규식 직접 컴파일), object_omit BLOCKED_KEYS 누락 |
| Maintainability | MEDIUM | render 중 queueMicrotask, DATE_UNITS 중복, chip-input 이중 setState |
| Side Effect | MEDIUM | queueMicrotask ID 롤백, object_omit 내부 참조 직접 변형 |
| Performance | MEDIUM | N번 structuredClone, 인라인 핸들러 재생성, Preview 매 키입력 재계산 |
| Architecture | MEDIUM | queueMicrotask 패턴, TransformPreview 전역 store 직접 의존 |
| Requirement | MEDIUM | set_field 표현식 미평가, boolean 변환 반직관, 에러 묵살 |
| Concurrency | LOW | queueMicrotask nextCounter 롤백 (간헐적 ID 충돌) |
| API Contract | LOW | args?: unknown, set_field.value 타입 불명확 |
| Scope | LOW | DATE_UNITS 중복, inputData 필드 의존 store 변경 미포함 |
| Dependency | LOW | DATE_UNITS 중복, customParseFormat 미사용 import |
| Documentation | LOW | BLOCKED_KEYS 보안 의도 미표기, queueMicrotask 선택 근거 누락 |
| Database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 프론트엔드 UI 컴포넌트 및 클라이언트 사이드 로직 — DB 직접 상호작용 없음 |

---

## 권장 조치사항

1. **[Critical] 테스트 작성** — `chip-input.tsx`(인터랙션), `defaults.ts`(타입 변경 분기) 테스트 파일 신규 작성
2. **[Warning] `queueMicrotask` → `useEffect` 교체** — `index.tsx`의 렌더 중 setState 예약 패턴을 `useEffect`로 이관, `nextCounter`를 `useRef`로 전환하여 ID 충돌 원천 차단
3. **[Warning] `apply-operation.test.ts` 커버리지 보완** — 미검증 연산자(string_op, math_op, date_op, array_filter), divide-by-zero, prototype pollution 방어 케이스 추가
4. **[Warning] `object_omit` BLOCKED_KEYS 필터 적용** — keys 루프에 `if (!BLOCKED_KEYS.has(key))` 조건 추가로 보안 방어 일관성 확보
5. **[Warning] ReDoS 방어** — 사용자 입력 정규식에 길이 제한(200자) 또는 `safe-regex` 검증 적용
6. **[Warning] `DATE_UNITS` 단일 소스화** — `apply-operation.ts`의 로컬 선언 제거, `@/types/transform`에서 import
7. **[Warning] `chip-input.tsx` 이중 setState 정리** — 쉼표 처리 시 첫 번째 `setDraft(v.slice(0, -1))` 제거
8. **[Warning] `customParseFormat` 미사용 import 제거** — 번들 크기 감소
9. **[Warning] Preview 오류 처리 개선** — `catch { return [] }` 대신 오류 상태를 UI에 표시
10. **[Info] 성능 최적화** — `applyOperation` 내 clone 전략 개선, `OperationCard` memo 적용, lookup Map 전환