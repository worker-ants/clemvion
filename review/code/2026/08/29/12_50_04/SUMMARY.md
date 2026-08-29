# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 로직 변경 없음(순수 테스트/주석/plan 문서 diff). Critical/보안/스코프/부작용 이슈 없음. WARNING 2건 — 둘 다 이전 라운드가 이미 반복 지적한 "실측 개수/판별력 서술이 실제 코드보다 넓게 말한다" 패턴의 재발이며, 방어선 붕괴가 아니라 캐너리 정밀도·주석 정확성 문제.

강제 화이트리스트(router_safety forced: documentation, maintainability, requirement, scope, security, side_effect, testing) **전원 결과 확보됨** — 강제 포함 reviewer 중 누락된 결과는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `error-shape.spec.ts` 의 클래스별 `code` "모양" 단언(`Object.values(ErrorCode)).toContain(err.code)`)이 실제로는 "이 서브클래스가 그 코드를 쓰는가"를 검증하지 않는다. `SyntaxError`/`ReferenceError`의 `ErrorCode`를 맞바꾸는 뮤테이션으로 실측 확인(9/9 GREEN, 즉 못 잡음). `TimeoutError`/`DepthExceededError`는 이 클래스-코드 매핑을 어느 테스트도 검증하지 않는다(backend `it.each`는 이 두 클래스를 커버 못 함) | `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:61` | `SUBCLASSES` 옆에 예상 `ErrorCode`를 테이블로 나열하고 `expect(err.code).toBe(expectedCode)` 정확값 비교로 전환 |
| 2 | documentation | C2 캐너리 `it.each` 콜백 내부 인라인 주석이 fixture 개수를 "셋"으로 서술하지만 실제 배열은 3라운드에서 4개(`ExpressionFunctionError` 추가)로 늘었다. 같은 함수 안 상위 설명 블록(189-194행)은 이미 "네 종"으로 정확히 갱신되어 국소적 drift만 남음 — 이 PR이 이미 3차례 고친 동일 결함 패턴의 4번째 재발 | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:216` | `// fixture 판별력 — 셋이` → `// fixture 판별력 — 넷이` 로 한 단어 정정 (비용 낮음, 즉시 반영 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 같은 `error-shape.spec.ts` `it.each`의 `position` "모양" 단언(`err.position === undefined \|\| Number.isInteger(err.position)`)이 이 파일 안에서는 fixture가 `position` 인자를 절대 넘기지 않아 `Number.isInteger` 분기가 한 번도 실행되지 않는 vacuous 단언. 실제 정수 검증은 backend `it.each`(4클래스)가 수행하므로 전체 방어선 구멍은 아님 | `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:62-64` | fixture에 실제 `position` 값을 실어 `Number.isInteger` 분기를 최소 1회 실행되게 하거나, 검증 불가함을 주석에 명시 |
| 2 | maintainability | `captureThrown`/`captureRejected` 캡처 헬퍼가 sync/async 쌍으로 거의 동일 구조·JSDoc을 두 spec 파일에 독립 정의 — 저장소에 이미 `__test-utils__` 공유 헬퍼 관례가 존재함에도 따르지 않음 (이전 라운드부터 지적, plan 백로그 추적 중) | `expression-resolver.service.spec.ts:25-34`, `code.handler.spec.ts:15-24` | 급하지 않음. 다음 편집 시 공용 `__test-utils__`로 이동 |
| 3 | maintainability | `it.each` fixture 튜플이 위치 기반 `string[]`이라 필드 순서 실수를 컴파일 타임에 못 잡음(런타임 가드는 존재, 뮤테이션으로 확인됨) | `expression-resolver.service.spec.ts:199-207` | 우선순위 낮음. named substitution + 객체 리터럴 배열로 전환 고려 |
| 4 | maintainability / documentation | "enumerable own key를 축으로 쓰는 이유" 설명이 backend 2곳 + 신규 패키지 캐너리까지 총 3곳에 거의 동일 문장으로 중복 서술 (`code.handler.spec.ts`는 참조만 해 중복을 피하는 선례를 보임에도 신규 파일은 전문을 다시 씀) | `error-shape.spec.ts:19-22`, `expression-resolver.service.spec.ts:178-181` | 급하지 않음(추적 중). 정리 시 §6.3.1 Rationale로 승격 후 세 파일은 전방 참조만 남기는 것 고려 |
| 5 | documentation | `secret-resolver.service.ts:93`의 "형제 3곳" 카운트가 실제로는 4곳(형제 지점 재확인) — 1라운드부터 지적, plan §2에 이미 등재 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` | 조치 불요(이미 tracked) |
| 6 | requirement / security | C2 캐너리 측정 축("enumerable own key")은 spec 본문 문구를 그대로 조작화한 것이 아니라 세부 구현 선택이며, non-enumerable 민감 속성 사각지대는 이미 plan §2 "cause 비노출 불변식의 계측 지점" 항목으로 추적 중 — spec이 다루지 않는 회색지대, spec-drift 아님 | `expression-resolver.service.spec.ts:178-181`, `spec/5-system/3-error-handling.md:494` | 조치 불요(이미 tracked) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 로직 변경 없음. 기존 에러-래핑 보안 정책(§6.3.1 C1/C2)을 런타임 단언으로 승격하는 순증 변경. 하드코딩 시크릿·인젝션·인가 우회 없음 |
| requirement | NONE | 2라운드 WARNING(4번째 ExpressionError 하위클래스 누락)이 정확히 해소됨. 소스 대조·jest 직접 실행(138/138, 9/9)으로 재현 확인 |
| scope | NONE | 실 코드/문서 변경 5개 파일 전부 plan §2 등재 항목 범위 안. 무관한 리팩토링·기능 확장·설정 변경 없음. review/ 산출물 22개는 규약대로 정상 위치 |
| side_effect | NONE | 전역 상태·파일 I/O·시그니처·env·네트워크·이벤트 경로 변경 없음. 신규 헬퍼는 함수 스코프 로컬 변수만 사용 |
| maintainability | LOW | 캡처 헬퍼 중복(2곳), fixture 튜플 타입 안전성, 근거 서술 3중 중복 — 전부 INFO, 이전 라운드부터 plan 백로그 추적 중 |
| testing | LOW | error-shape.spec.ts의 `code` 클래스-코드 매핑 단언이 뮤테이션으로 미탐지 확인됨(WARNING), `position` 단언은 이 파일 내 vacuous(INFO) |
| documentation | LOW | C2 캐너리 인라인 주석 개수 서술 drift(3→4개 fixture 반영 누락, WARNING) — 동일 결함 패턴의 4번째 재발. 나머지 2건 INFO는 이미 tracked 확인 |

## 발견 없는 에이전트

security, requirement, scope, side_effect — Critical/Warning 없음(security·requirement·scope·side_effect는 INFO 포함 전부 문제 없음 또는 이미 추적 중인 사안만 재확인).

## 권장 조치사항

1. `expression-resolver.service.spec.ts:216`의 인라인 주석 "셋이" → "넷이" 정정 (비용 낮음, 즉시 반영 권장 — 동일 결함 패턴 4번째 재발이므로 이번 라운드에 바로 닫는 것을 권장).
2. `error-shape.spec.ts`의 `code` 단언을 클래스-코드 정확값 비교(`expect(err.code).toBe(expectedCode)`)로 전환해 `TimeoutError`/`DepthExceededError`의 클래스-코드 매핑 회귀를 탐지 가능하게 함.
3. (급하지 않음, 이미 plan 백로그 추적 중) `position` vacuous 단언 보강, 캡처 헬퍼 `__test-utils__` 이동, "enumerable 축" 근거 서술 3중 중복 정리, "형제 3곳"→4곳 정정 — 다음 편집 라운드에 일괄 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 표 참조 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **전원 결과 확보됨**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트/주석/plan 전용)와 무관 |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | router 판단상 이번 diff와 무관 |
  | database | router 판단상 이번 diff와 무관 |
  | concurrency | router 판단상 이번 diff와 무관 |
  | api_contract | router 판단상 이번 diff와 무관 |
  | user_guide_sync | router 판단상 이번 diff와 무관 |
