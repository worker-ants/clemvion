# 테스트(Testing) 리뷰

## 배경 (3라운드 누적)

이 diff 는 `raw-update-guard-scope` PR 이 이미 2라운드 리뷰(`12_41_15`→`13_15_58`)를 거치며
정확히 이 관점(testing)에서 지적된 항목들을 순차로 해소한 상태다. 직접 코드를 열어 확인한 결과:

- 1라운드 testing WARNING("`hasRawUpdateReturning` 전용 단위 테스트 부재") → `source-scan.spec.ts`
  `describe('countRawUpdateReturning / hasRawUpdateReturning')` 신설로 해소 확인.
- 2라운드 testing WARNING #2("`guardCount < rawCount` 판정을 가르는 판별 입력이 영속 테스트에
  없음") → `update-returning-rows.spec.ts` 의 판정 로직을 `findUnguarded()` 순수 함수로 추출하고
  `describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다')` 5개 테스트로 해소 확인.
- 2라운드 testing WARNING #3("`.query(sqlVar)`·2단계 중첩 제네릭 blind spot 이 문서화만 되고
  캐너리 테스트가 없음") → `source-scan.spec.ts` 음성 `it.each` 에 두 케이스 추가로 해소 확인.
- `kb-stats.helper.spec.ts` mock 이 `[[{...}],1]`/`[[],0]` 튜플 shape 로 정정된 것도 확인.

실제로 관련 3개 스펙 파일을 직접 실행해 43/43 GREEN 을 재확인했다 (`npx jest
src/common/__test-utils__/source-scan.spec.ts src/common/utils/update-returning-rows.spec.ts
src/modules/knowledge-base/graph/kb-stats.helper.spec.ts`).

이번 라운드에서는 그 위에서 **새로 남은 갭**만 아래에 기록한다.

## 발견사항

- **[WARNING]** 이 PR 의 핵심 하드닝인 `findUnguarded()` 를 검증하는 합성 테스트 5개가 전부
  `discovered` 배열 원소를 **1개**만 넣는다 — 여러 파일을 한 번에 판정할 때 루프가 **전 원소를
  끝까지 순회**하는지는 어떤 테스트도 가르지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `findUnguarded`
    (라인 167-182), 검증 블록 `describe('findUnguarded — 합성 입력으로 판정 로직 자체를
    고정한다')` (라인 306-351, 5개 `it` — `partial`/`full`/`over`/`allowlisted-grown`/
    `allowlisted-stable` 전부 `discovered` 인자가 단일 원소 배열).
  - 상세: scratch 에서 `findUnguarded` 를 그대로 복제해 "첫 unguarded 항목을 찾으면 `break`" 뮤턴트를
    만들어 기존 5개 합성 테스트를 재현했다 — **5개 전부 GREEN(뮤턴트 생존)**. 반면 2개 파일이
    모두 unguarded 인 다중 원소 입력(`[['a.ts',2],['b.ts',2]]`, 둘 다 `guardCountOf=1`)으로는
    원본이 `['a.ts','b.ts']`, 뮤턴트가 `['a.ts']` 만 반환해 **원본-뮤턴트 결과가 실제로
    갈렸다** — 즉 다중 원소 테스트 하나만 추가하면 잡히는 뮤턴트가, 현재 스위트로는 안 잡힌다.
    실제 `discover()` 로 저장소 전체를 스캔하는 위쪽 `describe`(라인 184-298) 도 이 뮤턴트를
    못 잡는다 — 오늘 저장소의 실제 7개 지점이 전부 이미 guarded 라 `unguarded` 배열 자체가
    항상 비어 있어서 조기 종료 여부가 관측되지 않는다. 이 PR 은 정확히 이런 "판정 축을
    가르는 판별 입력이 없다" 는 형태의 결함을 2라운드에 걸쳐 스스로 찾아 고쳤는데
    (`guardCount<rawCount` 자체, allowlist 개수 비교), 그 고리의 마지막 한 칸 — **"여러
    unguarded 파일을 전부 보고하는가"** — 만 아직 판별 입력이 없다.
  - 제안: 합성 `describe` 에 `discovered` 원소가 2개 이상이고 그중 2개 이상이 unguarded 로
    분류돼야 하는 케이스를 하나 추가한다(예: `[['a.ts', 2], ['b.ts', 2]]` + `guardCountOf` 가
    둘 다 1을 반환 → `expect(unguarded).toEqual(['a.ts', 'b.ts'])`). 이러면 "찾는 대로 멈춘다"
    류의 회귀를 명시적으로 가른다.

- **[INFO]** `CHANGELOG.md` 의 "판정 축(양성 6·음성 5)" 서술이 이번 diff 최종 상태와 어긋난다 —
  실제로는 음성 케이스가 **7개**다(`source-scan.spec.ts` 를 직접 열어 `it.each` 항목을 셈).
  - 위치: `CHANGELOG.md:21-22`("`hasRawUpdateReturning`/`countRawUpdateReturning` 전용 단위
    테스트를 신설해 판정 축(양성 6·음성 5)을 합성 문자열로 직접 고정했다"). 실제 음성
    `it.each` 는 `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` 라인 101-137에
    INSERT…RETURNING·INSERT…ON CONFLICT·RETURNING 없음·주석·QueryBuilder(5개, 1라운드분) +
    `.query(sqlVar)`·2단계 중첩 제네릭(2개, 2라운드 W3 해소분) = 7개.
  - 상세: 이 CHANGELOG 항목은 `dd273828f`(1라운드 fix 직후) 커밋 시점엔 정확했다 — 당시엔
    음성 케이스가 5개였다. 이후 2라운드 fix(`030e9a825`)가 blind-spot 캐너리 2개를 그 음성
    목록에 추가했는데, `CHANGELOG.md` 는 그 뒤로 갱신되지 않았다. 실피해는 낮다 — 실제
    커버리지를 **과대**가 아니라 **과소** 서술하는 방향이라 독자가 "이 축은 이미 검증됐다"고
    오판할 위험은 없다(오히려 반대로 더 있다고 오인할 사람은 없다). 다만 이 저장소가 반복
    학습한 "PR 안의 정량 기록은 PR 이 닫히는 시점의 값이어야 한다"는 규율에서 벗어난 사례다.
  - 제안: `양성 6·음성 5` 를 `양성 6·음성 7`(또는 "SQL 변수 전달·2단계+ 중첩 제네릭 두
    blind spot 캐너리 포함")로 갱신. 급하지 않음 — CHANGELOG 는 Unreleased 섹션이라 릴리스
    전 어느 시점에 일괄 정정해도 된다.

## 회귀 테스트 유효성

기존 `EXPECTED`(3파일 정확한 개수) 큐레이션 가드는 이번 diff 로 로직이 바뀌지 않았고, `SRC` 상수
hoist·`MIN_REASON_LENGTH` 상수화도 순수 리팩터라 회귀 위험 없음을 직접 코드로 확인했다. `kb-stats
.helper.spec.ts` 의 세 번째 테스트("propagates DB errors")는 mock shape 변경과 무관해 그대로
유효하다.

## 테스트 격리 · 가독성

`discover()` 결과를 `beforeAll` 로 1회 캐싱해 4개 `it` 이 공유하지만 순수 함수라 격리 위반은
없음(어떤 `it` 도 `discovered` 를 변형하지 않음, 주석으로도 명시). `findUnguarded` 합성 테스트는
각자 독립된 리터럴 입력을 쓰므로 테스트 간 의존성 없음. 각 테스트 설명("부분 커버리지…",
"완전 커버리지…" 등)이 축을 명확히 표현해 가독성 양호.

## 요약

3라운드에 걸쳐 이 PR 자신이 반복 발견·해소해 온 "판정 축을 실제로 가르는 판별 입력이 없다"는
결함 클래스가, 이번 라운드에도 한 겹 남아 있었다 — `findUnguarded` 의 핵심 루프가 **여러**
unguarded 파일을 전부 보고하는지를 가르는 다중 원소 합성 테스트가 없다(scratch 뮤테이션으로
직접 실증: 조기 종료 뮤턴트가 기존 5개 합성 테스트 전부 통과). 활성 버그는 아니다 — 오늘 저장소의
실제 7개 지점은 전부 guarded 라 이 경로가 실행 중 관측되지 않는다. 부수적으로 `CHANGELOG.md` 의
테스트 축 개수 서술(양성 6·음성 5)이 2라운드에서 추가된 blind-spot 캐너리 2개를 반영하지 못해
현재 상태(음성 7)와 어긋난다 — 과소 서술이라 실피해는 낮음. 그 외 핵심 로직(신설 함수, discover
기반 가드, kb-stats 타입 정정)은 앞선 두 라운드의 testing WARNING 을 정확히 해소했고, 관련
3개 스펙 파일을 직접 실행해 43/43 GREEN 을 재확인했다.

## 위험도

LOW
