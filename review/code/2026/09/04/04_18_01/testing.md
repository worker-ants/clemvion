# 테스트(Testing) 리뷰 — repo-guards walker 통합 + nullable-type-lie-cast 신규 가드 (8R)

## 검증 방법

이 changeset 은 이미 7개 리뷰 라운드(`01_48_39` ~ `03_58_32`)를 거쳤고, 직전 testing 리포트
(`03_58_32/testing.md`)는 위험도 LOW·Critical 0·Warning 0(직전 Warning 은 이미 조치)·INFO 3건
(모두 6R 부터 판단·유예 유지) 로 수렴한 상태였다. 그 보고를 그대로 받지 않고 현재 코드를 직접
열어 재확인했다 — 저장소 트리에는 아무 것도 쓰지 않음(`git status --short` 로 리뷰 전후 동일함
확인, 세션 자신의 `review/code/2026/09/04/04_18_01/` 만 untracked):

- `git log --oneline -5` → HEAD 가 `cfc69dd63`("리뷰 7R — JSDoc orphan …")로, 7R RESOLUTION 이
  주장한 최종 상태와 일치.
- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 119 tests 전부 PASS** (직전 라운드 보고 수치와 일치).
- `masked-reject-callers.spec.ts` 를 직접 열어 6R/7R 이 고쳤다는 JSDoc 결속을 확인 — 신규
  `describe('스캔 대상에 .spec.ts 가 포함된다')` 블록이 자기 JSDoc 바로 아래 있고, 원래
  `describe('resolveTriggerParameters 직접 호출부 허용목록')` 도 자기 JSDoc 을 되찾았다. orphan
  없음.
- `@OneToOne`·`| null = <default>`·2단 이상 데코레이터 스택 — 세 INFO 의 "저장소 전수 0건"
  전제를 `grep`/`grep -rlP` 로 독립 재확인. 여전히 0건.
- `node -e` 로 `.includes('| null')` 의 노테이션 변형 취급을 직접 실행해 아래 WARNING 의 근거를
  1차 확보(코드 읽기가 아니라 실행 결과).

## 발견사항

- **[WARNING]** `findUntypedNullableColumns` 가 방금 같은 파일에서 고친 것과 **동일한 노테이션
  취약 판정**을 그대로 쓰고 있고, 회귀 테스트가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:113`
    (`if (!tsType.includes('| null')) continue;`, `findUntypedNullableColumns` 내부,
    함수 전체는 `:104-121`). 대조 대상: `:172-179`(`isNullableType` 의 docstring, "왜
    `includes('| null')` 로 하면 안 되는가"를 명시적으로 논증) · `:180-185`(하드닝된 구현) ·
    `:194`(`widenedEntityFields` 가 그 하드닝된 버전을 쓴다).
  - 상세: 같은 파일 안에 `| null` 유니온 여부를 판정하는 두 자리가 있다. 하나(`isNullableType`,
    `widenedEntityFields` 가 소비)는 `tsType.split('|').map(trim).includes('null')` 로
    구현돼 있고, docstring 이 "`includes('| null')` 로 하면 표기 순서·공백에 걸린다 —
    `Date|null`(공백 없음)이나 `null | Date`(순서 반대)를 놓친다" 고 **정확히 이 문제를 근거로
    들어** 왜 그렇게 짰는지 설명한다. 그런데 `findUntypedNullableColumns` 는 여전히 하드닝
    이전의 naive `tsType.includes('| null')` 를 쓴다(:113). `node -e` 로 직접 실행해 확인한 결과:
    ```
    'Date|null'.includes('| null')   // false — 놓친다
    'null | Date'.includes('| null') // false — 놓친다
    'Date | null'.includes('| null') // true  — 표준 표기만 잡는다
    ```
    이 함수의 존재 이유는 "`| null` 인데 `@Column` 에 `type:` 이 없으면 TypeORM 이
    `design:type` 을 `Object` 로 방출해 부팅이 `DataTypeNotSupportedError` 로 죽는다"(docstring
    §"왜 필요한가", 2026-09-03 에 실제로 겪은 사고)를 막는 것이다. `Date|null`/`null | Date`
    표기로 nullable 컬럼을 선언하고 `type:` 을 빠뜨리면, 이 가드는 **자신이 막으려는 바로 그
    사고를 놓친다** — false negative 방향이라 조용히 통과한다.
  - 테스트 갭: `nullable-type-lie-cast.spec.ts` 에서 `findUntypedNullableColumns` 를 겨눈
    테스트는 전부 표준 표기(`string | null`, 공백 포함 정순)만 쓴다(158·167·176·187·193행).
    반면 자매 `widenedEntityFields` 는 정확히 이 두 변형을 `it.each`(공백 없음 `Date|null`,
    순서 반대 `null | Date`, 표준 `Date | null`)로 캐너리 고정해 뒀다(spec 244-248행) — 같은
    diff 안에서 한쪽만 하드닝+테스트되고 다른 쪽은 안 된 **비대칭**이다. 이 저장소가 이번
    changeset 전체에서 반복해서 짚어 온 실패 클래스(자매 함수 중 하나만 고치는 패턴, 예:
    1R W2 `stripLiterals`/`stripComments`)가 이 파일 안에서 다시 한 번 재발한 자리다.
  - 실측: 오늘 저장소에 이 표기 변형으로 선언된 nullable 컬럼은 없다(`grep -rnE
    "\w+\s*:\s*[A-Za-z_]+\|null\b"`, `"\w+\s*:\s*null\s*\|\s*[A-Za-z_]+"` 모두 0건,
    `src/modules/**/*.entity.ts`) — 지금은 잠재적이며 라이브 회귀는 아니다.
  - 제안: `findUntypedNullableColumns`(:113)의 `!tsType.includes('| null')` 를 같은 파일에
    이미 있는 `isNullableType(tsType)` 호출로 교체(`!isNullableType(tsType)`). 함수가 파일
    안에 이미 정의돼 있어 비용이 사실상 0이다. 교체 후 `widenedEntityFields` 의 `it.each` 와
    대칭인 노테이션-변형 캐너리 2~3건을 `findUntypedNullableColumns` 쪽에도 추가할 것을 권장.

## 확인된 항목 (문제 없음 — 직전 라운드 대비 재검증)

- **INFO(6R/7R 유지, 재확인)** `@OneToOne` 분기 미실행(`WIDENED_DECL`, guard:169) — 저장소
  `@OneToOne` 사용처 여전히 0건(`grep -rn "@OneToOne" src/modules --include="*.entity.ts"` →
  0건). 판단 유지, 조치 불필요.
- **INFO(6R/7R 유지, 재확인)** `isNullableType` 의 기본값 대입 형태(`Type | null =
  <default>`) 위음성(guard:180) — 저장소에 `| null = ` 패턴 여전히 0건. 판단 유지.
  (참고: 이 INFO 와 위 WARNING 은 서로 다른 함수를 겨눈다 — 하나는 `isNullableType` 자체의
  한계, 하나는 `findUntypedNullableColumns` 가 그 하드닝된 함수를 **아예 안 쓰는** 문제다.)
- **INFO(6R/7R 유지, 재확인)** `WIDENED_DECL` 의 "추가 데코레이터 1개까지만" 한계에 회귀-고정
  캐너리 없음(guard:160-166) — `grep -rlP '@(Column|ManyToOne|OneToOne)\('` 로 후보 파일
  41개를 다시 훑었고 3단 이상 스택 조합 여전히 미실재. 판단 유지.
- `collectTsFiles`(정렬·`.spec.ts` 포함/제외·`.d.ts`·`node_modules`/`dist`) 단위 테스트,
  `stripLiterals` 전용 스위트, `masked-reject-callers-guard.listSourceFiles` 의 `includeSpec`
  배선 테스트 — 전부 소스에서 직접 확인, 회귀 없이 유지.
- `findStaleSpecCasts`/`widenedEntityFields` 의 이름-충돌 오탐(2R W1) 하드닝과 대조군
  (`userId` 충돌·`onlyHereAt` 비충돌) 테스트 유지. "저장소 전수" 3건이 vacuous-pass 방지용
  전제 단언(`entities>30`·`specs>300`·`widened>100`)을 여전히 먼저 둔다.
- 테스트 격리: 이번 리뷰에서 접촉한 모든 테스트가 `os.tmpdir()` 기반 fixture +
  `try/finally`/`beforeEach`+`afterEach` 로 정리되고, 실제 소스 트리를 변형하지 않는다 —
  독립 재실행 순서와 무관하게 GREEN(직접 재실행으로 확인).
- Mock 사용: 여전히 mock/stub 없이 실제 `fs` + tmpdir. `node:fs` non-configurable 속성 때문에
  spy 시도가 실패했던 이력이 docstring 에 남아 이 선택이 임의가 아님을 뒷받침.
- 테스트 가독성: 각 `it`/`describe` 가 "왜 이 케이스가 존재하는가"를 주석으로 남기는 관례가
  이번 라운드에서도 흐트러지지 않았다.
- 테스트 용이성: 대상 함수가 전부 순수 함수(파일 경로 배열 → 값)라 DI 없이도 tmpdir fixture
  만으로 격리 테스트가 가능한 구조 — 이 특성이 7라운드 내내 하드닝 사이클을 싸게 유지했다.

## 요약

8R 시점에서 이 changeset 의 테스트 커버리지는 여전히 높은 수준이지만, 직전 라운드가 "새로
escalate 할 근거를 찾지 못했다"고 닫은 자리에서 하나를 더 찾았다 —
`findUntypedNullableColumns`(`nullable-type-lie-cast-guard.ts:113`)가 바로 옆 함수
`isNullableType`(:180)이 이미 하드닝해 둔 노테이션-강건 판정을 쓰지 않고 옛 naive
`.includes('| null')` 를 그대로 쓴다. 이 함수가 막으려는 사고(타입만 넓히고 `type:` 을 안 적어
TypeORM 부팅이 죽는 것)를 이 판정이 놓치는 방향이라, 표기 변형 컬럼이 생기면 가드가 조용히
통과한다. 저장소에 그 표기 변형이 실재하지 않아 지금은 잠재적이지만, 고치는 비용이 같은 파일
안의 함수 호출 교체 한 줄이라 유예할 이유가 약하다. 나머지는 6R/7R 부터 이어진 INFO 3건(모두
false-negative 방향, 0건 실재, 이미 판단·유예)이 그대로 유지되고, 회귀(119/119 GREEN)·격리·
가독성·mock 적절성 전반은 변함없이 견고하다.

## 위험도

MEDIUM
