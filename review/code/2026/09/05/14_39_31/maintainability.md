# 유지보수성(Maintainability) 리뷰

## 검증 방법

이번 라운드(`14_39_31`)의 diff 는 `origin/main..HEAD` 8개 커밋 전체다. 그중 실제 코드 파일(1~8번:
`audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`, 4개 e2e 스펙)만 코드
메트릭(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성) 적용 대상으로 삼았다. 나머지
(`plan/**`, `review/**`)는 생성된 산출물/추적 문서라 함수 길이·중첩 같은 코드 메트릭이 적용되지
않는다(이전 라운드 `documentation.md` 도 같은 판단).

이전 라운드(`review/code/2026/09/05/13_49_54/maintainability.md`)가 낸 WARNING 3건·INFO 1건이
이후 fix 커밋(`45c1cdf63`)에서 실제로 해소됐는지, 저장소에 아무 것도 쓰지 않고 현재 소스
(`Read`)를 직접 대조해 확인했다.

## 이전 라운드 지적의 해소 확인 (문제 없음 — 회귀 방지 기록)

- **W(kind 'missing' 이중 의미)** → `ContractViolationKind` 에 `'invalid-payload'` 신설
  (`response-contract.ts` 게이트 59-63), `findContractViolations` 가 payload 자체 결함을 그
  kind 로 분리 보고(게이트 242-248). `.spec.ts` 게이트 270 이 `kind` 값 자체를 단언해 회귀도
  고정됨. **해소 확인.**
- **W(`dtoName: string` 이중 표현)** → `DtoContract.name` 이 `Dto.name` 에서 파생되어
  (`contractForDto`, 게이트 311) 호출부 4곳(`audit-logs`/`session-revocation`/`workflow-crud`/
  `workflow-execution` e2e) 전부 문자열 인자를 넘기지 않는다 — `assertMatchesContract(payload,
  contract)` 형태로 통일. **해소 확인.**
- **INFO(`schemaForDto`/캐싱 불일치)** → 4개 e2e 파일 전부 `beforeAll` 에서 1회 `contractForDto`
  호출 후 재사용하는 형태로 통일됨(grep 으로 4곳 전부 확인). **해소 확인.**
- **INFO(배열 payload 가 객체 가드를 통과)** → `findContractViolations` 게이트 235-248 이
  `Array.isArray`/`null`/`typeof` 를 갈라 `shape` 문자열로 보고. `.spec.ts` 게이트 264 가 배열
  케이스를 `it.each` 대조군에 포함. **해소 확인.**

## 발견사항

- **[INFO]** "find → `toBeDefined` → `assertMatchesContract`" 3문장 패턴이 여전히 2곳에서
  반복된다 — 단, 이미 추적·유예된 항목이라 이번 라운드 조치는 불요
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:163-165`,
    `codebase/backend/test/workflow-execution.e2e-spec.ts:153-155`
  - 상세: 두 파일 모두 `items.find(...)` → `expect(mine).toBeDefined()` →
    `assertMatchesContract(mine, xContract)` 3문장을 그대로 반복한다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이 패턴을 응답 DTO
    ~56곳으로 넓힐 스윕을 예고하고 있어 중복이 커질 잠재력은 실재한다. 다만 이 항목은 이미
    `review/code/2026/09/05/13_49_54/RESOLUTION.md` §보류에서 "지금 2곳뿐이고 스윕이 실제로
    어떤 형태(목록/단건/중첩 배열)를 만나는지 봐야 헬퍼 시그니처가 정해진다" 는 근거로
    유예됐고, 같은 턴에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    등재됐다(`developer` SKILL §수렴 예외 (a)~(d) 충족). 재차 WARNING 으로 올려 다시 조치를
    요구하면 "이미 등재된 유예 항목을 매 라운드 재지적" 하는 루프가 된다.
  - 제안: 조치 불요 — 스윕 착수 시점에 헬퍼로 접을 것(이미 plan 에 등재됨). 이번 라운드에서는
    현재 상태(2곳, 유예 근거 유효)만 확인 기록.

- **[INFO]** `Walk` 인터페이스가 필드 대부분을 `readonly` 로 선언하면서 정작 누산 대상인
  `out` 만 mutable 이라, "readonly 니까 이 컨텍스트는 불변" 이라는 첫인상과 실제 동작(순회
  중 `walk.out.push(...)` 로 누적)이 어긋난다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `interface Walk`
    선언부(게이트 124-128), 소비 지점 `visit`/`descend` 내 `walk.out.push(...)` 호출들(게이트
    184-188, 196-203, 213-217)
  - 상세: `contract`/`allowUndeclared` 는 순회 내내 값이 바뀌지 않아 `readonly` 가 정확하다.
    `out: ContractViolation[]` 은 배열 참조 자체는 재할당되지 않지만(그래서 `readonly` 를 붙일
    수는 있다) 배열 **내용물**은 재귀 전체에 걸쳐 계속 `push` 로 변경되는 누산기라, 다른 두
    필드와 같은 수준의 "불변" 신호를 주지 않는다. 지금은 파일이 짧고 호출부가 한정적이라
    혼동 위험이 낮지만, 이런 "컨텍스트+누산기 혼합 객체" 패턴을 다른 순회 헬퍼에 복제할 때
    "readonly 필드는 다 안 바뀐다" 는 잘못된 전제로 리뷰할 위험이 있다.
  - 제안: 선택사항 — `out` 옆에 `/** 누산기 — push 로 계속 바뀐다(다른 필드와 달리 불변
    아님) */` 한 줄만 추가하거나, 굳이 구분하고 싶다면 `Walk` 를 "불변 컨텍스트"(`contract`,
    `allowUndeclared`)와 "가변 누산기"(`out`)로 나눠 함수 시그니처에서 둘을 분리한다. 지금
    규모에서는 필수는 아니다.

## 요약

이전 라운드가 낸 WARNING 3건·관련 INFO 는 fix 커밋(`45c1cdf63`)에서 실제로 해소됐음을 현재
소스를 직접 열어 확인했다 — `invalid-payload` kind 신설, `DtoContract.name` 파생으로 문자열
이중 기입 제거, `beforeAll` 캐싱 통일, 배열 payload 가드. 새로 추가된 중첩 하강 로직
(`visit`/`descend`, 순환 참조는 경로별 `seen` 목록으로 차단)은 함수당 책임이 하나로 좁고 중첩
깊이도 낮아(최대 2단계) 이번 라운드에서 새로운 CRITICAL/WARNING 급 결함은 찾지 못했다. 유일한
잔여 항목은 이미 추적·유예된 "find→toBeDefined→assert" 3문장 중복(W6, 2곳)이며, 근거가 여전히
유효해 재조치를 요구하지 않는다. `Walk.out` 의 readonly/mutable 혼재는 사소한 가독성 개선
여지로만 INFO 기록한다.

## 위험도

LOW
