# 요구사항(Requirement) 리뷰 — `#1233` C2 캐너리 + `secret-resolver` 주석 보강

## 검증 방법

- `packages/expression-engine/src/errors.ts` 를 직접 열어 `ExpressionError` 계열의 own
  property 구성을 확인하고, 별도 node 스크립트(저장소 밖 동작, 파일 변경 없음)로
  `Object.keys`/`Object.getOwnPropertyNames` 실측을 재현 — 테스트 주석의 수치 주장과 대조.
- `expression-resolver.service.ts` / `code.handler.ts` 의 `cause` 부착·비부착 지점을 직접
  읽어 스펙(`spec/5-system/3-error-handling.md` §6.3.1)과 line-level 대조.
- `npx jest ... -t "C2"` 로 신규 캐너리 2건을 실제 프로덕션 코드에 대해 실행 — 둘 다 GREEN.
- `git diff origin/main -- <4개 파일>` 로 프롬프트에 제시된 diff 와 실제 저장소 상태가
  바이트 단위로 일치함을 확인.
- 저장소 트리는 건드리지 않았다(`git status --short` 로 review 산출물 디렉터리 외 변경 없음
  확인 완료).

## 발견사항

- **[WARNING]** `evaluate()`로 직접 호출해 실측했다는 오류 종류 수(4개)와 나열된 클래스 수(3개)가 서로 다르다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:173-176`
  - 상세: 새로 추가된 주석은 "`evaluate()` 를 **4개** 오류 종류로 직접 호출"했다고 적으면서,
    바로 뒤에는 `ExpressionSyntaxError`·`ExpressionReferenceError`·`ExpressionTypeError`
    **3개**만 나열한다. `packages/expression-engine/src/errors.ts` 에는 이 외에도
    `FunctionError`/`TimeoutError`/`DepthExceededError` 가 있어 "4번째" 후보가 존재하긴
    하지만, 어느 것이 실제로 `evaluate()` 로 확인된 4번째인지 주석에 없다. 반면 같은 내용을
    옮겨 적은 `plan/in-progress/deps-peer-gating-and-eslint10.md:423-429` 쪽은 "evaluate()
    를 4개 오류 종류로 직접 호출해 `ExpressionError` 계열 전부 [...], **`isolated-vm`
    컴파일 예외는 `[]`**" 로 적어 4 = (ExpressionError 계열 3종) + (isolated-vm 컴파일
    예외 1종, `code.handler` 쪽) 으로 자연스럽게 풀린다. 즉 plan 문서의 "4" 는 두 스펙
    파일을 합친 수이고, 테스트 파일 자신의 주석은 "evaluate() 자체를 4번 호출"이라고
    잘못 좁혀 적었다 — `isolated-vm` 컴파일 예외는 `evaluate()` 가 아니라
    `isolate.compileScript()` 경로에서 나온다(`code.handler.ts:451`).
    이 프로젝트는 "주석의 수치·나열이 실측과 정확히 일치해야 한다"는 것 자체가 이번
    PR 전체의 존재 이유(§6.3.1 캐너리 도입 동기가 바로 "주석은 지워져도 아무도 모른다")라,
    사소해 보여도 같은 클래스의 결함이다. 테스트 자체의 정확성(어서션)에는 영향 없음 —
    실제 프로덕션 코드(`ExpressionSyntaxError` 의 own key)로 GREEN 을 실측 확인했다.
  - 제안: "4개 오류 종류" 를 "3개"로 고치거나(정확한 쪽), 실제로 `evaluate()` 를 통해
    4번째 클래스(예: `ExpressionFunctionError`)까지 확인했다면 그 이름을 나열에 추가한다.

## 요약

세 소스 파일 변경(`expression-resolver.service.spec.ts`·`secret-resolver.service.ts`·
`code.handler.spec.ts`)은 모두 **테스트/주석 전용**이며 프로덕션 동작을 바꾸지 않는다.
핵심 주장 — "`ExpressionError` 계열의 own enumerable key 는 `name`/`code`/`position` 뿐이고
`isolated-vm` 컴파일 예외는 `[]`" — 은 소스(`packages/expression-engine/src/errors.ts`,
`code.handler.ts`)를 직접 읽고 별도 node 실측으로 재현해 정확함을 확인했으며, 신규 캐너리
2건은 실제 프로덕션 코드 경로에 대해 GREEN 으로 통과한다. `secret-resolver.service.ts` 추가
주석도 `spec/5-system/3-error-handling.md` §6.3.1 및 그 Rationale ("소비처가 직렬화하는가"
기준을 명시적으로 기각했다는 서술)과 line-level 로 정확히 일치한다. `plan/in-progress/
deps-peer-gating-and-eslint10.md` 의 체크박스 완료 표시(`[x]`) 2건도 실제 diff 내용과
부합한다. 유일한 흠은 신규 테스트 주석 안의 "4개 오류 종류" 카운트와 나열된 이름 수(3개)가
어긋나는 소소한 정밀도 결함으로, 기능적 결함이 아니라 문서 정밀도 문제다. spec 본문과의
불일치(코드가 틀리거나 spec-drift)는 발견되지 않았다.

## 위험도

LOW
