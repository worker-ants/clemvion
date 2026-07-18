# 테스트(Testing) 리뷰 — interaction-type 가드 정규식→TS AST 전환

## 검토 범위

실질적 테스트 코드 변경은 파일 1건뿐이다:
`codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
(정규식 grep 매칭 → `ts.createSourceFile` 기반 실제 AST string-literal 파싱).
나머지(plan 문서, consistency SUMMARY/checker 산출물)는 코드가 아니라 프로세스
기록이므로 테스트 관점에서는 참고 컨텍스트로만 다뤘다.

## 발견사항

- **[INFO]** self-test 픽스처가 "union 타입 선언"·"객체 프로퍼티 값" 형태를 직접 커버하지 않음
  - 위치: `describe("collectCodeStringLiterals", ...)` 의 `fixture` 문자열 (L297-306, 새 파일 기준)
  - 상세: 이 self-test 는 PR #968 이 실측한 정확한 결함(주석 인용 false-negative)을 실행 가능한
    property 로 고정한다는 점에서 훌륭하다. 다만 픽스처는 `===` 비교와
    `NoSubstitutionTemplateLiteral` 두 형태만 다루고, 파일 자체의 JSDoc 이 "정당한 코드 분기
    형태"로 명시한 `switch case`, union 타입 선언(`| "value"`), 객체 프로퍼티 값
    (`key: "value"`), `return "value"`, 삼항 은 이 unit self-test 수준에서는 검증되지 않는다.
    실제로는 아래쪽 "WaitingInteractionType exhaustiveness" 통합 테스트가 실제 리포지토리
    파일(`use-result-detail-waiting.ts` 등)을 파싱하면서 이 형태들을 암묵적으로 검증하므로
    커버리지 자체는 있으나, 그 검증은 "실제 파일 내용이 우연히 그 형태를 포함하는 동안만"
    유효한 간접 커버리지다 — 파일 리팩터로 그 형태가 사라지면 이 특정 shape 에 대한 회귀
    감지력도 조용히 사라진다.
  - 제안: `collectCodeStringLiterals` self-test 픽스처에 `type X = "literal_type_value"`
    (union 타입 선언), `const obj = { key: "prop_value" }`(객체 프로퍼티 값) 형태를 1~2줄
    추가해 "정당한 코드 분기 형태를 놓치지 않는다"는 주장을 리포지토리 실 파일 의존 없이
    직접 고정하면 더 견고하다. 차단 사유는 아님.

- **[INFO]** 정규식 리터럴 비오염을 명시적으로 검증하는 테스트 없음 (설계 rationale 이 언급한 리스크)
  - 위치: `describe("collectCodeStringLiterals", ...)` 의 fixture; plan 문서
    `plan/in-progress/interaction-type-guard-comment-false-negative.md` "채택" 문단은
    "손수 만든 주석 제거기는 정규식 리터럴(`conversation-utils.ts:141` 의 `/\[\/?user-input\]/g`,
    `use-execution-events.ts:39` 의 UUID_REGEX)을 오파싱할 위험이 있어 기각"이라고 명시적으로
    이 리스크를 근거로 제시한다.
  - 상세: 채택된 TS 컴파일러 AST 파싱은 `RegularExpressionLiteral` 노드를
    `ts.isStringLiteral`/`ts.isNoSubstitutionTemplateLiteral` 어느 쪽으로도 매칭하지 않으므로
    설계상 안전하지만, 이 안전성을 직접 검증하는 fixture 케이스(예: enum 값과 유사한 패턴을
    포함한 정규식 리터럴을 fixture 에 추가하고 그 값이 `literals` 에 들어가지 않음을 단언)가
    없다. rationale 문서가 스스로 리스크로 지목한 항목을 실행 가능한 assertion 으로 고정하지
    않은 것은 사소한 갭이다.
  - 제안: fixture 에 `const re = /real_literal/;` 같은 줄을 추가하고, 정규식 리터럴 자체의
    텍스트가 `literals` Set 에 들어가지 않는지(또는 최소한 정규식 안에 등장하는 값이
    "코드 리터럴"로 오인되지 않는지)를 명시적으로 단언하면, plan 문서가 밝힌 채택 근거가
    self-test 로 완결된다. 차단 사유는 아님.

- **[INFO]** `ts.ScriptKind.TS` 하드코딩은 향후 `.tsx` 등록 사이트에 대한 커버리지가 없음
  - 위치: `collectCodeStringLiterals` 함수 본문 — `ts.ScriptKind.TS,` (L277 부근)
  - 상세: `fileName` 파라미터를 받으면서도 스크립트 종류는 항상 `TS` 로 고정한다. 현재
    `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 4개 파일은 전부 `.ts` 라 문제가 없지만, 향후
    JSX 를 포함한 `.tsx` 파일이 등록 사이트로 추가되면 `<Foo>value` 형태의 타입 단언과 JSX
    태그 구문이 모호해져 파싱이 실제 코드와 다르게 해석될 수 있다(스킬 스코프의 fail-closed
    방향이라 최악의 경우도 "거짓 통과"보다는 "거짓 실패" 쪽에 가깝지만, 어느 쪽이든 회귀
    테스트 없이 조용히 발생한다는 점은 동일).
  - 제안: 당장 조치 불요(현재 4개 사이트 전부 `.ts`). 다만 `fileName.endsWith(".tsx") ?
    ts.ScriptKind.TSX : ts.ScriptKind.TS` 같은 확장자 기반 분기와 그에 대응하는 self-test
    케이스를 추가해두면, 향후 등록 사이트가 `.tsx` 로 확장될 때 이 함수를 다시 살펴볼 필요가
    없어진다.

- **[INFO]** self-test 가 하나의 `it` 블록에 5개 ghost + 2개 real 케이스를 결합
  - 위치: `describe("collectCodeStringLiterals", ...)` 내부 단일 `it("collects code literals
    and ignores mentions inside comments", ...)`
  - 상세: JSDoc 인용·라인 주석·블록 주석·trailing 주석·템플릿 리터럴을 한 fixture 문자열에
    모두 욱여넣고 루프로 일괄 단언한다. vitest 는 실패한 `expect` 라인을 정확히 가리키므로
    디버깅이 불가능한 수준은 아니지만, 케이스별로 `it.each` 또는 별도 `it` 로 분리하면 "어느
    주석 형태가 새로 새는지"를 테스트 이름만으로 즉시 알 수 있어 가독성이 더 좋아진다.
  - 제안: 선택 사항. 현재도 실패 시 원인 파악에 지장은 없다.

## 긍정적으로 평가할 점 (요구된 관점 대비 강점)

- **테스트 용이성**: 정규식 매칭 로직을 리포지토리 파일 읽기와 분리된 순수 함수
  `collectCodeStringLiterals(source, fileName): Set<string>` 로 추출한 것 자체가 이번 diff 의
  핵심 테스트 개선이다. 실제 파일시스템 의존 없이 인메모리 fixture 로 가드의 핵심 로직만
  독립적으로 검증할 수 있게 됐다.
- **회귀 테스트**: PR #968 이 mutation 으로 실측한 "주석의 백틱/홑따옴표 인용이 실제 분기
  파손을 가려버리는" 결함을, 수작업 mutation 실험(plan 문서의 표)에 그치지 않고 항구적
  self-test(`ghost_backtick`/`ghost_single`/`ghost_line`/`ghost_block`/`ghost_trailing`)로
  코드베이스에 고정했다. "가드가 있다"가 아니라 "깨뜨려 봤다"를 실행 가능한 property 로
  전환한 모범적인 사례.
- **테스트 격리**: 새 self-test 는 실제 파일 읽기 없이 순수 인메모리 fixture 만 사용해
  완전히 독립적이다. 기존 두 exhaustiveness 테스트는 실제 리포지토리 파일에 의존하지만, 이는
  가드의 본질(리포지토리 현재 상태 검증)상 불가피하며 이번 diff 로 새로 생긴 문제는 아니다.
- **Mock 적절성**: 어느 테스트도 mock/stub 을 쓰지 않는다 — 실제 `ts.createSourceFile` 파서와
  실제 파일 내용을 그대로 사용하는 것이 이 가드의 목적(실제 파싱 동작 검증)에 부합한다. mock 을
  들였다면 오히려 실제 동작과의 괴리를 낳았을 것이므로, mock 미사용이 올바른 선택이다.
  plan 문서에 기록된 수작업 mutation 실측(옛 정규식과 새 AST 가드를 같은 파일에 대해 나란히
  실행해 대조군을 세운 것)도 실제 회귀 감지력을 검증하는 좋은 방법론이다.
- **테스트 가독성**: `real_*`/`ghost_*` 네이밍 컨벤션이 "이 값은 통과해야 한다"/"이 값은 배제돼야
  한다"는 의도를 이름만으로 명확히 전달한다. JSDoc 도 "왜 정규식이 아니라 AST 파서인가"를
  구체적 실측 사례(PR #968, 파일명·라인)까지 인용해 상세히 설명해 유지보수자가 나중에 되돌리는
  실수를 방지하는 데 실질적으로 기여한다.
- **커버리지**: 두 기존 exhaustiveness describe 블록(`WaitingInteractionType`,
  `ConversationTurnSource`)의 assertion 로직은 값 검사 방식만 `pattern.test(src)` →
  `literals.has(value)` 로 바뀌었을 뿐 구조·에러 메시지·throw 조건은 그대로 유지되어, 기존
  회귀 테스트로서의 유효성은 훼손되지 않았다.

## 요약

핵심 변경(정규식 grep → TS AST 파싱)은 테스트 관점에서 견고하다. 가장 중요한 결함 클래스
(주석 인용에 의한 false-negative)를 실행 가능한 self-test 로 영구 고정했고, 검증 로직을 순수
함수로 추출해 테스트 용이성을 크게 개선했으며, mock 없이 실제 파서·실제 파일을 사용해 실동작과의
괴리가 없다. 기존 두 exhaustiveness 테스트의 구조·회귀 감지력도 보존됐다. 다만 self-test
fixture 가 union 타입 선언·객체 프로퍼티 값 같은 정당한 코드 형태나, 설계 rationale 이 스스로
언급한 정규식 리터럴 비오염 케이스를 직접 커버하지 않는 점, 그리고 `ts.ScriptKind.TS` 하드코딩이
향후 `.tsx` 등록 사이트를 가정하지 않는 점은 사소한 커버리지 보강 여지로 남는다 — 모두 차단
사유는 아니며 INFO 수준이다.

## 위험도

LOW
