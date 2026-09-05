# 유지보수성(Maintainability) 리뷰

## 검증 방법

이번 라운드(`15_12_02`)의 diff 는 `origin/main..HEAD` 9개 커밋 전체다. 실제 코드 파일(1~9번:
`audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`, 4개 e2e 스펙, `CHANGELOG.md`)만
코드 메트릭(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성) 적용 대상으로 삼았다.
`plan/**`·`review/**`(파일 10~46)는 생성된 산출물/추적 문서라 함수 길이·중첩 같은 코드 메트릭이
적용되지 않는다(이전 두 라운드와 같은 판단).

`git log --oneline origin/main..HEAD` 로 확인한 결과 이번 라운드는 `ee755efbe`(14_39_31 라운드
산출물 커밋) 이후 **코드 변경이 추가되지 않았다** — 즉 1~9번 파일의 실제 내용은 직전 라운드
(`14_39_31`)가 검토한 것과 동일하다. 프롬프트에서 diff 가 생략된 `response-contract.ts`/`.spec.ts`
는 `Read` 로 현재 소스를 직접 열어 대조했다. 저장소에는 아무 것도 쓰지 않았다
(`git status --short` — 이 리뷰 세션의 산출물 디렉터리 외 변경 없음).

## 이전 라운드 지적의 해소 확인 (문제 없음 — 회귀 방지 기록)

`13_49_54` 라운드의 WARNING 3건(`kind:'missing'` 이중 의미, `dtoName` 문자열 이중 기입,
`schemaForDto` 캐싱 불일치)은 `45c1cdf63` 에서, `14_39_31` 라운드의 CRITICAL 1건(자기참조 DTO
가드가 payload 를 검사하지 않고 통과시킴)은 `db45d1b09` 에서 각각 해소됐음을 현재 소스에서
재확인했다.

- `ContractViolationKind` 에 `'invalid-payload'` 가 별도로 있고(`response-contract.ts:76`),
  `findContractViolations` 가 payload 자체 결함을 이 kind 로 분리 보고한다(`:319-333`). 필드
  단위 `'missing'`(`:240`)과 더 이상 섞이지 않는다. **해소 확인.**
- `DtoContract.name` 이 `Dto.name` 에서 파생되고(`:395`), 호출부 4곳
  (`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution` e2e) 전부
  `assertMatchesContract(payload, contract)` 형태로 문자열 인자를 넘기지 않는다. **해소 확인.**
- 4개 e2e 파일 전부 `beforeAll` 에서 `contractForDto` 를 1회 호출해 재사용한다(grep 으로 전수
  확인). **해소 확인.**
- 자기참조 DTO 순환 가드가 스키마 이름 대신 **payload 객체 동일성**(`onPath: ReadonlySet<object>`,
  `:185, 206`)으로 바뀌었고, `.spec.ts` 에 위반 주입(`:284-301`)·자기순환 종료(`:317-322`) 테스트가
  모두 있어 vacuous 캐너리가 아니다. **해소 확인.**

## 발견사항

- **[INFO]** `visitUnion` 이 받는 5번째 인자가 함수 본문에서 전혀 쓰이지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `visitUnion` 함수 시그니처의
    `_onPath: ReadonlySet<object>` 파라미터, 호출부는 `descend` 함수 안의
    `visitUnion(value, nested, path, walk, deeper)` 호출.
  - 상세: `visitUnion` 의 JSDoc 은 스스로 "더 내려가지는 않는다 — 어느 변형의 스키마로 내려가야
    하는지가 정해지지 않기 때문" 이라고 밝힌다. 실제로 함수 본문 어디에서도 `_onPath` 를 참조하지
    않는다. `visit`/`descend` 와 시그니처를 맞추려는 의도로 보이지만, 이름 앞의 밑줄이 "의도적으로
    안 쓴다" 는 것만 표시할 뿐 애초에 이 파라미터가 필요한 이유를 남기지 않아, 다음 사람이 재귀를
    더 내리는 코드를 추가할 때 `visitUnion` 에도 순환 가드가 이미 배선돼 있다고 오인할 수 있다.
  - 제안: 필수 아님. 파라미터를 아예 제거하거나(호출부에서 `deeper` 인자도 제거), 유지한다면
    "`oneOf`/`anyOf` 는 더 내려가지 않으므로 이 인자는 시그니처 통일 목적일 뿐 안 쓰인다" 를 한 줄
    주석으로 남긴다.

- **[INFO]** (확인 완료, 이미 추적 중) `find → toBeDefined → assertMatchesContract` 3문장 패턴이
  여전히 2곳(`workflow-crud.e2e-spec.ts`, `workflow-execution.e2e-spec.ts`)에서 반복된다
  - 상세: 이 항목은 `13_49_54` RESOLUTION 에서 유예되고 같은 턴에
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됐으며(§5.4 2단계 스윕
    항목 바로 위 신규 불릿), `14_39_31` 라운드가 근거 유효성을 재확인했다. 이번 라운드에도 코드
    변경이 없어 상태가 그대로다 — 유예 근거(스윕이 어떤 형태를 만나는지 봐야 헬퍼 시그니처가
    정해진다)는 여전히 유효하다.
  - 제안: 조치 불요 — 스윕 착수 시점에 헬퍼로 접을 것(이미 plan 에 등재됨).

## 요약

이번 라운드는 직전 라운드(`14_39_31`) 이후 코드 변경이 없는 상태에서의 재검증이다. 두 차례의
이전 라운드가 지적한 WARNING/CRITICAL(총 4건: `kind` 이중 의미, `dtoName` 문자열 중복, 캐싱
불일치, 자기참조 DTO 거짓 통과)이 모두 실제로 해소돼 있음을 현재 소스에서 직접 재확인했고, 관련
회귀 테스트(kind 값 단언, 위반 주입, 자기순환 종료)도 갖춰져 있다. 새로 찾은 것은 `visitUnion` 의
미사용 5번째 파라미터 하나뿐이며 동작에 영향이 없는 사소한 가독성 여지다. 유일한 잔여 항목(2곳의
3문장 반복)은 이미 등재·유예된 항목으로 이번 라운드에서 재조치를 요구하지 않는다. 코드 자체
(`response-contract.ts`/`.spec.ts`, `audit-logs.service.ts`/`.spec.ts`)는 함수당 책임이 좁고
중첩 깊이가 낮으며(`visit`/`descend`/`visitUnion` 각각 최대 2~3단계), JSDoc 이 설계 결정과 반증
이력을 상세히 남겨 유지보수성이 높다. 발견의 성격이 이전 두 라운드(동작 결함)에서 이번 라운드
(사소한 가독성 INFO 1건)로 내려간 것은 수렴 신호로 읽는다.

## 위험도

NONE
