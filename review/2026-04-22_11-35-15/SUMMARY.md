파일 저장 권한이 필요합니다. 허용해 주시면 계속 진행하겠습니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 기존 워크플로우를 silent breaking change로 파괴하는 치명적 부작용이 존재하며, 배포 전 마이그레이션 계획과 영향도 조사가 필수

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Architecture | **if-else `eq`/`neq` 연산자가 `===`에서 `==`(loose)로 무음 변경** — 기존 if-else 노드의 타입 구분 로직이 마이그레이션 없이 오동작 (`'0' == 0 → true` 등) | `if-else.handler.ts`, `condition-evaluator.util.ts` | `IfElseConfig.strictComparison` 기본값을 `true`로 유지하거나 `schemaVersion` 기반 분기 처리 |
| 2 | Side Effect | **`stripControlFields`가 사용자 데이터 필드 `port`/`status`를 제거** — `{ port: 3306 }`, `{ status: 'active' }` 같은 비즈니스 필드가 다운스트림에서 사라짐 | `execution-engine.service.ts`, `stripControlFields` | 제어 필드를 `__engine__` 프리픽스 등 네임스페이스로 격리. 즉시: 영향받는 워크플로우 전수 조사 |
| 3 | Architecture / Side Effect | **SwitchHandler 기본 비교 `===` → `==` 변경으로 기존 워크플로우 silent misrouting** — `switchValue: '1'`, `cases: [{ value: 1 }]`이 이전엔 `default`로, 이제는 해당 케이스에 매칭됨 | `switch.handler.ts`, `matchByValue()` | 기본값을 strict 유지, loose를 opt-in으로 제공하거나 DB 마이그레이션 스크립트 제공 |
| 4 | Side Effect / Requirement | **SwitchHandler `switchValue` path-lookup 제거** — `switchValue: "user.role"` 형태 기존 워크플로우가 항상 `default`로 라우팅됨 | `switch.handler.ts:97~140` | 배포 전 DB 저장 switch 노드 설정 일괄 마이그레이션 필수 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Architecture | **`not_contains`가 비문자열 타입에서 항상 `true` 반환** — 차단 목록 필터 무력화 가능. `contains`는 `false` 반환으로 비대칭 | `condition-evaluator.util.ts:44` | 타입 불일치 시 `false` 반환으로 통일 |
| 2 | Security | **기본 `==` 비교로 보안 분기 우회 가능** — `null == undefined`, `"0" == false` 등이 인증/인가 조건에서 의도치 않게 통과 | `condition-evaluator.util.ts:30-31` | 보안 관련 분기에 `strictComparison: true` 강제 또는 기본값을 strict로 전환 |
| 3 | Security | **프로토타입 오염 방어가 `getNestedValue` 외부 구현에만 의존** | `condition-evaluator.util.ts:28` | `evaluateCondition` 진입부에 `/__proto__\|prototype\|constructor/` 경로 차단 독립 추가 |
| 4 | API Contract / Side Effect | **SwitchHandler `meta.expression` 필드 제거** — `$node["switch"].meta.expression` 참조하는 프론트엔드/워크플로우 표현식이 조용히 실패 | `switch.handler.ts`, `execute()` | `grep -r "meta\.expression"` 소비 코드 확인 후 마이그레이션 |
| 5 | Scope | **`mode: 'expression'` 신규 기능이 버그픽스 PR에 혼재** — `strictComparison`, `hasDefault: null` 동작 변경도 동반 | `switch.handler.ts`, `if-else.handler.ts` | 기능 확장과 버그픽스 분리 PR 처리 또는 의도된 범위 명시 확인 |
| 6 | Maintainability / Requirement | **`IfElseHandler.validate`에 `strictComparison` boolean 검증 누락** — SwitchHandler는 검증하지만 IfElse는 누락 | `if-else.handler.ts`, `validate()` | `if (strictComparison !== undefined && typeof strictComparison !== 'boolean') errors.push(...)` 추가 |
| 7 | Maintainability | **`VALID_OPERATORS` 배열과 `ConditionOperator` 타입 수동 동기화 필요** — 새 연산자 추가 시 컴파일 타임에 불일치 감지 불가 | `if-else.handler.ts`, `condition-evaluator.util.ts` | `CONDITION_OPERATORS`를 `as const` 배열로 export하고 타입 파생 |
| 8 | Architecture | **제어 필드 목록이 두 레이어에 중복 정의** — 향후 필드 추가 시 두 곳 동시 수정 필요 | `handler-output.adapter.ts`, `execution-engine.service.ts` | `CONTROL_FIELDS` 상수 단일 소스 선언 후 양쪽에서 import |
| 9 | Architecture | **SwitchHandler가 `value`/`expression` 두 전략 담당으로 SRP 위반** — 세 번째 mode 추가 시 복잡도 선형 증가 | `switch.handler.ts:execute()` | `SwitchStrategy` 인터페이스 패턴 또는 별도 핸들러 분리 검토 |
| 10 | Requirement / Side Effect | **`hasDefault: null` 검증 동작 변경** — 기존 `null` 허용에서 validation 에러 발생으로 변경. 테스트 없음 | `switch.handler.ts:82-84` | `null` 케이스 테스트 추가 또는 명시적 허용/거부 결정 문서화 |
| 11 | Dependency | **`==`/`!=` 루스 비교가 ESLint `eqeqeq` 규칙과 충돌 가능** | `condition-evaluator.util.ts:28,29`, `switch.handler.ts:152` | 해당 라인에 `// eslint-disable-next-line eqeqeq` 추가 |
| 12 | Testing | **`coerceCaseValue` 핵심 분기 커버리지 제거** — boolean 강제 변환, NaN 방어 테스트가 대체 없이 삭제 | `switch.handler.spec.ts` | 삭제된 boolean/NaN/valueType 명시 케이스 테스트 재추가 |
| 13 | Testing | **`if-else.handler` 레벨의 `strictComparison` 통합 테스트 없음** | `if-else.handler.ts` | 핸들러 spec에 `strictComparison: true` 시 타입 다른 값 매칭 거부 테스트 추가 |
| 14 | Testing | **느슨한 비교(`==`) 경계값 미테스트** — `null == undefined`, `0 == false`, `'' == 0` 미커버 | `switch.handler.spec.ts`, `condition-evaluator.util.spec.ts` | 경계값 케이스 명시적 테스트로 의도된 동작 문서화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | JSDoc에 폐기된 함수명 `stripSelectedPort` 잔류 | `handler-output.adapter.ts` JSDoc | `stripControlFields`로 수정 |
| 2 | Documentation | `condition-evaluator.util.ts` 신규 공개 함수·타입에 JSDoc 전무 | `condition-evaluator.util.ts` | `evaluateCondition`, `Condition`, `EvaluateOptions` JSDoc 추가 |
| 3 | Documentation | `SwitchConfig` 신규 필드 `mode`, `strictComparison` 인라인 JSDoc 없음 | `switch.handler.ts` 인터페이스 | `/** @default 'value' */` 등 인라인 주석 추가 |
| 4 | Documentation | `matchByValue`의 `==` 사용에 의도 주석 없음 — 실수로 오해 가능 | `switch.handler.ts`, `matchByValue()` | `// intentional loose equality — strict mode uses === above` 추가 |
| 5 | API Contract | `SwitchConfig.switchValue` `required → optional` 변경으로 런타임 계약과 타입 계약 불일치 | `switch.handler.ts`, `SwitchConfig` | discriminated union으로 표현 권장 |
| 6 | Security | 에러 메시지에 핸들러 반환값 최대 200자 노출 — 민감 데이터 로그 유출 가능 | `handler-output.adapter.ts:51-55` | 반환값 실제 값 대신 shape(키 목록)만 포함 |
| 7 | Concurrency | `stripControlFields`가 제어 필드 부재 시 원본 참조 반환 — 병렬 실행 시 변이 가능성 (기존 구조) | `execution-engine.service.ts` | 핸들러 불변 입력 컨벤션 명시적 강제 가이드라인 |
| 8 | Performance | `evaluateCondition` 기본 파라미터 `{}` 매 호출마다 새 객체 생성 | `condition-evaluator.util.ts:26` | 모듈 레벨 `DEFAULT_OPTIONS` 상수로 추출 |
| 9 | Performance | `{ strict }` 리터럴이 `cases.find` 콜백 내 매 iteration 생성 | `switch.handler.ts:113` | `const evalOptions = { strict }` 로 execute 내 한 번만 생성 |
| 10 | Maintainability | `resolvedMode`가 `validate()`와 `execute()`에 중복 계산 | `switch.handler.ts` | `private static readonly DEFAULT_MODE` 상수 정의 |
| 11 | Testing | `not_contains` 비문자열 케이스 의도 미명시 | `condition-evaluator.util.spec.ts` | 비문자열 → `true` 반환 명시 테스트 추가 |
| 12 | Testing | `is_not_empty`의 `0`, `false` falsy-but-not-empty 케이스 미테스트 | `condition-evaluator.util.spec.ts` | 해당 케이스 명시 테스트 추가 |
| 13 | Testing | regression 테스트에서 `data` 합성 필드 미검증 | `execution-engine.service.spec.ts` | `toEqual` 또는 `not.toHaveProperty('data')` 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | HIGH | 기본 비교 strict→loose 무음 변경, `port`/`status` 사용자 데이터 제거, path-lookup 제거 |
| Architecture | HIGH | SwitchHandler 기본 비교 breaking change, 제어 필드 이중 정의, SRP 위반 |
| Scope | MEDIUM | `mode: 'expression'` 기능 확장이 버그픽스 PR에 혼재 |
| Requirement | MEDIUM | `strictComparison` 검증 누락, `hasDefault: null` 미검증, switchValue 통합 테스트 부재 |
| Testing | MEDIUM | `coerceCaseValue` 커버리지 제거, `strictComparison` 핸들러 레벨 미검증, `==` 경계값 미테스트 |
| Security | LOW (조건부 MEDIUM) | 기본 `==` 보안 우회 가능성, `not_contains` 비문자열 항상 `true`, 프로토타입 방어 외부 의존 |
| API Contract | LOW | `meta.expression` 제거, `port`/`status` 우선순위 역전 |
| Maintainability | LOW | `VALID_OPERATORS` 수동 동기화, IfElse 검증 불일치 |
| Documentation | LOW | JSDoc 폐기 함수명 잔류, 신규 유틸 JSDoc 전무 |
| Dependency | LOW | `==` 사용 ESLint `eqeqeq` 충돌 가능성 |
| Performance | LOW | 기본 파라미터 객체 반복 생성, `{ strict }` 리터럴 반복 할당 |
| Concurrency | LOW | 원본 참조 반환 패턴 (기존 아키텍처 구조) |
| Database | NONE | 해당 없음 (인메모리 레이어만 변경) |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 변경 파일 전체가 인메모리 실행 엔진 레이어에 한정, DB 접점 없음 |

---

## 권장 조치사항

### 즉시 처리 (배포 차단)
1. **기존 워크플로우 영향도 조사**: `switchValue` path-lookup 제거 및 기본 비교 strict→loose 전환으로 영향받는 워크플로우 인벤토리 확인. 마이그레이션 스크립트 없이 배포 금지
2. **`port`/`status` 사용자 데이터 충돌 검증**: `stripControlFields` 제거 필드명과 동일한 비즈니스 데이터를 반환하는 핸들러 전수 조사
3. **if-else 하위 호환성 확보**: `IfElseConfig.strictComparison` 기본값을 `true`로 설정해 기존 strict 동작 유지

### 단기 처리 (이번 PR 내)
4. `IfElseHandler.validate`에 `strictComparison` boolean 검증 추가
5. `not_contains` 비문자열 반환값 `false`로 변경 또는 테스트로 의도 명시
6. `evaluateCondition` 진입부에 프로토타입 오염 방어 독립 추가
7. 삭제된 `coerceCaseValue` 분기 테스트 재추가 (boolean 강제 변환, NaN 방어)
8. ESLint `eqeqeq` disable 주석 추가

### 중기 처리 (후속 PR)
9. `CONTROL_FIELDS` 상수 단일 소스화
10. `CONDITION_OPERATORS` 배열 export로 `VALID_OPERATORS` 수동 동기화 제거
11. `condition-evaluator.util.ts` JSDoc 추가
12. `meta.expression` 소비 코드 마이그레이션