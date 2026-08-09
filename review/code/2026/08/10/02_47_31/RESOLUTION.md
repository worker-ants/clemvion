# RESOLUTION — 02_47_31

리뷰 결과: RISK=LOW · Critical 0 · WARNING 2 · SPEC-DRIFT 1

## WARNING #1 — frontmatter 4종 판정이 positive-only (testing)

**반영.** 처음에는 `docs-guard-legacy-fixture-coverage.md` 로 **등재**하고 넘어갔는데, 같은
시각 정합 라운드의 rationale checker 가 그 유예를 규칙 문언으로 반박했다 —
`developer/SKILL.md §ISSUE FIX 정책`: "TEST·REVIEW WORKFLOW 에서 발견된 사항은 **기존부터
있던 것이라도 조치**". 등재는 조치가 아니다. 같은 클래스가 이 PR 에서 3회 반복 지적됐으니
의심할 것은 항목이 아니라 내 유예 근거였다.

조치 (`bc10e215e`):

- `worktree`/`started`/`owner` 판정을 `checkPlanFrontmatter(raw, relPath)` 순수 함수로
  `plan-scan.ts` 에 추출. **문자열 입력**이라 fixture 가 파일시스템 없이 각 분기를 겨눈다
- `plan-scan.test.ts` 에 negative-path fixture 8종 — placeholder 5어휘 · 빈/누락
  `worktree`·`owner` · 비-ISO `started` · 파싱 실패 · 스코프 면제
- 호출부는 4개 `it` 이름·개수를 유지하되 결과를 필드별로 가르기만 한다

**그 fixture 가 곧바로 결함 둘을 더 잡았다** — 등재만 했다면 둘 다 못 봤다:

1. **js-yaml 이 잘못된 날짜를 조용히 굴린다** — `2026-13-32` → `Date(2027-02-01)`,
   `2027-02-29` → `2027-03-01`, `2026-02-30` → `2026-03-02`. 즉 `instanceof Date && !isNaN`
   형태 검사는 전부 통과시킨다. 파싱 결과 대신 **원문 스칼라**를 보도록 고쳤다.
2. **gray-matter 캐시가 파싱 실패를 삼킨다** — 캐시 등록이 파싱 **전에** 일어나 throw 시
   부분 초기화 객체가 남는다. 같은 내용의 2회차 호출은 throw 없이 `data={}` (실측: 1회차
   THROW → 2회차 NOTHROW → 옵션 전달 시 THROW). 옵션 객체로 캐시를 우회한다.

뮤테이션 10/10 RED, 생존 0. 그 과정에서 `isIsoDate` 의 연·월·일 라운드트립 비교 중 **둘이
도달 불가**임이 드러나(각각 지워도 초록) 하나로 줄였다 (`e64b1218b`) — 셋을 두면 그 둘이
바로 이 PR 이 없애려는 죽은 분기가 된다.

`docs-guard-legacy-fixture-coverage.md` 는 항목이 전부 해소돼 삭제했다.

## WARNING #2 — 줄바꿈 스타일 불일치 4곳 (maintainability)

**미반영.** 제안된 판정 도구가 이 저장소의 스타일 권위가 아니다 — prettier 는 설정 파일·
`package.json` 의존성·`node_modules` 설치본 **셋 다 없다**(실측). 리뷰어는 `npx prettier` 로
받아 **기본 설정**으로 잰 것이다.

다만 그 밑에 깔린 관찰(구조가 같은 단언이 한 줄/여러 줄로 갈림)은 도구와 무관하게 참이었고,
WARNING #1 의 리팩터로 네 단언이 전부 균일한 `.toEqual([])` 이 되며 **함께 소멸**했다.

## SPEC-DRIFT #1 — `plan-lifecycle.md:83` 이 상수 소재를 오지목 (requirement)

**반영.** "새 종료 어휘가 필요하면 **그 파일**의 `TERMINAL_PLAN_STATUSES` 에 등재한다" 에서
"그 파일" 은 바로 앞의 `plan-frontmatter.test.ts` 인데, 상수는 `plan-scan.ts:100` 에 있다.
이 PR 안에서 옮긴 게 나다 — **이 PR 이 게이트를 세운 그 결함 클래스를 문서가 재현**했다.
자매 문서(`spec-impl-evidence.md:87`)는 맞게 적혀 있었다.

`plan-scan.ts` 로 정정했다.

## INFO

INFO 14건은 조치 불요로 판단. #7(선재 3필드 positive-only)은 WARNING #1 과 동일 항목이라
위에서 함께 해소됐다. #1(`ISO_DATE` 달력 유효성)도 같은 리팩터에서 해소됐다 —
`2026-13-32`·`2026-02-30` 류를 이제 거부한다.

## 검증

- 문서 가드 19파일 / 2854 tests PASS · tsc clean
- harness 995 tests OK
- 뮤테이션 10/10 RED (생존 0)
- **e2e PASS** — 298s / 264. `codebase/frontend/**` 가 변경 set 에 있어
  `PROJECT.md §e2e 면제 화이트리스트` 의 부분집합이 아니다 → 면제 불가, 수행함
