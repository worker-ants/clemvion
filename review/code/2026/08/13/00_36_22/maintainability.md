# 유지보수성(Maintainability) 코드 리뷰 — `00_36_22`

## 대상 및 스코프 판단

`origin/main..HEAD` 전체 diff 를 확인했다. 프로덕션 코드
(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`)는 이번
증분(직전 라운드 `00_20_20` 이후 커밋은 `c51809a0b` 단 하나)에서 **한 글자도 바뀌지 않았다** —
`git diff e7ad5ca1f..HEAD -- .../idempotency.interceptor.ts` 를 직접 대조해 `86de12278`
(`isIdempotencyEntry`/`describeShape` 신설)까지가 마지막 프로덕션 변경이고, 그 커밋은 이미
`00_20_20` maintainability 라운드가 리뷰했다(스타일 관찰 4건, 전부 INFO, LOW 판정).

이번 증분(`c51809a0b`)의 실질 변경은 두 파일뿐이다:

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `it.each`
  형태-검증 매트릭스(8케이스)에 `expectedShape` 3번째 컬럼 추가 + 그 값을 `warnSpy` 단언에
  반영, 모듈 최상단 및 두 번째 `describe` 블록 docstring 보강.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 완료 후속 기록 + 신규 백로그 항목
  2건(`switchMap` 추출 트리거 발동, spec 문서 정정 인계). plan 문서는 이전 세 라운드와 동일하게
  이 관점의 코드 품질 평가 대상이 아니다.

나머지 파일(`CHANGELOG.md`, `review/code/**`, `review/consistency/**`)도 문서·리뷰 하네스
산출물이라 이전 라운드들과 같은 이유로 평가 대상 밖이다.

## 발견사항

이번 증분 자체에서 새로 지적할 유지보수성 결함은 없다. 확인한 내용은 다음과 같다.

- **[INFO]** `it.each` fixture 테이블의 8행 중 뒤쪽 3행(타입 불일치 케이스)이 `expectedShape`
  컬럼에 동일 문자열 `'object'` 를 반복한다 — 결함이 아니라 데이터 특성상 자연스러운 반복
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:562-582`
    (`it.each([...])` fixture 배열, `'bodyHash 만 타입 불일치'`/`'responseJson 만 타입 불일치'`/
    `'statusCode 만 타입 불일치'` 세 행)
  - 상세: 세 행 모두 `describeShape()` 가 `typeof value`(object)를 반환하는 입력이라 `'object'`
    가 세 번 나온다. 이 값은 `describeShape()` 의 실제 반환값과 대조하는 기대치이므로, 코드
    로직의 "매직 문자열"이 아니라 fixture 데이터 그 자체다 — 추출해 상수화할 이유가 없다.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** (확인) `expectedShape` 추가로 `describeShape()` 헬퍼가 이제 프로덕션 코드와 테스트
  양쪽에서 명시적으로 값 대조되어, 직전 라운드가 지적한 "본문을 상수로 치환해도 41/41 그린"
  이던 하중 없는 헬퍼 문제가 실제로 닫혔다
  - 위치: `idempotency.interceptor.spec.ts:611-619` (`expect(warnSpy).toHaveBeenCalledWith(...형태 불일치 (${expectedShape})...)`)
  - 상세: `describeShape()` 를 상수 문자열로 치환하는 뮤턴트가 이제 8개 fixture 중
    `'null'`·`'number'`·`'array'`·`'string'` 4개 행에서 값 불일치로 죽는다(뒤 3행은 우연히
    같은 값 `'object'` 라 이 뮤턴트만으로는 구분 못 하지만, 앞 5행이 이미 커버한다). 이전
    라운드의 지적이 실제로 해소됐음을 소스 대조로 확인했다.
  - 제안: 없음 — 확인 기록.

- **[INFO]** (재확인, 변경 없음) 직전 세 라운드가 이미 짚은 스타일 관찰 4건은 이번 증분으로
  변화가 없다 — `formatErr` 삼항식 4곳 반복(`:145`/`:240`/`:323`/`:331`), `discardCorruptEntry`
  판별 파라미터의 로그-문구 겸용(`:235`), `discardCorruptEntry<T>` 단형성 제네릭(`:234-243`),
  `switchMap` 콜백 7분기(`:149-217`)
  - 위치: 위 각 항목의 실제 라인
  - 상세: 이 중 `switchMap` 7분기 건은 `00_20_20` 라운드가 "6번째 분기 추가 시 재검토"
    트리거를 넘겼다고 지적했고, `plan/in-progress/backend-lint-gate-broken-on-main.md` 에
    "`resolveCacheHit()` 로 추출" 항목이 이번 증분에서 신규 등재됐다(`- [ ] intercept() 의
    switchMap 콜백을 resolveCacheHit() 로 추출`) — 조건부 유예를 조용히 연장하지 않고
    백로그 항목으로 전환한 것으로, 이 관점에서 바람직한 처리다.
  - 제안: 조치 불요. 프로덕션 코드가 변경되지 않았으므로 새로 판정할 것이 없다.

## 요약

이번 라운드(`00_36_22`)가 리뷰해야 할 실질 증분은 테스트 파일 한 곳뿐이다 — 직전 라운드가
지적한 "`describeShape()` 가 하중 없는 헬퍼였다"는 문제를 `expectedShape` 값 단언으로 닫았고,
관련 docstring(모듈 최상단·두 번째 `describe` 블록)도 형태 검증이 별도 축인 이유와 fixture
설계 원칙(조건을 하나씩만 위반)을 함께 반영해 갱신했다. 매직 넘버·과도한 함수 길이·깊은
중첩·순환 복잡도 급증·중복 코드 같은 심각한 유지보수성 문제는 이번 증분에도, 재확인한 기존
코드에도 없다. 프로덕션 파일(`idempotency.interceptor.ts`)은 이번 증분에서 전혀 수정되지
않았으므로 이전 라운드(`00_20_20`)의 판정이 그대로 유효하다. 유일하게 짚을 만한 것은
`switchMap` 콜백 7분기 재검토 트리거가 이번에 plan 백로그 항목으로 정식 등재된 것인데, 이는
결함이 아니라 이전 라운드의 조건부 유예가 의도대로 작동한 사례다.

## 위험도

LOW
