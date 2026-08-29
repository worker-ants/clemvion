# 테스트(Testing) 리뷰

## 검증 방법

- 리뷰 대상 4개 코드 파일(`expression-resolver.service.spec.ts`, `secret-resolver.service.ts`,
  `code.handler.spec.ts`, `error-shape.spec.ts`)을 저장소에서 직접 Read 로 열어 diff 가 아닌
  **최종 상태**를 확인했다. 이 diff 는 origin/main 대비 누적 3라운드(`11_58_35`→`12_23_45`→
  `12_50_04`)의 리뷰·fix 이력을 포함하므로, 이전 라운드가 이미 지적·수정한 항목이 최종
  파일에 실제로 반영됐는지를 소스로 재확인하는 데 집중했다.
- `packages/expression-engine/src/errors.ts` 를 읽어 `ExpressionError` 하위 6개 클래스의
  생성자 시그니처(`message: string, position?: number`)와 `evaluator.ts`/`parser.ts`/
  `tokenizer.ts` 의 실제 `throw` 지점을 대조 — `SyntaxError` 만 `position` 을 넘기고
  `Reference/Type/Function` 계열은 넘기지 않음을 확인(백엔드 `it.each` 의 disjunction 단언이
  vacuous 하지 않은 근거).
- `cd codebase/packages/expression-engine && npx jest error-shape` → **10/10 통과** 직접 실행
  확인(문서 주장 133/133 의 부분집합 재현).
- `cd codebase/backend && npx jest expression-resolver.service.spec` → **48/48 통과**,
  `npx jest code.handler.spec` → **90/90 통과** 직접 실행 확인.
- 독립 뮤테이션 1건 수행: `error-shape.spec.ts` 의 `EXPECTED_CODE` 표에서
  `TimeoutError: ErrorCode.EXPR_TIMEOUT,` 한 줄을 제거 → **예측 RED / 실측 RED**
  (`2 failed, 8 passed, 10 total` — "1:1" 전수성 단언과 `it.each` 값 단언이 각각 따로 잡음).
  원복은 `cp`(스크래치 `/var/folders/.../tmp.5N4u4XEyVL/error-shape.spec.ts.bak`)로 했고
  `git status --short` 로 저장소가 이 리뷰 세션 산출물(`review/code/2026/08/29/13_10_54/`)
  외에 깨끗함을 확인했다. 재실행으로 10/10 GREEN 회복 확인.

## 발견사항

이전 3개 라운드(`11_58_35`/`12_23_45`/`12_50_04`)가 지적한 테스트 관련 WARNING —
① C2 캐너리가 "4개 오류 종류" 를 주장하면서 실제로는 1종(syntax)만 코드화했던 갭,
② 전수 캐너리의 `code` 단언이 "타입 검사"(`toContain`)라 클래스↔코드 매핑이 뒤바뀌어도
9/9 GREEN 이던 문제, ③ 인라인 주석 "셋이"→"넷이" drift — 는 최종 상태에서 전부 실제
코드로 반영되어 있음을 위 검증으로 직접 확인했다. 이번 라운드의 diff 자체에서 새로
도입된 테스트 결함은 발견하지 못했다.

- **[INFO]** 캡처 헬퍼(`captureThrown`/`captureRejected`) 중복은 여전히 열려 있다 — 새 결함
  아님, 이미 tracked
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:25`,
    `codebase/backend/src/nodes/data/code/code.handler.spec.ts:15`
  - 상세: sync/async 쌍이 거의 동일한 try/catch + vacuity-guard JSDoc 을 각 파일에 독립
    정의한다. `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 의 "근거 서술 중복
    정리 묶음" 항목이 이미 이 중복을 명시적으로 추적 중이고, developer SKILL §수렴 예외
    (a)~(d) 요건(동작 결함 아님·spec-linked 파일이라 fix 가 새 게이트 라운드를 강제·근거
    plan 등재)을 3라운드 연속 충족해 왔다. 새로 지적할 내용이 아니라 상태 확인 차원의
    기록이다.
  - 제안: 조치 불요 — plan 백로그가 이미 담고 있음.

- **[INFO]** `expression-resolver.service.spec.ts` 의 `it.each` 에 남은
  `position === undefined || Number.isInteger(position)` disjunction 은 vacuous 가 아니다
  (검증 완료)
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:226`
  - 상세: 4개 fixture 중 `ExpressionSyntaxError` 경로(`parser.ts`/`tokenizer.ts`)만 `position`
    을 실제로 넘기고(이전 라운드 프로브: `position=11`), `ExpressionReferenceError`/
    `TypeError`/`FunctionError` 는 `evaluator.ts` 의 `throw new ReferenceError(...)` 등이
    `position` 인자를 아예 안 넘겨 `undefined` 다(소스 대조로 이번에 직접 확인). 즉 이
    `it.each` 안에서 두 분기가 실제로 각각 최소 1회씩 실행되어, `error-shape.spec.ts` 에서
    지적·수정됐던 것과 같은 형태의 vacuous disjunction 은 **아니다**. 다만 어느 fixture 가
    어느 분기를 타는지가 코드에 명시적으로 드러나 있지 않아(주석 없음), 향후 fixture 를
    바꾸다 우연히 네 개 다 `undefined` 로만 수렴해도 이 위치의 단언만으로는 알아채기 어렵다.
  - 제안: 조치 불요(현재 vacuous 아님을 확인함). 다음에 이 fixture 배열을 편집할 기회가
    있으면 "syntax 만 정수 분기, 나머지는 undefined 분기" 라는 한 줄 주석을 남기면 향후
    drift 를 더 빨리 알아챌 수 있다 — 급하지 않음.

- **[INFO]** `error-shape.spec.ts` 의 "1:1" 단언은 이름 매핑만 보고 `ErrorCode` 값의
  상호 유일성(두 클래스가 같은 코드로 오매핑되는 경우)은 별도로 보지 않는다
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:73-77`
  - 상세: `Object.keys(EXPECTED_CODE).sort()` 와 `SUBCLASSES` 이름을 대조하는 것은 "표에
    빠지거나 더해진 클래스가 없는가" 만 보장한다. 만약 `EXPECTED_CODE` 에서 두 클래스가
    실수로 같은 `ErrorCode` 값을 갖게 되어도(예: `TypeError: ErrorCode.EXPR_TYPE_ERROR`,
    `FunctionError` 도 실수로 같은 값) 이 단언은 여전히 통과한다 — 물론 그 경우
    `it.each` 의 `expect(err.code).toBe(EXPECTED_CODE[name])` 단언이 프로덕션 코드
    (`errors.ts` 의 실제 하드코딩된 값)와 대조해 잡아낸다. 즉 실질적 위험은 낮다(표
    자체의 오기와 프로덕션 값이 우연히 같은 방향으로 둘 다 틀려야 뚫린다).
  - 제안: 조치 불요.

## 요약

이 라운드가 리뷰하는 diff 는 origin/main 대비 3라운드의 리뷰·fix 이력 전체를 포함하고
있고, 최종 상태를 직접 소스로 재확인한 결과 이전 라운드들이 지적한 커버리지 갭(4개 주장
vs 1종 코드화, `code` 단언의 타입-검사 약점, 인라인 주석 drift)이 전부 실제 단언으로
닫혀 있음을 확인했다. `error-shape.spec.ts` 의 전수성(`SUBCLASSES`) + 1:1 매핑 + 클래스별
정확값 단언이라는 3중 구조는 새 하위 클래스 추가·클래스↔코드 오매핑·화이트리스트 이탈을
각각 독립적으로 잡도록 설계돼 있고, 독립 뮤테이션(표 항목 삭제 → RED)으로 그 판별력을
직접 재현했다. 백엔드 두 spec 의 vacuity-guard 헬퍼·disjunction 은 실제 코드 경로 대조로
비어있지 않음을 확인했다. 신규로 발견된 테스트 결함은 없고, 남은 것은 전부 이미
plan 백로그에 등재되어 developer SKILL §수렴 예외 요건을 충족한 채 보류 중인 항목들뿐이다.

## 위험도

NONE
