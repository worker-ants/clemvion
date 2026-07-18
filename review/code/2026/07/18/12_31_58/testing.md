# 테스트(Testing) 리뷰 — interaction-type-guard-comment-false-negative 후속

## 검증 방법

`codebase/frontend` 에서 `vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 실행 —
3 tests 전부 PASS 확인(self-test 1건 + 두 exhaustiveness 가드 2건). `REGISTRY_SITES`/
`SOURCE_REGISTRY_SITES` 가 가리키는 4개 소스 파일 실존도 확인.

## 발견사항

- **[INFO]** `.tsx` 대응 결정이 커밋된 테스트가 아니라 plan 문서의 1회성 수동 프로브에만 근거
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L176-183
    (`ts.ScriptKind.TS` 하드코딩), 근거는 `plan/in-progress/interaction-type-guard-comment-false-negative.md`
    "(c) `.tsx` `ts.ScriptKind` 분기는 철회" 항목
  - 상세: "`.ts`/`.tsx` 두 모드가 문자열 리터럴을 동일 수집한다"는 결론은 TS parser 의
    error-recovery 가 JSX 내부 리터럴도 토큰화한다는 내부 구현 디테일에 의존하며, 이 성질은
    6종 JSX 프로브로 **1회 수동 검증**됐을 뿐 리포지토리에 실행 가능한 형태로 잠겨 있지 않다.
    향후 TypeScript 버전 업그레이드로 error-recovery 동작이 바뀌거나 `.tsx` 사이트가
    `REGISTRY_SITES` 에 실제로 추가되는 시점에, 이 가정이 깨져도 어떤 테스트도 잡아내지 못한다.
    현재 등록 사이트가 전부 `.ts` 라 즉각 리스크는 없고, 결정 자체(§5 원칙에 따라 vacuous guard
    미도입)는 합리적이다.
  - 제안: 최소한 `ts.ScriptKind.TS` 하드코딩 옆에 이 결정과 plan 링크를 남겨 향후 유지보수자가
    plan 아카이브를 뒤지지 않아도 근거를 알 수 있게 한다. 선택지로, `.tsx` 사이트 추가 시점에
    프로브를 커밋된 regression test 로 승격하는 방안도 고려할 수 있다(현재는 불필요).

- **[INFO]** 보간 템플릿 리터럴(`TemplateExpression`)의 head/middle/tail 부분은 수집 대상 밖
  - 위치: `collectCodeStringLiterals` (동일 파일) — `ts.isStringLiteral` / `ts.isNoSubstitutionTemplateLiteral`
    만 검사
  - 상세: `` `prefix-${x}` `` 형태의 `TemplateHead`/`TemplateMiddle`/`TemplateTail` 은 두 타입가드
    어디에도 걸리지 않아, 만약 미래에 등록 사이트가 enum 값을 보간 템플릿 텍스트 일부로 표기하면
    (현재는 없음) 가드가 이를 놓친다. 가드의 위협 모델이 "코드 사이트의 다양한 분기 형태를 모두
    커버"라고 명시하는 만큼, 현재 미탐지 형태라는 점을 self-test 나 주석으로 명시해두면 향후 회귀를
    예방하는 데 도움이 된다. 현재 4개 등록 사이트 어디도 이 패턴을 쓰지 않아 실질 리스크는 낮음.
  - 제안: 선택 사항 — self-test fixture 에 `` `x-${1}-real_something` `` 형태의 부정 케이스(수집 안 됨을
    문서화하는 단언)를 추가하거나, 최소 함수 docstring에 이 한계를 한 줄 명시.

- **[INFO]** `readRepoFile` 의 상대경로 `"../../../../../"` 하드코딩(본 diff 범위 밖, 기존 코드)
  - 위치: 동일 파일 L146-149
  - 상세: `__dirname` 기준 5단계 상위로 리포 루트를 찾는 방식은 디렉터리 depth 가 바뀌면(파일 이동
    등) 조용히 잘못된 경로를 읽거나 ENOENT 로 실패한다. 본 PR 에서 변경된 라인은 아니라 이번
    diff 의 결함은 아니지만, 이 가드가 향후에도 유지보수될 파일이라 참고로 남긴다.
  - 제안: 조치 불요(정보 제공 목적). 필요 시 `find-up` 류 유틸이나 리포 루트 마커 파일 탐색으로
    대체 가능.

## 강점 (참고, 조치 불요)

- self-test fixture 확장(union 타입 선언·객체 프로퍼티 값·정규식 리터럴)이 실제로 새로운 회귀
  방어력을 갖는지 plan 문서가 **양방향 mutation 프로브**(수집기를 `=== RHS` 로 좁히면 red / substring
  매칭으로 되돌리면 red / 무수정이면 green)로 실증했고, 이 리뷰에서도 vitest 실행으로 현재 green
  상태를 재확인했다. "테스트가 green" 만으로 만족하지 않고 "깨뜨려 봤다" 는 증거를 남긴 점은 통상적인
  PR 테스트 수준을 상회한다.
- ghost/real 리스트를 명확히 분리한 구조(`for (const real of [...])` / `for (const ghost of [...])`)라
  각 케이스가 왜 있는지 fixture 옆 인라인 주석과 함께 읽기 쉽다.
- `interaction-type-registry.ts` 변경은 JSDoc 문구 정정("grep 가드" → "AST 가드")뿐으로 런타임 동작
  변화가 없어 테스트 추가가 불필요하다는 판단이 맞다.
- `plan/`·`review/consistency/**` 산출물(파일 3~11)은 애플리케이션 코드가 아니라 테스트 관점 리뷰
  대상이 아니며, 문서 내용 자체도 이번 diff 의 테스트 검증 이력을 정확히 반영한다(직접 vitest 실행으로
  교차 확인).

## 요약

이번 변경의 실질 테스트 대상은 `interaction-type-exhaustiveness.test.ts` 의 self-test fixture
확장 하나이며, union 타입 선언·객체 프로퍼티 값·정규식 리터럴 비오염이라는 세 가지 실제 회귀
위협을 정확히 겨냥해 추가됐고 양방향 mutation 프로브로 유효성이 검증됐다(본 리뷰에서도 vitest 실행
재확인, PASS). `interaction-type-registry.ts` 변경은 주석 정정뿐이라 테스트 불요 판단이 타당하다.
Critical/Warning 급 결함은 발견되지 않았으며, `.tsx` 대응 미도입 결정이 커밋되지 않은 1회성 수동
프로브에 의존한다는 점과 보간 템플릿 리터럴 미탐지라는 두 가지 정보성 갭만 남아 있다 — 둘 다 현재
등록 사이트 형태와 무관해 즉각 조치는 불요하다.

## 위험도

LOW
