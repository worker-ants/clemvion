# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** C2 캐너리가 `it.each` 로 확장됐지만, `resolveConfig`(`resolveString`)의 동일한 catch 경로로 실제 도달 가능한 **4번째 `ExpressionError` 하위 클래스(`ExpressionFunctionError`)가 여전히 빠져 있다** — 주석·plan 문서는 "세 하위 클래스 전부"를 실측했다고 주장하지만 실제로는 최소 4개(Syntax/Reference/Type/**Function**)가 이 경로에서 도달 가능하고, `Function` 경로에 미래에 진단용 속성이 붙어도 이 캐너리는 RED 를 내지 못한다. 직접 뮤테이션으로 확인했다: `packages/expression-engine/src/errors.ts` 의 `FunctionError` 생성자에만 `this.attemptedFunctionSource = message;` 를 주입하고 `npx tsc` 로 재빌드한 뒤 `expression-resolver.service.spec.ts` 를 재실행 — **47/47 GREEN** (RED 를 기대했으나 실패). 원인은 `evaluate()` 가 `{{ unknownFn() }}` / 내장 함수 인자 타입 오류(`{{ uppercase(123) }}`) 등에서 `ExpressionFunctionError`(`code=EXPR_FUNCTION_ERROR`)를 던지는데, 이 클래스가 `it.each` fixture 3종 어디에도 포함되지 않기 때문이다(직접 `evaluate()` 프로브로 재현: `ExpressionFunctionError code=EXPR_FUNCTION_ERROR position=undefined`). `packages/expression-engine/src/__tests__/expression.spec.ts:584-589` 도 `FunctionError` 를 `.code` 값만 검사하고 `Object.keys` 형태는 여기서도 잠그지 않는다. 이 PR 이 바로 이전 라운드(`11_58_35` WARNING #1)의 "syntax 1종만 통과" 결함을 고치며 남긴, **같은 종류의 정량 과소 계산(class-count) 결함이 세 번째로 재발**한 사례다(plan 문서 자체가 "호출 4건 vs 클래스 3개" 오류를 이미 한 번, "5/5 vs 실제 서술 4건" 오류를 또 한 번 지적받은 바로 그 PR).
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:183`(주석 "세 하위 클래스 전부"), `:191-220`(`it.each` fixture 3종, `Function` 없음) / 근거: `codebase/packages/expression-engine/src/errors.ts:47-52`(`FunctionError` 정의), `codebase/packages/expression-engine/src/evaluator.ts:258`(`Unknown function: ...` — 트리거 지점) / 동일 과소 계산이 `plan/in-progress/deps-peer-gating-and-eslint10.md:427`에도 있다.
  - 상세: 뮤테이션 절차 — 원본 `errors.ts` 를 세션 scratch(`mktemp` 류 디렉터리)에 `cp` 백업 → `FunctionError` 생성자에 진단용 속성 1줄 주입 → `packages/expression-engine`에서 `npx tsc` 재빌드(백엔드가 심볼릭 링크+`dist`를 통해 이 패키지를 참조하므로 필요) → `expression-resolver.service.spec.ts` 전체 재실행 → **47/47 passed**(민감 속성이 붙었는데도 캐너리가 못 잡음, 예측과 반대) → scratch 백업본을 `cp` 로 원복 → 재빌드 → `git status --short` 로 저장소 무변경 확인, 재실행으로 47/47 GREEN(정상 상태) 재확인 완료.
  - 제안: `it.each` fixture 에 `['ExpressionFunctionError', '{{ unknownFn() }}', 'EXPR_FUNCTION_ERROR']` (또는 내장 함수 인자 오류를 통한 트리거)를 추가해 4종 전부를 실행 경로로 지나가게 한다. `TimeoutError`/`DepthExceededError` 는 동일 base 클래스라 구조적으로는 같은 위험이지만 트리거 비용(딥 재귀·100ms 대기)이 높아 우선순위는 낮다 — 다만 "전부"라는 주석 표현은 이 두 클래스를 뺀다면 "resolveConfig 로 쉽게 도달 가능한 클래스 전부"처럼 범위를 한정해 적을 것.

- **[INFO]** `it.each` 의 `position` 모양 단언(`shape.position === undefined || Number.isInteger(shape.position)`)이 실제로는 **3개 fixture 중 1개(Syntax)에서만** `Number.isInteger` 분기를 통과한다 — `evaluate()` 를 직접 호출해 확인한 실측: `{{ $input. }}` → `position=11`(정수), `{{ $input.nonExistent.deep }}` → `position=undefined`, `{{ $input.count.b.c }}` → `position=undefined`(둘 다 `evaluator.ts` 의 `evaluateMemberExpression`/`evaluateIndexExpression` 이 position 인자 없이 `ReferenceError`/`TypeError` 를 던지기 때문). 단언 자체는 disjunction 이라 거짓으로 통과하지 않지만(값이 실제로 `undefined` 이므로), "`position` 은 입력 문자열 안의 정수 오프셋이라 비민감이다"라는 인접 주석(같은 파일 184-185행)이 마치 세 클래스 전부에 균일하게 적용되는 것처럼 읽혀 실제 관측과 어긋난다. 테스트 결함은 아니고(허용 범위가 정확히 도메인을 반영), 두 fixture 에서는 "position 이 정수임"을 검증하는 것이 아니라 "position 이 없어도 된다"만 검증하는 셈이라는 점을 밝혀 둔다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:184-185`(주석), `:216-218`(단언)
  - 제안: 급하지 않음. 주석에 "Reference/Type 경로에서는 position 이 항상 `undefined`" 를 한 줄 덧붙이면 위 WARNING 과 같은 종류의 오독을 예방한다.

- **[INFO]** 이전 라운드(`11_58_35`) WARNING #1·#2·#3 은 실제로 잘 해결됐다 — 직접 재현·재실행으로 확인: (1) `it.each` 로 3개 하위 클래스를 각각 `cause.name` 판별력과 함께 실행 경로로 지나가게 확장(단 위 WARNING 대상 1개 잔존), (2) plan 문서 뮤테이션 표에 M3 포함, (3) `captureThrown`/`captureRejected` 헬퍼로 캡처 보일러플레이트를 추출하고 두 spec 파일 전체를 grep 했을 때 잔존하는 구식 `let thrown; try {...} catch` 패턴이 없음을 확인. `npx jest expression-resolver.service.spec.ts code.handler.spec.ts` 재실행 결과 137/137 통과.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:20-34`(`captureThrown`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:9-24`(`captureRejected`)
  - 제안: 없음(확인용 기록).

- **[INFO]** `secret-resolver.service.ts` 변경분은 순수 주석 보강(Rationale 강화)이며 동작 변경이 없다 — 신규/변경 테스트가 필요 없다는 이전 라운드 판정이 그대로 유효하다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95-99`
  - 제안: 없음.

## 검증용 뮤테이션 (수행·원복 완료)

- 대상: `codebase/packages/expression-engine/src/errors.ts` — `FunctionError` 생성자에 `this.attemptedFunctionSource = message;` (필드 선언 포함 2줄) 주입.
- 절차: 원본을 세션 scratchpad(`/private/tmp/claude-501/.../scratchpad/errors.ts.bak`)에 `cp` 로 백업 → 주입 → `packages/expression-engine` 에서 `npx tsc` 재빌드 → `expression-resolver.service.spec.ts` 전체 재실행 → **GREEN 47/47**(RED 기대 실패 — 이것이 발견의 증거) → scratch 백업본을 `cp` 로 원복(`git checkout`/`restore` 미사용) → 재빌드 → `git status --short` 로 저장소가 리뷰 산출물 디렉터리(`review/code/2026/08/29/12_23_45/`)만 untracked 이고 소스 트리는 클린함을 확인 → 재실행으로 GREEN(정상 상태) 재확인.
- 부가로 `evaluate()` 를 scratch 스크립트 없이 `node -e` 인라인으로 직접 호출해 세 fixture(`syntax`/`reference`/`type`) 및 `FunctionError` 트리거(`{{ unknownFn() }}`, `{{ uppercase(123) }}`)의 실제 `name`/`code`/`position`/`Object.keys` 값을 확인했다(저장소에 파일을 만들지 않음, `require('./codebase/packages/expression-engine/dist/index.js')` 로 빌드 산출물만 참조).
- 원복 후 `git status --short` = 리뷰 산출물 디렉터리만 untracked, 저장소 소스 트리는 클린.

## 요약

이번 diff 는 직전 리뷰 라운드(`11_58_35`)가 지적한 세 WARNING(C2 캐너리 커버리지 폭·plan 뮤테이션 표 누락·캡처 보일러플레이트 중복)을 실제로 잘 해결했다 — `it.each` 확장·헬퍼 추출·plan 표 보강 모두 재실행·재확인했다. 다만 그 확장 자체가 "세 하위 클래스 전부"라는 새로운 정량 주장을 남겼는데, 이 주장이 다시 한 번 부정확하다: `resolveConfig` 의 동일 catch 경로로 트리거 비용 없이 도달 가능한 `ExpressionFunctionError` 가 빠져 있고, 실제로 그 클래스에만 진단 속성을 뮤테이션 주입했을 때 캐너리가 GREEN 을 유지해(RED 를 기대) 회귀 가드 사각지대를 직접 재현했다. 같은 PR 이 이미 두 차례(호출 4건 vs 클래스 3개, 뮤테이션 5/5 vs 서술 4건) 정량 과소 서술로 지적받은 바로 그 패턴이 세 번째로 재발한 것이라 구조적 주의가 필요하다. 그 외 테스트 격리·가독성·회귀 유효성은 양호하고, `position` 단언의 disjunction 은 도메인을 정확히 반영해 결함은 아니지만 인접 주석이 오독을 유발할 소지가 있다.

## 위험도

LOW
