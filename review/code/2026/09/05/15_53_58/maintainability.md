# 유지보수성(Maintainability) 리뷰

## 검증 방법

`git log --oneline origin/main..HEAD` 로 이번 diff 의 커밋 13개(`0498d7362`~`6a6621ecd`)를 확인했다.
코드 메트릭(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성) 적용 대상은 실제 코드
파일뿐이다: `CHANGELOG.md`(문서), `audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/
`.spec.ts`, `execution-response.dto.spec.ts`, e2e 스펙 4개(`audit-logs`/`session-revocation`/
`workflow-crud`/`workflow-execution`). `plan/**`·`review/**` 하위는 생성된 산출물/추적 문서라
이전 네 라운드(`13_49_54`→`14_39_31`→`15_12_02`→`15_31_41`)와 같은 판단으로 코드 메트릭
대상에서 제외했다.

프롬프트에서 diff 가 생략된 `response-contract.ts`/`.spec.ts`/`execution-response.dto.spec.ts`
는 `Read` 로 현재 소스를 직접 열어 전문을 대조했다. `git log --oneline -- <파일들>` 로 확인한
결과 직전 라운드(`15_31_41`, 최종 코드 커밋 `5fcb5c625`) 이후 이 파일들에 새 커밋이 없다 — 즉
이번 라운드도 "새 diff 재검토"가 아니라 "회귀 여부 재확인"이다. `git status --short` 로 확인한
결과 이번 세션의 산출물 디렉터리(`review/code/.../15_53_58`, `review/consistency/.../15_53_59`)
외에는 저장소에 어떤 변경도 없다 — 뮤테이션을 가하지 않았다.

## 이전 라운드 지적의 해소 확인 (문제 없음 — 회귀 방지 기록)

- `13_49_54` WARNING 3건(`kind:'missing'` 이중 의미 / `dtoName: string` 이중 표현 / 캐싱 불일치)과
  `14_39_31` CRITICAL(자기참조 DTO 순환 가드가 스키마 이름 기준이라 payload 내부 검사 없이 통과)은
  모두 이전 라운드가 확인한 대로 현재 소스에 그대로 반영돼 있다 — `ContractViolationKind`에
  `'invalid-payload'` 전용 값, `DtoContract.name` 이 `Dto.name` 파생, 4개 e2e 전부 `beforeAll`
  캐싱, `onPath: ReadonlySet<object>` 기반 순환 가드. 각각 회귀 캐너리(`.spec.ts`)가 붙어 있다.
- `15_12_02` INFO(`visitUnion` 미사용 `_onPath` 파라미터) → 파라미터 자체가 제거된 4개 인자
  시그니처(`response-contract.ts` 289행)로 유지되고 있다.

## 발견사항

- **[INFO]** `visit()` 과 `visitUnion()` 의 "선언에 없는 키를 `undeclared` 로 보고" 하는 루프가
  거의 동일한 형태로 두 번 나타난다 — 차이는 "선언됨" 판정 조건과 `detail` 문구뿐
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:264-272`(`visit` 내부) 및
    `codebase/backend/src/shared/testing/response-contract.ts:294-302`(`visitUnion` 내부)
  - 상세: 두 블록 모두 `Object.keys(body)` 를 순회하며 `path = join(prefix, name)` 을 만들고,
    "선언됨"(`name in props` vs `declared.has(name)`) 또는 `allowUndeclared` 면제일 때
    `continue` 한 뒤, 나머지에 대해 `walk.out.push({ property: path, kind: 'undeclared', detail:
    ... })` 를 호출한다. 로직 골격이 완전히 같고 바뀌는 것은 "선언됨" 판정 조건 하나와 문구
    한 줄뿐이다. 파일 전체가 반증 이력을 상세히 남기는 높은 문서화 수준을 유지하고 있는 만큼,
    이 정도 규모(각 9줄)의 중복은 지금 당장 문제를 일으키지 않지만 `oneOf`/`anyOf` 판정 로직이
    향후 확장(예: 판별자 있는 union 지원)될 때 두 자리를 따로 고쳐야 할 위험이 있다.
  - 제안: 필수 아님. 원한다면 `reportUndeclaredKeys(body, isDeclared: (name: string) => boolean,
    prefix, walk, detail: string)` 같은 공용 헬퍼로 묶어 두 호출부가 판정 함수와 문구만 넘기게
    할 수 있다.

- **[INFO]** (확인 완료, 이미 추적·유예된 항목 — 재조치 요구 없음) `find → toBeDefined →
  assertMatchesContract` 3문장 패턴이 여전히 정확히 2곳에서 반복된다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:164-165`,
    `codebase/backend/test/workflow-execution.e2e-spec.ts:154-155`
  - 상세: grep 으로 재확인한 결과 이전 라운드(`15_31_41`)와 동일하게 2곳뿐이고 새로 늘지 않았다.
    `13_49_54` RESOLUTION 에서 "§5.4 스윕이 실제로 어떤 형태를 만나는지 봐야 헬퍼 시그니처가
    정해진다"는 근거로 유예됐고 같은 턴에 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 등재됐다 — 이미 세 라운드가 근거 유효성을 재확인한 항목이라 이번 라운드도 같은 판단을
    유지한다.
  - 제안: 조치 불요 — §5.4 스윕 착수 시점에 헬퍼로 접을 것(이미 plan 에 등재됨).

## 요약

이번 라운드의 실제 코드 범위(`audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`,
`execution-response.dto.spec.ts`, e2e 스펙 4개)는 직전 라운드(`15_31_41`, 코드 커밋 `5fcb5c625`)
이후 변경되지 않았다. 네 차례 이전 라운드가 낸 CRITICAL 1건·WARNING 3건이 모두 실제로 해소돼
있고 회귀 캐너리까지 갖춰져 있음을 현재 소스에서 직접 재확인했다. `AuditLogsService.findAll` 은
필터 조건별 `if` 분기가 평평하게 나열돼 있어 중첩이 얕고, `response-contract.ts` 의
`visit`/`descend`/`visitUnion` 은 함수당 책임이 하나로 좁으며 JSDoc 이 설계 결정과 반증 이력을
상세히 남겨 유지보수성이 높다. 새로 발견한 것은 `visit`/`visitUnion` 의 "undeclared 키 보고" 루프
9줄 중복 1건(INFO, 필수 아님)뿐이며, 기존 CRITICAL/WARNING 급 결함은 없다. `find→toBeDefined→
assertMatchesContract` 3문장 중복(2곳)은 이미 plan 에 등재되고 네 차례 재확인된 유예 항목이라
추가 조치를 요구하지 않는다. `plan/**`·`review/**` 하위 문서는 생성된 산출물 성격이라 코드
메트릭 적용 대상이 아니다.

## 위험도

NONE
