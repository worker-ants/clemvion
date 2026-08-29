# 요구사항(Requirement) 리뷰 — 3라운드 (`12_50_04`)

## 배경

이 diff 는 2라운드(`12_23_45`) 리뷰의 유일한 WARNING — "C2 캐너리(`it.each`)가 동일 catch
경로로 실제 도달 가능한 4번째 `ExpressionError` 하위 클래스(`ExpressionFunctionError`)를
누락한다" — 에 대한 조치다. 실제 코드(파일 1~4)를 직접 열어 대조하고, 관련 spec
(`spec/5-system/3-error-handling.md §6.3.1`)과 line-level 로 대조했으며, 변경된 3개 spec
파일을 `jest` 로 실행해 통과를 직접 재현했다(뮤테이션 재현은 하지 않음 — 그 축은
`testing` 리뷰어 영역이고, 이번 라운드는 회귀 없음 확인이 목적).

## 검증한 것 (문제 없음 확인)

- `expression-resolver.service.spec.ts` 의 `it.each` 가 이제 4개 fixture
  (`ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError`/`ExpressionFunctionError`)
  를 모두 실행 경로로 지나간다 — 2라운드 WARNING #1 이 지목한 정확한 그 결함이 해소됐다.
  `packages/expression-engine/src/errors.ts` 를 직접 읽어 대조한 결과 `ErrorCode` enum 값
  (`EXPR_SYNTAX_ERROR`/`EXPR_REFERENCE_ERROR`/`EXPR_TYPE_ERROR`/`EXPR_FUNCTION_ERROR`)과
  fixture 의 기대값이 정확히 일치한다.
- 신규 `packages/expression-engine/src/__tests__/error-shape.spec.ts` 가
  `ExpressionError` 하위 클래스 **6종 전부**(`SyntaxError`/`ReferenceError`/`TypeError`/
  `FunctionError`/`TimeoutError`/`DepthExceededError`) 를 `Object.entries` 로 열거해서
  검사한다 — `errors.ts` 소스와 대조해 정확히 6종이 맞다. 전수성 단언
  (`하위 클래스를 전부 집어냈다`)이 하드코딩된 이름 배열과 비교하므로, 새 하위 클래스가
  추가돼도 그 단언이 먼저 깨진다(개수 축소·`it.each([]).each` 무의미화 방지).
- `error-shape.spec.ts` 를 직접 실행 — **9/9 통과**. `expression-resolver.service.spec.ts`
  단독 실행 — **48/48 통과**(2라운드 시점 47 + 이번 라운드 추가된 `FunctionError` fixture
  1건 = 48, 산술 일치). `code.handler.spec.ts` 단독 실행 — **90/90 통과**(변경 없음, 그대로).
  두 backend spec 합산 138 테스트 — 실측이 plan 문서가 서술하는 히스토리(2라운드 시점
  "137 tests")와 "+1(FunctionError)" 관계로 정확히 정합한다.
- `TimeoutError`/`DepthExceededError` 는 생성자가 `position` 인자를 받지 않지만, base
  `ExpressionError` 생성자가 `this.position = position`(`undefined`) 을 항상 own-property
  대입하므로 `Object.keys(err)` 에 `position` 이 여전히 포함된다 — 화이트리스트
  `['code','name','position']` 이 6종 전부에 일관되게 적용될 수 있는 근거가 소스 레벨로
  확인된다.
- `secret-resolver.service.ts` 에 추가된 문단("서버 로그에만 남는 것도 아니다"는 C1
  판정의 보조 근거일 뿐 판정축이 아니다)은 `spec/5-system/3-error-handling.md` Rationale
  (575~591행, "`Error.cause` 부착 기준을 '소비처가 직렬화하는가' 로 잡지 않은 이유")의
  내용과 line-level 로 정확히 대응한다 — spec 이 명시적으로 기각한 대안 기준을 코드
  주석이 정확히 같은 근거로 재서술하고 있어 spec fidelity 위반 없음.
- `packages/expression-engine` 의 `package.json` `jest.testRegex` 는
  `".*\\.spec\\.ts$"` 로, `src/__tests__/` 하위 파일도 디렉터리 무관하게 수집된다 —
  신규 테스트 파일이 "작성됐지만 실행되지 않는" 사각지대(과거 이 저장소가 반복
  지적한 패턴)가 아님을 확인.
- 신규 파일 4곳 모두 TODO/FIXME/HACK/XXX 주석 없음.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter `spec_impact: none`
  은 이 plan 이 `spec/` 을 직접 수정하지 않고 인용만 하므로 적절하다.

## 발견사항

- **[INFO]** C2 캐너리의 측정 축("enumerable own key")은 `spec/5-system/3-error-handling.md
  §6.3.1` 본문에 명시된 문구가 아니다 (spec 은 "message·name 밖의 민감 정보를 속성으로
  들고 있지 않다" 라고만 한다 — "enumerable" 한정 없음). 코드 주석 자체가 이 조작화
  (operationalization) 근거를 상세히 설명하고 있고, non-enumerable 사각지대는 이미
  `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 의 "`cause` 비노출 불변식의
  계측 지점" 항목으로 추적 중이다. spec 본문이 "enumerable/non-enumerable" 구분에
  침묵하는 회색지대이므로 CRITICAL/SPEC-DRIFT 아닌 INFO — spec 이 틀렸다거나 코드가
  spec 을 어긴 것이 아니라, spec 이 다루지 않는 세부 구현 선택이다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:178-181`(신규 주석), `spec/5-system/3-error-handling.md:494`(C2 원문)
  - 제안: 조치 불요. 이미 plan 추적 중이며 이번 diff 범위 밖.

- **[INFO]** 2라운드 SUMMARY 가 남긴 INFO #2("`position` 단언이 disjunction 이라 Reference/Type
  경로는 항상 `undefined`" 로 오독 소지)와 INFO #3(`it.each` 위치 인자 튜플의 타입
  안전성)가 이번 라운드에도 그대로 남아 있고, 새로 추가된 `ExpressionFunctionError`
  fixture 도 같은 disjunction 단언을 그대로 물려받는다(`unknownFn()` 경로도 `position`
  이 `undefined` 일 가능성이 높아 보이나 직접 실행 결과로 개별 확인하지 않음 — 테스트는
  통과했으므로 최소한 값 불일치는 없다). 두 INFO 모두 2라운드에서 "우선순위 낮음"으로
  분류됐고 plan 에 별도 항목으로 등재되지는 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:225-227`
  - 제안: 조치 불요(기능 결함 아님). 다음에 이 근처를 편집할 때 주석에 "Function/Reference/Type 경로는 `position` 이 항상 `undefined`, Syntax 만 정수" 를 명시하면 오독 소지가 준다.

## 요약

3라운드는 2라운드가 지적한 유일한 WARNING(회귀 가드가 실제 도달 가능한 4번째
`ExpressionError` 하위 클래스를 놓침)을 정확히 겨냥해 두 가지로 해결했다 — (1) backend
`it.each` 에 `ExpressionFunctionError` fixture 를 추가해 실행 경로 커버리지를 넓히고,
(2) 새 패키지 레벨 `error-shape.spec.ts` 로 export 된 하위 클래스 **전수**(6종)를 열거해
검사함으로써 향후 신규 하위 클래스가 조용히 새는 것을 원천 차단했다. 두 축 모두 소스
(`errors.ts`)와 대조해 정확했고, 세 spec 파일을 직접 실행해 138/138(backend) +
9/9(package) 전부 통과를 재현했다. `secret-resolver.service.ts` 에 추가된 문단도
spec Rationale 과 line-level 로 정확히 대응한다. 남은 두 관찰(INFO)은 이번 diff 가 만든
결함이 아니라 이전 라운드부터 이어진, 우선순위 낮은 조작화 선택·오독 소지이며 기능
결함이 아니다. Critical/Warning 없음.

## 위험도

NONE
