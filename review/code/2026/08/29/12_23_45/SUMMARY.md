# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 없음. WARNING 1건(테스트 회귀 가드 사각지대: C2 캐너리가 동일 catch 경로로 도달 가능한 4번째 오류 클래스를 놓침, `testing` 리뷰어가 뮤테이션으로 실증). 강제 화이트리스트(`router_safety` forced) 7명 전원 결과 확보 — 강제 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | C2 캐너리(`it.each`)가 `resolveConfig`/`code.handler`의 동일 catch 경로로 실제 도달 가능한 **4번째 `ExpressionError` 하위 클래스(`ExpressionFunctionError`)를 여전히 누락**한다. 주석·plan 문서는 "세 하위 클래스 전부"를 실측했다고 주장하지만 실제로는 최소 4개(Syntax/Reference/Type/Function)가 도달 가능하다. `FunctionError` 생성자에 진단용 속성을 뮤테이션 주입하고 재실행한 결과 **47/47 GREEN**(RED 기대와 반대)으로 회귀 가드 사각지대를 직접 재현했다. 같은 PR이 이미 두 차례(호출 4건 vs 클래스 3개, 뮤테이션 5/5 vs 서술 4건) 지적받은 정량 과소서술 패턴이 세 번째로 재발한 사례다. | `expression-resolver.service.spec.ts:183`(주석), `:191-220`(`it.each` fixture, Function 없음); 근거: `packages/expression-engine/src/errors.ts:47-52`(`FunctionError` 정의), `evaluator.ts:258`(트리거 지점); `plan/in-progress/deps-peer-gating-and-eslint10.md:427` | `it.each` fixture에 `['ExpressionFunctionError', '{{ unknownFn() }}', 'EXPR_FUNCTION_ERROR']` 케이스를 추가해 4종 전부를 실행 경로로 지나가게 한다. "전부"라는 주석 문구는 실제로 코드화된 범위(트리거 비용 낮은 클래스들)로 한정해 표현할 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `captureThrown`/`captureRejected` 헬퍼 추출로 "파일 안" 캡처 보일러플레이트 중복(직전 라운드 WARNING #3)은 해소됐으나, 두 헬퍼의 vacuity-guard 설명 JSDoc이 두 spec 파일에 거의 동일한 문장으로 복제되어 "파일 간" 중복이 새로 생겼다. | `expression-resolver.service.spec.ts:20-24`(`captureThrown`), `code.handler.spec.ts:9-14`(`captureRejected`) | 급하지 않음. 공용 위치(test-utils) 또는 한쪽만 정본으로 두고 다른 쪽은 전방 참조. plan에 이미 있는 "enumerable 근거 서술 중복" 항목과 묶어 처리. |
| 2 | Maintainability | `it.each` fixture가 `className`/`expression`/`expectedCode` 전부 `string` 타입 위치 인자 튜플이라, 칼럼 순서 실수를 컴파일 타임에 잡지 못한다(런타임에서는 `cause.name` 판별 단언이 있어 안전, 뮤테이션으로 판별력 확인됨). | `expression-resolver.service.spec.ts:191-198` | 우선순위 낮음. named 치환(`$className`)과 객체 리터럴 배열로 전환 고려. |
| 3 | Testing | `position` 모양 단언(`undefined \|\| Number.isInteger`)이 disjunction이라 거짓 통과는 아니지만, 3개 fixture 중 Syntax 1건만 실제로 정수 분기를 통과하고 Reference/Type 2건은 항상 `undefined`다. 인접 주석이 세 클래스에 균일 적용되는 것처럼 읽혀 오독 소지가 있다. | `expression-resolver.service.spec.ts:184-185`(주석), `:216-218`(단언) | 급하지 않음. 주석에 "Reference/Type 경로는 항상 `position=undefined`"를 명시. |
| 4 | Security / Documentation | `secret-resolver.service.ts`의 "형제 3곳" 카운트가 실제로는 4곳(expression-resolver.service.ts/.spec.ts, code.handler.ts/.spec.ts)과 어긋난다. 이번 diff가 만든 결함이 아니라 직전 라운드에서 이미 지적됐고 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2에 developer SKILL §수렴 예외 근거와 함께 후속 등재돼 있다. | `secret-resolver.service.ts:93` | 조치 불요 — 이미 plan에 후속 항목으로 추적 중 (spec-linked 파일 재편집 비용 때문에 다음 라운드로 미룸이 이 저장소의 확립된 수렴 관례). |
| 5 | Security | C2 캐너리는 "enumerable own key" 축으로 스코프가 명시적으로 한정돼 있어, 향후 `cause`에 `Object.defineProperty(..., {enumerable: false})`로 non-enumerable 민감 속성이 추가되면 잡지 못하는 사각지대가 남는다. 결함이 아니라 문서화된 설계 범위이며 plan에 별도 후속 항목(`GlobalExceptionFilter`/공용 직렬화 유틸 대상)으로 추적 중. | `expression-resolver.service.spec.ts:191-220`, `code.handler.spec.ts:252-260` | 조치 불요 — 이미 plan 추적 중. |
| 6 | 프로세스 (참고) | `requirement` 리뷰어가 검토 도중 `packages/expression-engine/src/errors.ts`에 다른 병렬 reviewer(추정: testing/security)의 검증용 뮤테이션(`FunctionError.attemptedFunctionSource` 주입)이 일시적으로 반영된 상태를 관측했다. 재확인 시점에는 이미 원복되어 `git status --short` clean — 실질 영향 없음, 기록만 남김. | `packages/expression-engine/src/errors.ts` (일시적, 이미 원복) | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 로직 변경 0건(주석 4줄 제외). C2 캐너리 확장이 §6.3.1 C1 AND C2 정책을 실제로 강제함을 검증. 신규 인젝션/시크릿/인증 우회 없음. |
| requirement | NONE | 직전 라운드 WARNING 3건(커버리지 과대 서술·plan 표 누락·보일러플레이트 중복) 전부 소스·테스트 실행·spec 대조로 재검증하여 해소 확인. |
| scope | NONE | 3개 커밋 모두 plan §2 후속 항목·직전 리뷰 WARNING과 1:1 대응. 무관한 파일 수정·기능 확장·포맷팅 잡음 없음. |
| side_effect | NONE | 순수 테스트 리팩터링 + 주석 전용 변경. 함수 시그니처·전역 상태·네트워크·환경변수 경로 무변경. |
| maintainability | LOW | 캡처 보일러플레이트 중복은 해소했으나 JSDoc 설명이 파일 간에 새로 중복됨(INFO). `it.each` 타입 안전성 낮음(INFO). |
| testing | LOW | C2 캐너리가 `ExpressionFunctionError`(4번째 클래스)를 놓침 — 뮤테이션으로 사각지대 실증(WARNING). `position` 단언 disjunction 오독 소지(INFO). 나머지 WARNING 3건은 해소 확인. |
| documentation | NONE | 직전 라운드 documentation/requirement/testing WARNING 3건 모두 소스 대조로 근본 원인까지 정확히 고쳐졌음을 확인. 신규 문서 결함 없음. |

## 발견 없는 에이전트

- documentation — 자체 "발견사항" 섹션에 Critical/Warning 없음을 명시(`## 발견사항\n\n없음`). INFO 2건은 모두 이전 라운드부터 plan에 등재된 기지의 이연 항목 재확인일 뿐, 이번 diff의 신규 결함 아님.

## 권장 조치사항

1. (WARNING) `expression-resolver.service.spec.ts`의 C2 캐너리 `it.each`에 `ExpressionFunctionError` fixture(예: `{{ unknownFn() }}` → `EXPR_FUNCTION_ERROR`)를 추가해 `resolveConfig` 경로로 도달 가능한 4번째 오류 클래스까지 실행 경로로 지나가게 한다. 동시에 주석의 "세 하위 클래스 전부" 문구를 실제 커버리지 범위로 정정한다.
2. (INFO, 급하지 않음) `captureThrown`/`captureRejected`의 vacuity-guard JSDoc 중복을 정리하고, `secret-resolver.service.ts`의 "형제 3곳"→4곳 정정, "enumerable" 근거 서술 중복 정리를 다음 spec-linked 파일 편집 라운드에서 함께 처리한다(이미 plan에 후속 등재됨, 신규 티켓 불요).
3. (INFO, 선택) `it.each` fixture를 named substitution(`$className`) + 객체 리터럴로 전환해 필드 순서 실수에 대한 정적 안전성을 높인다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (실행된 7명 전원이 forced 화이트리스트에 포함되며, 결과 전원 확보됨 — 강제 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 (prompt에 reviewer별 개별 사유 미제공 — diff가 테스트/주석/plan 문서 전용이라 런타임 성능 영향 없음으로 추정) |
  | architecture | router 판단 (동일 사유 — 구조적 변경 없음) |
  | dependency | router 판단 (동일 사유 — 의존성 변경 없음) |
  | database | router 판단 (동일 사유 — DB 접근 코드 변경 없음) |
  | concurrency | router 판단 (동일 사유 — 동시성 로직 변경 없음) |
  | api_contract | router 판단 (동일 사유 — API 계약 변경 없음) |
  | user_guide_sync | router 판단 (동일 사유 — 사용자 가이드 대상 변경 없음) |
