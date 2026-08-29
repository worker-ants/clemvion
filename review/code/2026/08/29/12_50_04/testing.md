# 테스트(Testing) 리뷰

## 사전 확인

이 diff 는 3라운드에 걸친 `#1233` 캐너리 작업(11_58_35 → 12_23_45 → 이번 12_50_04)의 누적본이다.
`review/code/2026/08/29/{11_58_35,12_23_45}/**` 는 이전 라운드 리뷰 산출물(이미 RESOLUTION 으로
처리됨)이라 테스트 관점에서 새로 볼 대상이 아니고, 실제 테스트 코드 변경은 다음 4개 파일이다:

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`
2. `codebase/backend/src/nodes/data/code/code.handler.spec.ts`
3. `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규)
4. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (주석만 — 테스트 영향 없음)

아래 두 지적은 **직접 뮤테이션으로 검증**했다 (원본은 scratch 디렉터리에 백업 후 `cp` 로 원복,
`git status --short` 로 저장소가 깨끗함을 확인함 — 결과는 각 항목에 기재).

## 발견사항

- **[WARNING]** `error-shape.spec.ts` 의 클래스별 `code` "모양" 단언이 실제로는 클래스-코드
  대응관계를 잠그지 못한다 — 뮤테이션으로 확인(9/9 GREEN, 즉 못 잡음)
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:61` (`expect(Object.values(ErrorCode)).toContain(err.code)`)
  - 상세: 이 줄 바로 위 주석(59-60행)은 "키 이름만 잠그면 '같은 키에 민감한 값이 실린다'는
    변형을 놓친다. 값의 **모양**도 함께 고정한다" 고 명시한다. 그런데 실제 단언은
    `Object.values(ErrorCode)).toContain(err.code)` — "`err.code` 가 `ErrorCode` 열거형의
    **어떤** 멤버인가" 만 확인하고, "**이** 서브클래스가 **그** 코드를 쓰는가" 는 확인하지 않는다.
    직접 뮤테이션으로 재현: `SyntaxError`/`ReferenceError` 두 서브클래스의 `ErrorCode` 를
    맞바꿔도(`errors.ts` 를 scratch 백업 후 수정 → `npx jest src/__tests__/error-shape.spec.ts`)
    **9 tests 전부 GREEN** 이었다(원복은 `cp` 로 완료, `git status --short` 클린 확인). 즉
    `errors.ts` 에서 두 서브클래스의 `ErrorCode` 할당이 뒤바뀌는 회귀(같은 파일에서 이미
    일어난 적 있는 종류의 복붙 실수)를 이 신규 캐너리는 못 잡는다. 같은 축을 잠그는 backend
    쪽 `it.each`(`expression-resolver.service.spec.ts:224` `expect(shape.code).toBe(expectedCode)`)
    는 정확값 비교라 이 결함을 잡지만, 그건 실행 경로로 값싸게 도달 가능한 4/6 클래스만
    커버하고 `TimeoutError`/`DepthExceededError` 는 이 패키지 레벨 파일에만 있다 — 그 둘의
    클래스-코드 대응은 **어느 테스트도 확인하지 않는다**.
  - 제안: `SUBCLASSES` 옆에 예상 `ErrorCode` 를 함께 나열하는 테이블(예:
    `[SyntaxError, 'EXPR_SYNTAX_ERROR']`)로 바꾸고 `expect(err.code).toBe(expectedCode)` 로
    정확값 비교하면, backend `it.each` 가 이미 검증하는 4개 클래스뿐 아니라 `Timeout`·
    `DepthExceeded` 의 클래스-코드 매핑까지 이 신규 캐너리 한 곳에서 전수로 잠근다.

- **[INFO]** 같은 `it.each` 블록의 `position` "모양" 단언이 이 파일 안에서는 항상 무의미하게(vacuously) 참이다
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:62-64`
    (`expect(err.position === undefined || Number.isInteger(err.position)).toBe(true)`)
  - 상세: `SUBCLASSES` 를 순회하는 fixture 는 `new Cls('probe message')` 로만 생성되어(63번째
    줄이 위치한 `it.each` 콜백, 55-56행) **어느 서브클래스에도 `position` 인자를 넘기지 않는다**.
    게다가 `TimeoutError`/`DepthExceededError` 는 생성자 자체가 `position` 파라미터를 받지
    않는다(`errors.ts` 확인). 따라서 여섯 클래스 전부 `err.position === undefined` 가 항상
    참이라 `||` 좌변에서 단락 평가되고, `Number.isInteger` 분기는 이 파일에서 **한 번도
    실행되지 않는다** — 표현식만 보면 "정수 검증"처럼 보이지만 실질은 `expect(true).toBe(true)`
    다. (참고: 실제 정수 `position` 검증은 `expression-resolver.service.spec.ts` 의 backend
    `it.each` 가 4개 클래스에 대해 실제 파싱 경로로 수행하므로 전체 방어선에 구멍이 뚫린 것은
    아니다. 다만 이 파일의 주석 "값의 모양도 함께 고정한다"(59-60행)이 이 줄에 대해서는
    성립하지 않는다는 점을 그대로 두면, 다음 사람이 "position 모양은 여기서도 잠겨 있다"고
    오독하기 쉽다 — 이 PR 이 세 번 연속 겪은 "주석이 실제 커버리지보다 넓게 말한다" 패턴과
    같은 모양이다.)
  - 제안: base `ExpressionError` 케이스(72-74행)처럼 `it.each` fixture 에도 실제 `position`
    값을 함께 실어(`[SyntaxError, 3]` 형태) `Number.isInteger` 분기가 최소 한 번은 참으로
    실행되게 하거나, 이 파일에서는 검증 불가능함을 주석에 명시.

## 검증한 것 (문제 없음 확인)

- `it.each` 로 넓힌 backend 캐너리(`expression-resolver.service.spec.ts` C2, `code.handler.spec.ts`
  C2) 는 각각 `-t "C2"` 필터로 직접 실행해 4/4, 1/1 GREEN 을 확인했다 — 실제 실행 경로를
  통해 값싸게 만들어진 진짜 예외를 검증하고 있어 mock 남용·isolation 문제는 없다.
- `captureThrown`/`captureRejected` 헬퍼는 vacuity 방지 단언(`toBeInstanceOf(Error)`)을 안에
  품고 있어, 이후 도입될 세 번째 캐너리가 그 함정을 다시 밟지 않게 한다. 두 헬퍼가 파일마다
  분리돼 있는 중복은 이미 plan(`deps-peer-gating-and-eslint10.md`)의 "근거 서술 중복 정리
  묶음" 항목으로 등재돼 있어 새 지적이 아니다.
- `error-shape.spec.ts` 의 전수성 단언(`SUBCLASSES.map(...).sort()).toEqual([...])`)은 새
  하위 클래스가 추가/삭제되면 그 즉시 RED 를 내는 설계라 "커버리지가 조용히 좁아지는" 이전
  3라운드의 재발 패턴을 구조적으로 막는다 — 이 설계 자체는 견고하다.
- `error-shape.spec.ts` 가 `INTERNAL_PACKAGES`(`.claude/test-stages.sh`)의 `@workflow/expression-engine`
  스테이지를 통해 `cmd_unit`(표준 unit 게이트)에 실제로 포함되는지 확인했다 — 포함된다. `secret-resolver.service.ts`
  변경은 주석뿐이라 테스트 영향 없음.
- env 를 건드리는 기존 테스트(`$env` 관련 3건)는 전부 `try/finally` 로 `process.env` 를
  정리해 테스트 간 격리를 지킨다 — 이번 diff 가 손대지 않은 부분이지만 회귀 없음을 확인.

## 요약

이번 diff 는 이미 두 차례 리뷰를 거치며 "커버리지가 문서 주장보다 좁다"는 지적을 반영해 실행
경로 기반 `it.each`(backend, 4클래스)와 export 열거 기반 전수성 테스트(package, 6클래스)로
축을 분리한 성숙한 설계다. vacuity 방지 헬퍼 추출, mutation 기반 자기 검증(M1~M10) 등 테스트
방법론 자체는 이 저장소 평균보다 훨씬 꼼꼼하다. 다만 신규 패키지 레벨 캐너리
(`error-shape.spec.ts`)의 "값의 모양도 함께 고정한다"는 주석이 실제로 커버하는 범위보다 넓게
말하고 있다는, **같은 PR 이 이미 세 번 자기 발견한 것과 동일한 형태의 결함**이 한 군데 더
있다 — `code` 필드는 클래스-코드 정확 대응을 잠그지 못함(뮤테이션으로 확인된 실제 회귀
미탐지)을 WARNING 으로, `position` 필드는 이 파일 안에서 검증 자체가 도달 불가능함을
INFO 로 보고한다. 둘 다 1차 방어선(enumerable key 화이트리스트)은 건드리지 않아 보안 임팩트는
낮지만, 이 프로젝트가 반복해서 강조해 온 "분기/모양 단언의 판별력을 실측하라"는 원칙에
정확히 해당하는 갭이라 별도로 짚는다.

## 위험도

LOW
