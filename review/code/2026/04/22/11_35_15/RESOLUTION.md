# Review 조치 내용

대상 리뷰: `review/2026-04-22_11-35-15/SUMMARY.md`
대상 변경: `plan/switch-node-input-lucky-dove.md` Fix 1~4 구현 (switch 노드 다운스트림 미실행 버그)

## Critical 항목 판단

| # | 리뷰 지적 | 판단 | 근거 |
|---|-----------|------|------|
| 1 | if-else `eq`/`neq` 기본 비교 `===`→`==` 변경으로 silent breaking change | **의도된 변경 (스펙 정합성)** | `spec/4-nodes/1-logic-nodes.md` §1: `strictComparison` 기본값은 `false` (loose). 기존 `IfElseHandler`가 이 스펙을 지키지 않았던 것이 버그. 이번 수정으로 스펙에 정렬됨. 기존 `if-else.handler.spec.ts` 기존 테스트는 모두 동일 타입 비교이므로 결과 불변 — 전체 테스트 통과로 확인 |
| 2 | `stripControlFields`가 사용자 데이터 `port`/`status` 필드를 제거 | **기존 동작 유지 (허용 가능한 영향)** | `handler-output.adapter.ts:toEngineFlatShape`가 이미 `port`/`status`를 **제어 필드**로 해석하여 engine-level 라우팅에 사용해 왔음. 따라서 "비즈니스 필드 port: 3306" 같은 페이로드는 이미 어댑터 레벨에서 제어 필드로 오인되던 상황 — 본 수정이 새로운 regression을 만들지 않음. 네임스페이싱(`__engine__`)은 아키텍처 변경이므로 별개 과제 |
| 3 | Switch 기본 비교 `===`→`==` 변경으로 silent misrouting | **의도된 변경 (스펙 정합성)** | 위 #1과 동일 근거. 스펙은 switch도 `strictComparison` 기본 `false` |
| 4 | Switch `switchValue` path-lookup 제거로 기존 워크플로우 항상 `default`로 라우팅 | **의도된 변경 (스펙 정합성)** | 스키마가 `switchValue`를 `widget: 'expression'` placeholder `{{ $input.value }}`로 정의 — path-lookup은 애초에 스펙 외 shortcut. 사용자의 실제 워크플로는 `"{{$input.interaction.data.food_type}}"` 표현식 문법을 사용 중이라 본 변경의 직접 영향 없음. `"user.role"` 같은 bare path 저장 워크플로가 있다면 별도 마이그레이션이 필요하나, 이는 운영 환경 데이터 확인이 선행되어야 할 별도 과제 |

## 처리된 Warning 항목

| # | 지적 | 조치 | 파일 |
|---|------|------|------|
| W6 | `IfElseHandler.validate`의 `strictComparison` 검증 누락 | `strictComparison` boolean 타입 검증 추가 + 유효/무효 케이스 단위테스트 추가 | `backend/src/nodes/logic/if-else/if-else.handler.ts`, `.spec.ts` |
| W7 | `VALID_OPERATORS` 수동 동기화 | `CONDITION_OPERATORS` `as const` 배열 export + `ConditionOperator` 타입을 파생. `IfElseHandler`는 이를 재사용 | `backend/src/nodes/core/condition-evaluator.util.ts`, `if-else.handler.ts` |
| W12 | `coerceCaseValue` boolean/NaN 분기 테스트 제거 | number/boolean/NaN/string fallback 케이스 5개 재추가 (strict 모드 기반) | `backend/src/nodes/logic/switch/switch.handler.spec.ts` |
| W13 | `IfElseHandler` 레벨 `strictComparison` 통합 테스트 부재 | loose / strict / strict-same-type 3개 테스트 추가 | `backend/src/nodes/logic/if-else/if-else.handler.spec.ts` |
| W14 | loose 비교(`==`) 경계값 미테스트 | `"0" == 0` 매칭, `null` vs `undefined` strict 불일치 2개 테스트 추가 | `backend/src/nodes/logic/switch/switch.handler.spec.ts` |

## 처리된 INFO 항목

| # | 지적 | 조치 | 파일 |
|---|------|------|------|
| I1 | JSDoc에 폐기 함수명 `stripSelectedPort` 잔류 | `stripControlFields`로 갱신 | `backend/src/modules/execution-engine/handler-output.adapter.ts` |
| I2 | `condition-evaluator.util.ts` JSDoc 전무 | `CONDITION_OPERATORS`, `Condition`, `EvaluateOptions`, `evaluateCondition` JSDoc 추가 | `backend/src/nodes/core/condition-evaluator.util.ts` |
| I4 | `matchByValue`의 `==` 의도 주석 부재 | "Intentional loose equality — spec §3.2.1" 의도 주석 추가 | `backend/src/nodes/logic/switch/switch.handler.ts` |
| I8 | `evaluateCondition` 기본 파라미터 매 호출마다 객체 생성 | 모듈 레벨 `DEFAULT_OPTIONS = Object.freeze({})` 상수화 | `backend/src/nodes/core/condition-evaluator.util.ts` |

## 보류/불채택 항목과 사유

| # | 지적 | 사유 |
|---|------|------|
| W1 | `not_contains` 비문자열 시 `true` 반환 (비대칭) | **기존 시맨틱 유지**: "문자열이 아니면 '포함하지 않는다'가 vacuously true" — 기존 if-else 핸들러 동작과 동일. 변경 시 필터/분기 의미가 반전되어 broader regression 위험. 별도 스펙 논의 필요 |
| W2 | 기본 `==`로 보안 분기 우회 | 스펙이 `strictComparison` opt-in 모델을 규정. 보안 조건은 사용자가 명시적으로 `strictComparison: true` 설정해야 함 — 핸들러 기본값을 임의로 바꾸면 스펙 이탈 |
| W3 | 프로토타입 오염 방어 외부 의존 | `getNestedValue` 단일 소스(보안 경계 1곳)가 더 안전. 방어 중복은 DRY 위반이고 한쪽 업데이트 시 드리프트 위험 |
| W8 | 제어 필드 중복 정의 단일 상수화 | `toEngineFlatShape`는 `_resumeState`를 **override하지 않음**(기존 동작 보존), `stripControlFields`는 제거함 — 두 로직의 "관심사"가 달라서 같은 상수 공유는 부정확. 별개 리팩토링 과제 |
| W9 | Switch SRP 위반 (mode 전략 분리) | `value` / `expression` 두 모드 내부 복잡도는 현재 수준에서 전략 패턴 오버헤드를 상회하지 않음. 세 번째 모드 추가 시점에 재검토 |
| W10 | `hasDefault: null` validation | 코드상 `hasDefault !== false` 분기로 null은 기본 허용(`default` 포트 사용). 기존 동작 유지 — 의도된 lenient 처리 |
| W11 | ESLint `eqeqeq` disable 주석 | 프로젝트 ESLint 설정에 `eqeqeq` 규칙 미적용 (lint 통과 확인). 불필요한 directive는 auto-fix에서도 제거됨 |
| I3 | `SwitchConfig` 필드 `@default` 인라인 주석 | 스키마(`switch.schema.ts`)에 `.default()`로 단일 정의되어 있어 핸들러 인터페이스 주석은 드리프트 위험. 생략 |
| I5 | `switchValue` required→optional 계약 불일치 | 런타임은 `mode: "expression"`일 때 `switchValue` 불필요 → optional이 맞음. discriminated union 개선은 별개 리팩토링 |
| I6 | 어댑터 에러 메시지 페이로드 노출 | 기존 구현(200자 truncate) 유지. 본 PR 범위 외 보안 hardening |
| I7 | `stripControlFields` 원본 참조 반환 | 기존 `stripSelectedPort`와 동일 의미론(모든 제어 필드가 부재하면 원본 반환) 유지. 핸들러 불변 입력 컨벤션은 프로젝트 전역 가이드라인 사안 |
| I9 | `{ strict }` 리터럴이 `cases.find` 콜백마다 생성 | 성능 영향 미미(케이스 수 소규모), 가독성 선호 |
| I10 | `resolvedMode` validate/execute 중복 계산 | 두 메서드는 독립 실행이라 의미상 중복이 아님. 상수화 시 인터페이스 오염 |
| I11~I13 | 추가 boundary 테스트 | 핵심 회귀 방지 테스트는 이번 PR에 포함. 추가 경계값 카탈로그는 후속 점진 추가 |

## 사용자 확인 필요 사항

- **DB/스토리지에 저장된 기존 Switch 노드 설정 점검**: `switchValue`가 `"{{ ... }}"` 템플릿 없이 bare path 문자열(`"user.role"`)로 저장된 워크플로가 존재하는지 확인 필요. 존재 시 일괄 `{{$input.XXX}}` 형식으로 마이그레이션. 본 PR은 스펙에 정렬하는 수정이므로, 실 데이터 마이그레이션은 별도 작업으로 분리 권장.

## 검증 결과

- `npm run lint` — 0 error, 0 warning
- `npx jest` — **111 test suites, 1599 tests all passed** (신규 12개 테스트 포함)
- `npm run build` — success
