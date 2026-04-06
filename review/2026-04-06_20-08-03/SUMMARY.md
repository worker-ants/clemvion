# Code Review 통합 보고서

## 전체 위험도
**LOW** - Switch 노드 `valueType` 기반 타입 강제 변환 기능 추가. 하위 호환성 유지되나, validate 검증 누락 및 프론트엔드·백엔드 타입 불일치가 다수 리뷰어에서 공통 지적됨.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Testing | `coerceCaseValue`가 케이스 값만 단방향 변환하고 `actualValue`는 변환하지 않아 비대칭 동작 발생. `actualValue`가 string `"42"`이고 케이스 `valueType: 'number'`일 때 항상 미스매치 | `switch.handler.ts:75-78` | `actualValue`도 동일 타입으로 변환하거나, 양방향 비교 전략 객체(Strategy 패턴) 도입. 최소한 단방향 동작임을 테스트·주석으로 명시 |
| 2 | Testing | `actualValue`가 string이고 케이스 `valueType: 'number'`일 때 항상 미스매치되는 비대칭 동작에 대한 테스트 없음 | `switch.handler.spec.ts` (누락) | 비대칭 동작 명시 테스트 추가: `input: { x: '42' }`, `value: '42'`, `valueType: 'number'` → default 포트 반환 |
| 3 | Side Effect | 기존 저장 워크플로우의 케이스에 `valueType` 없어도 동작은 유지되지만, 정규화 계약이 코드·문서 어디에도 명시되지 않음 | `switch.handler.ts:91`, `logic-configs.tsx:108-115` | `validate()` 또는 마이그레이션 레이어에서 `valueType` 없는 케이스를 `"string"`으로 정규화하거나, `undefined = string` 계약을 주석으로 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Type Safety | `validate()`에서 `valueType` 허용값 검증 없음. 잘못된 값(`"integer"` 등)이 조용히 pass-through됨 (6개 리뷰어 공통 지적) | `switch.handler.ts:27-58` | `validate()` 내 케이스 루프에 허용값 검사 추가: `!['string','number','boolean'].includes(c.valueType)` |
| 2 | Architecture / Dependency | 프론트엔드 `valueType?: string`이 백엔드 `CaseValueType = 'string' \| 'number' \| 'boolean'`과 불일치 (5개 리뷰어 공통 지적) | `switch.handler.ts:8`, `logic-configs.tsx:104` | 공유 타입 패키지 도입 또는 프론트엔드에도 리터럴 유니온 타입으로 좁히기 |
| 3 | Testing | `switchValue`가 경로 참조(`'x'`)이고 실제 값이 숫자 `42`일 때 `value: '42'`, `valueType: 'number'`로 매칭되는 시나리오 테스트 없음 | `switch.handler.spec.ts` (누락) | `{ x: 42 }`, `switchValue: 'x'`, `value: '42'`, `valueType: 'number'` → `port: 'c1'` 테스트 추가 |
| 4 | Maintainability | `coerceCaseValue` 마지막 `return value`가 사실상 dead code. 새 타입 추가 시 누락 감지 불가 | `switch.handler.ts:107` | `assertNever` exhaustive check 패턴 또는 `switch` 문으로 리팩터링 |
| 5 | Maintainability | `valueType === undefined \|\| valueType === 'string'` 조건이 "미지정"과 "명시적 string"을 같은 분기 처리 — 향후 기본값 변경 시 실수 가능성 | `switch.handler.ts:92-95` | 두 케이스 분리 또는 의도 주석 명시 |
| 6 | Documentation | `coerceCaseValue` 메서드와 `SwitchCase.valueType` 필드에 fallback 정책 설명 주석/JSDoc 없음 | `switch.handler.ts:11-16, 89-107` | JSDoc으로 fallback 정책(`undefined`=string, NaN 시 원본 반환) 명시 |
| 7 | Security | `Number('Infinity')` 등 무한값이 NaN이 아니어서 케이스 값으로 허용됨 | `switch.handler.ts:97` | `Number.isFinite(n)` 조건 추가 고려 |
| 8 | Testing | 테스트명 "should use strict equality (no type coercion)"이 `valueType` 기능 추가 후 의미 모호 | `switch.handler.spec.ts:290` | `"should use strict equality when valueType is not specified"`로 수정 |
| 9 | Architecture | `updateCase(i, "valueType", e.target.value)`에서 key가 `string`으로 느슨하게 처리 | `logic-configs.tsx:163` | `key: keyof SwitchCaseItem`으로 타입 좁히기 |
| 10 | Testing | 프론트엔드 `valueType` select 및 `addCase` 기본값 변경에 대한 컴포넌트 테스트 없음 | `logic-configs.tsx` | `addCase` 시 `valueType: "string"` 기본값 및 select onChange 동작 테스트 추가 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `valueType` validate 미검증, `Infinity` 허용 엣지 케이스 |
| side_effect | LOW | 단방향 강제변환 비대칭 동작, 기존 데이터 마이그레이션 계약 미명시 |
| architecture | LOW | 프론트-백 타입 계약 불일치, validate 누락, 단방향 변환 설계 한계 |
| testing | LOW | 비대칭 동작 테스트 누락, validate 검증 테스트 없음 |
| maintainability | LOW | dead code `return`, undefined/string 분기 모호성 |
| api_contract | LOW | validate 검증 누락, 프론트엔드 타입 느슨 |
| requirement | LOW | validate 검증 누락, 경로 조회 숫자값 매칭 테스트 없음 |
| dependency | LOW | 프론트-백 타입 공유 없음 |
| documentation | LOW | JSDoc 누락, select aria-label 없음 |
| scope | LOW | 프론트엔드 타입 느슨, validate 검증 누락 |
| performance | NONE | 실질적 성능 문제 없음 |
| concurrency | NONE | 동시성 관련 요소 없음 |
| database | NONE | DB 관련 변경 없음 |

---

## 발견 없는 에이전트

- **database** — DB 쿼리/스키마 변경 없음
- **concurrency** — 공유 가변 상태·비동기 경쟁 조건 없음
- **performance** — 실질적 성능 위험 없음 (현재 케이스 규모에서)

---

## 권장 조치사항

1. **[WARNING 해결] `validate()`에 `valueType` 허용값 검증 추가** — 잘못된 값이 조용히 통과되는 것을 방어적으로 차단 (`switch.handler.ts`)
2. **[WARNING 해결] 단방향 변환 비대칭 동작을 테스트로 명시** — `actualValue`가 string일 때 number coercion 케이스가 매칭 안 됨을 테스트로 문서화 (`switch.handler.spec.ts`)
3. **[WARNING 해결] 기존 데이터 `valueType` 미포함 케이스 정규화 계약 명시** — 주석 또는 `validate()`에서 `undefined → "string"` 명시적 처리
4. **[INFO] 경로 조회 숫자값 매칭 시나리오 테스트 추가** — `{ x: 42 }`, `switchValue: 'x'`, `value: '42'`, `valueType: 'number'` 케이스
5. **[INFO] 프론트엔드 `valueType` 타입을 리터럴 유니온으로 좁히기** — `'string' | 'number' | 'boolean'` (공유 타입 패키지는 중장기 과제)
6. **[INFO] 테스트명 수정** — `"should use strict equality"` → `"should use strict equality when valueType is not specified"`
7. **[INFO] `coerceCaseValue` dead code를 exhaustive check로 전환** — 향후 타입 확장 시 컴파일 타임 안전성 확보