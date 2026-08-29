# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 4개 파일(테스트 2건 추가 + 주석 보강 1건 + plan 문서 갱신)만 변경됐고 프로덕션 로직 변경은 0건이다. 다만 신규 C2 캐너리 주석의 "실측 개수" 서술이 실제 코드화된 커버리지와 어긋나는 결함(WARNING 3건, 서로 연관)이 세 명의 reviewer(requirement/testing/documentation)에게서 독립적으로 지적됐다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement / Documentation | C2 캐너리 주석이 "`evaluate()`를 4개 오류 종류로 직접 호출"이라 주장하지만 실제 나열은 `ExpressionSyntaxError`·`ExpressionReferenceError`·`ExpressionTypeError` 3개뿐이고, **코드화된 단언은 그중 syntax-error 1종만** 실행 경로로 검증한다. `ReferenceError`/`TypeError` 계열에 향후 민감 속성이 추가돼도 이 캐너리는 RED 를 내지 못한다(구조상 현재는 안전하지만 회귀 가드는 없음). | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:173-200`, `plan/in-progress/deps-peer-gating-and-eslint10.md:426-429` | "4개"→"3개"로 정정하거나 실제 4번째 클래스명·결과를 추가. `it.each` 로 SyntaxError/ReferenceError/TypeError 세 유형 모두를 순회하며 `Object.keys(cause).sort()` 를 단언하도록 캐너리를 확장. |
| 2 | Documentation | plan 문서의 뮤테이션 검증표가 "5/5 RED (예측과 전부 일치)"라 선언했으나 본문에는 M1·M2·M4·M5 4건만 서술돼 있고 M3 는 파일 전체에서 한 번도 등장하지 않는다. | `plan/in-progress/deps-peer-gating-and-eslint10.md:430-433` | M3 이 무엇을 뮤테이션했고 결과가 무엇인지 보강하거나, 실제 4개만 수행했다면 "5/5"를 "4/4"로 정정. |
| 3 | Maintainability | "예외 캡처 + vacuity-guard" try/catch 보일러플레이트가 각 spec 파일 안에서 기존 테스트와 신규 C2 캐너리 사이에 거의 그대로 반복된다(파일당 2회, 형제 파일까지 포함하면 유사 패턴 4회). 세 번째 캐너리가 추가되면 복붙이 3회가 된다. | `expression-resolver.service.spec.ts:147-162`(기존)·`:177-190`(신규), `code.handler.spec.ts:205-218`(기존)·`:244-261`(신규) | `throwsAndCapture(fn)` 같은 로컬 헬퍼로 캡처 로직을 추출하고 vacuity-guard 설명은 헬퍼 JSDoc 한 곳에만 남긴다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Maintainability | C2 캐너리가 고정하는 축이 "enumerable own key"로 명시적으로 한정돼 있어, 향후 `cause`에 non-enumerable 속성이 추가되면 이 캐너리는 그것을 잡지 못하는 사각지대가 남는다. plan 문서가 이미 후속 항목(계측 지점)으로 추적 중. | `expression-resolver.service.spec.ts:177-200`, `code.handler.spec.ts:244-261` | 조치 불요 — 이미 plan 에 추적 중. |
| 2 | Scope | plan 이 예고한 "한 문장" 추가 대비 실제로는 같은 주제의 4줄 문단이 추가됐다. 취지는 예고와 일치해 실질적 스코프 이탈은 아니다. | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95-99` | 조치 불요. 다음 계획 서술 시 "간단한 보강" 정도로 느슨하게 적을 것. |
| 3 | Documentation | `secret-resolver.service.ts` 의 기존(변경 전) 문맥이 "형제 3곳"이라 서술하나 실제로 C1/C2 를 함께 서술하는 형제 지점은 4곳(`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)이다. 이번 diff 로 생긴 결함은 아님. | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` | 급하지 않음 — 다음에 이 파일을 열 때 "형제 3곳"→"형제 4곳"으로 정정. |
| 4 | Documentation / Maintainability | "enumerable own key" 를 측정 축으로 고른 근거 설명이 spec 문서가 아니라 두 test 파일에 거의 동일한 문장으로 중복 서술돼 있어 향후 drift 위험이 있다. | `expression-resolver.service.spec.ts:167-171`, `code.handler.spec.ts:238-239` | 급하지 않음 — 한쪽이 다른 쪽을 참조하게 하거나 §6.3.1 Rationale 에 한 줄로 단일화. |
| 5 | Maintainability | 두 신규 캐너리의 단언 형태가 다르다(화이트리스트 정렬비교 vs 빈 배열비교). 각 파일의 실측 결과가 다르기 때문으로, 일관성 문제가 아니라 데이터 차이의 정확한 반영이다. | `expression-resolver.service.spec.ts:190`, `code.handler.spec.ts:260` | 조치 불요. |
| 6 | Side Effect | 신규 테스트 2건은 매 테스트마다 새로 생성되는 인스턴스만 사용하고 전역 상태/env/파일시스템을 건드리지 않으며, `secret-resolver.service.ts` 변경은 순수 주석, plan 문서 변경은 코드가 아니라 실행 시점 부작용이 없다. | 4개 변경 파일 전체 | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 로직 변경 없음. 신규 캐너리가 §6.3.1 C1/C2 정책을 강제하는 순증 변경. non-enumerable 사각지대는 이미 plan 추적 중. |
| requirement | LOW | "4개 오류 종류" 주석과 3개 나열 불일치(WARNING #1). 그 외 핵심 주장(화이트리스트 값)은 실측 재현으로 정확함 확인. |
| scope | NONE | plan 이 등재한 두 좁은 후속 항목만 정확히 구현, 무관한 변경 없음. "한 문장"→문단 확장은 INFO. |
| side_effect | NONE | 상태 변경·전역/env/파일시스템/네트워크/시그니처 변경 전무. |
| maintainability | LOW | 캡처 보일러플레이트 반복(WARNING #3). 근거 주석 장황함·단언 형태 차이는 INFO. |
| testing | LOW | C2 캐너리의 실제 코드화 커버리지가 문서 주장보다 좁음(WARNING #1과 동일 근거). 뮤테이션 검증(민감 속성 주입)으로 RED/GREEN 재현 확인 — 테스트 자체 유효성은 양호. |
| documentation | LOW | "4개 vs 3개"(WARNING #1), "5/5 vs 4건 서술"(WARNING #2) 두 정량 불일치. 그 외 문서 품질은 높음. |

## 발견 없는 에이전트

없음 — forced 7개 reviewer 전원이 최소 INFO 이상의 발견을 보고했다(주로 "문제 없음 확인" 성격의 INFO 포함).

## 권장 조치사항
1. `expression-resolver.service.spec.ts:173-176` 의 C2 캐너리 주석 "4개 오류 종류" 서술을 실제 열거(3개)와 일치시키거나, 4번째 클래스를 실제로 검증해 이름과 결과를 추가한다. 같은 문구가 복제된 `plan/in-progress/deps-peer-gating-and-eslint10.md:426-429` 도 함께 정정.
2. C2 캐너리를 `it.each` 로 확장해 `ExpressionReferenceError`/`ExpressionTypeError` 경로까지 `Object.keys(cause)` 를 단언하도록 커버리지를 실제로 넓힌다(테스트 WARNING #1의 근본 해결).
3. `plan/in-progress/deps-peer-gating-and-eslint10.md:430-433` 의 "뮤테이션 5/5" 주장에서 누락된 M3 서술을 보강하거나 "4/4"로 정정한다.
4. (선택, 급하지 않음) 캡처 보일러플레이트를 로컬 헬퍼로 추출해 향후 세 번째 캐너리 추가 비용을 줄인다.
5. (선택, 급하지 않음) `secret-resolver.service.ts:93` 의 "형제 3곳" 카운트를 다음 편집 시 4곳으로 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트/주석/plan) 범위와 무관 |
  | architecture | 프로덕션 구조 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 관련 변경 없음 |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 대면 문서 동기화 대상 아님 |
