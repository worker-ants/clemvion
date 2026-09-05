# 유지보수성(Maintainability) 리뷰

## 검증 방법

`git log --oneline origin/main..HEAD` 로 이번 diff 의 커밋 11개를 확인했다. 코드 메트릭(가독성·
네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성) 적용 대상은 실제 코드 파일뿐이다: 파일
1~9(`CHANGELOG.md`, `audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`, e2e
스펙 4개). 파일 10 이후(`plan/**`, `review/**`)는 생성된 산출물/추적 문서라 이전 세 라운드
(`13_49_54`→`14_39_31`→`15_12_02`)와 같은 판단으로 코드 메트릭 대상에서 제외했다.

프롬프트에서 diff 가 생략된 `response-contract.ts`/`.spec.ts` 는 `Read` 로 현재 소스를 직접 열어
대조했다. `git status --short` 로 확인한 결과 이번 세션의 산출물 디렉터리(`review/code/.../15_31_41`,
`review/consistency/.../15_31_43`) 외에는 아무 변경도 없다 — 저장소에 뮤테이션을 가하지 않았다.

`git log --oneline`으로 직전 라운드(`15_12_02`, 커밋 `4d8118956`) 이후 코드 커밋이 추가되지
않았음을 확인했다 — 즉 파일 1~9 의 실제 내용은 `15_12_02` 라운드가 최종 검토한 것과 동일하다
(그 라운드가 지적한 INFO 2건에 대한 fix 커밋 `bf02fe328`은 이미 그 라운드의 리포트 대상에
포함돼 있었다). 따라서 이번 라운드는 "새 diff 재검토"가 아니라 "회귀 여부 재확인"의 성격이다.

## 이전 라운드 지적의 해소 확인 (문제 없음 — 회귀 방지 기록)

- **`13_49_54` WARNING(`kind:'missing'` 이중 의미)** → `ContractViolationKind` 에
  `'invalid-payload'` 전용 값이 있고(`response-contract.ts:76`), `findContractViolations` 가
  payload 자체 결함을 이 kind 로 분리 보고한다(`:319-332`). `.spec.ts`(`:392-393`)가 `kind` 값
  자체를 단언해 회귀가 고정돼 있다. **해소 유지 확인.**
- **`13_49_54` WARNING(`dtoName: string` 이중 표현)** → `DtoContract.name` 이 `Dto.name` 에서
  파생되고(`contractForDto`, `:395`), 호출부 4곳(`audit-logs`/`session-revocation`/
  `workflow-crud`/`workflow-execution` e2e) 전부 `assertMatchesContract(payload, contract)`
  형태로 문자열 인자를 넘기지 않는다(grep 으로 재확인). **해소 유지 확인.**
- **`13_49_54` INFO(`schemaForDto` 캐싱 불일치)** → 4개 e2e 파일 전부 `beforeAll`에서
  `contractForDto`를 1회 호출해 `xxxContract` 필드에 저장 후 재사용하는 형태로 통일돼 있다
  (`audit-logs.e2e-spec.ts:39,80`, `session-revocation.e2e-spec.ts:47,111`,
  `workflow-crud.e2e-spec.ts:122,165`, `workflow-execution.e2e-spec.ts:68,155`). **해소 유지 확인.**
- **`14_39_31` CRITICAL(자기참조 DTO 순환 가드가 스키마 이름 기준이라 payload 내부 검사 없이
  통과)** → 순환 가드가 `onPath: ReadonlySet<object>`(payload 객체 동일성)로 바뀌었고
  (`response-contract.ts:185, 206`), `.spec.ts`에 위반 주입(`:284-301`)·정상 종료(`:317-322`)
  캐너리가 모두 있다. **해소 유지 확인.**
- **`15_12_02` INFO(`visitUnion`의 미사용 `_onPath` 파라미터)** → 커밋 `bf02fe328`에서 파라미터
  자체를 제거하고(`visitUnion(body, variants, prefix, walk)`, 4개 인자로 축소), 호출부
  `descend`도 `visitUnion(value, nested, path, walk)`로 맞춰 고쳤다. 제거 이유("더 내려가지
  않으므로 순환 가드가 필요 없다")도 JSDoc에 한 줄로 남겼다(`:283`). 같은 커밋이 `allowUndeclared`가
  union 경로에서도 먹는지 뮤테이션 검증(분기 삭제 → 37개 스펙 중 신규 캐너리 1개만 실패)까지
  했다고 커밋 메시지에 명시했다 — 근거를 갖춘 수정. **해소 확인.**

## 발견사항

- **[INFO]** (확인 완료, 이미 추적·유예된 항목 — 재조치 요구 없음) `find → toBeDefined →
  assertMatchesContract` 3문장 패턴이 여전히 2곳에서 반복된다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:161-165`,
    `codebase/backend/test/workflow-execution.e2e-spec.ts:152-155`
  - 상세: 두 파일 모두 `items.find((x) => x.id === id)` → `expect(mine).toBeDefined()` →
    `assertMatchesContract(mine, xxxContract)` 세 문장을 그대로 반복한다. 이번 라운드에도 grep 으로
    재확인한 결과 발생 지점은 여전히 2곳뿐이고(위 "검증 방법"의 grep 출력), 새로 늘지 않았다.
    `13_49_54` RESOLUTION 에서 "지금 2곳뿐이고 §5.4 스윕이 실제로 어떤 형태(목록/단건/중첩 배열)를
    만나는지 봐야 헬퍼 시그니처가 정해진다"는 근거로 유예됐고, 같은 턴에
    `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재됐다. `14_39_31`·`15_12_02`
    두 라운드가 근거 유효성을 재확인했고 이번 라운드도 상태 변화가 없어 같은 판단을 유지한다.
  - 제안: 조치 불요 — §5.4 스윕(~56개 DTO) 착수 시점에 `assertItemMatchesDto(items, id, Dto)` 류
    헬퍼로 접을 것(이미 plan 에 등재됨). 매 라운드 WARNING 으로 재등재하면 "이미 유예된 항목을
    반복 지적"하는 stale 루프가 된다.

## 요약

이번 라운드의 실제 코드 범위(`audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`,
e2e 스펙 4개)는 직전 라운드(`15_12_02`) 이후 변경되지 않은 상태다. 세 차례 이전 라운드가 낸
WARNING 3건·CRITICAL 1건·INFO 1건이 모두 실제로 해소돼 있고 회귀 테스트(캐너리)까지 갖춰져
있음을 현재 소스에서 직접 재확인했다. 새로 발견한 CRITICAL/WARNING 급 결함은 없다. `findAll`은
필터 조건별 `if` 분기가 평평하게 나열돼 있어 중첩이 얕고, `visit`/`descend`/`visitUnion`은 함수당
책임이 하나(각각 "필드별 대조" / "중첩 스키마로 하강" / "판별자 없는 union 아래 대조")로 좁으며
JSDoc이 설계 결정과 반증 이력(어떤 접근이 왜 실측으로 반증됐는지)을 상세히 남겨 유지보수성이
높다. 유일한 잔여 항목(2곳의 3문장 반복)은 이미 plan에 등재되고 두 차례 재확인된 유예 항목이라
INFO로만 기록하며 이번 라운드에서 추가 조치를 요구하지 않는다. `plan/**`·`review/**` 하위 문서는
생성된 산출물 성격이라 코드 메트릭 적용 대상이 아니며 열람 결과 특별한 문제는 없었다.

## 위험도

NONE
