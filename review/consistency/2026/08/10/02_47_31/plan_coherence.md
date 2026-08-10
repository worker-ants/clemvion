# Plan 정합성 검토 — 2026/08/10 02:47:31 (6차)

## 검토 범위

- target: `spec/conventions/` (impl-done, diff-base `origin/main`)
- 직전 라운드(`02_33_44`)는 NONE. 그 이후 diff: `f09b21893`
  (`fix(harness): 헤더 주석 축약 + describe 스코프 정정, 선재 검사 커버리지는 등재`) +
  `d79dd057b`(RESOLUTION e2e 줄 확정, 코드 변경 없음).
- 신규 plan 1건: `plan/in-progress/docs-guard-legacy-fixture-coverage.md`.
- 코드 변경: `plan-frontmatter.test.ts` 헤더 주석 축약(38→22줄) + describe 스코프명 정정.

모든 근거는 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서
`git show`/`git diff`/`Read` 로 직접 확인했다.

## 발견사항

새 CRITICAL/WARNING 없음. 확인한 3개 관점 모두 정합.

### 1. 신규 plan 의 위치 판단 — 적절

`docs-guard-legacy-fixture-coverage.md`(worktree/started/owner 세 필드 검사의
positive-only 갭)를 `docs-guard-walker-dedup.md`(walker 3벌 통합)와 별도 plan 으로 분리한
판단을 검증했다.

- **축이 실제로 다르다**: walker-dedup 은 "디렉터리 순회 필터 drift"(3개 walker 함수의
  제외 규칙 불일치), legacy-fixture-coverage 는 "vacuous positive-only 테스트"(판정 로직에
  대한 negative-path fixture 부재) — 실패 모드가 다르다. 앞선 라운드가 `harness-env-value-
  subpattern-dedup.md` 에서 `docs-guard-walker-dedup.md` 를 분리할 때 쓴 기준("공통점이
  느슨한 주제 유사성뿐이면 발견성이 떨어진다")과 같은 잣대를 적용해도 이번 분리는
  합당하다 — 코드 위치(같은 `__tests__/` 디렉터리)만 겹칠 뿐 검색 의도(walker 중복을 찾는
  사람 vs vacuous test 를 찾는 사람)가 갈린다.
- **상호 참조**: 신규 plan 의 "함께 볼 것" 절이 `docs-guard-walker-dedup.md` 를 명시
  링크하고 "축이 달라 별 plan" 이라고 이유까지 적었다. 역방향 링크는 없지만(walker-dedup
  이 legacy-fixture-coverage 보다 72분 먼저 생성돼 존재를 몰랐을 시점) 이는 발견성을 막는
  수준이 아니라 optional nicety.
- **참고 사례와의 일관성**: 같은 `docs-guard-walker-dedup.md` 안에서는 `SpecMdFile` 타입명
  이슈를 "별 축, 같은 착수 시점" 이라 적어두고도 분리하지 않고 같은 파일에 뒀다. 이것과
  비교했을 때 이번 분리가 기준을 일관되지 않게 적용한 것인지 검토했으나, `SpecMdFile` 은
  walker 3벌 중 하나(`collectCodebaseSources`)의 **반환 타입 자체**라 walker 문제 도메인
  안에 있고, legacy-fixture-coverage 는 전혀 다른 검사군(frontmatter 필드 검증)이라
  경계 판단이 다르다 — 모순 아님.

### 2. Frontmatter 스키마 준수 — 통과

`plan-lifecycle.md §4` 기준 확인:
- `worktree: (unstarted)` — 미착수 plan 의 명시 sentinel, placeholder 아님. 규정대로.
- `started: 2026-08-10` — ISO 날짜.
- `owner: developer` — 비어있지 않은 문자열.
- `priority`/`status`/`title`/`spec_impact` — 허용된 추가 필드. `spec_impact: none` 은
  Gate C 가 `complete/` 이동 시점에만 강제하는 필드라 in-progress 단계에서 미리 선언해도
  스키마 위반 아님.
- 빌드 가드 실측: RESOLUTION.md(`02_33_44`)에 "2845 → 2849 tests, +4 는 신설 plan 파일 때문
  (frontmatter 파싱 + worktree/started/owner 4개 `it`)" 로 이 plan 파일이 실제로 가드를
  통과했음이 기록돼 있다.

### 3. `plan-frontmatter.test.ts` 헤더 주석 축약 vs plan 서술 — 어긋남 없음

축약된 헤더(현재 13~35행, "(1)(2)(3)" 3종 불변식 요약 + SoT 위임)를 신규 plan·
`spec-impl-evidence.md:132` 와 대조:
- 헤더가 말하는 "판정 로직은 `plan-scan.ts`/`spec-links.ts` 소관, 이 파일은 호출부" 는
  `spec-impl-evidence.md:132` 서술과 동일하다.
- 헤더의 (2)(3) 검사(완료 plan status·상대링크)는 실제로 `plan-scan.test.ts`/기존
  `spec-links` 스캐너에 synthetic fixture 검증이 있음을 코드로 확인(`plan-scan.test.ts` 에
  `worktree`/`started`/`owner` 키워드가 전혀 없음 = 세 필드 검사 로직은 아직 그쪽으로
  추출 안 됨 → 신규 plan 의 "할 일" 과 정합).
- `worktree`/`started`/`owner` 세 `it()`(97~124행)이 `origin/main` 과 바이트 단위로 동일함을
  `git show origin/main:codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 로
  재확인 — plan 이 "실측: 세 `it()` 전부 존재 = 선재 코드" 라고 쓴 근거와 일치.
- 헤더의 "코드 주석은 현재 규칙만 담는다(회고 서사는 커밋 메시지·plan 산출물로)" 는 방침이
  실제로 지켜지고 있다 — PR 번호·라운드 히스토리가 코드에서 빠지고 `docs-guard-legacy-
  fixture-coverage.md`/커밋 메시지 `f09b21893` 로 옮겨간 것을 diff 로 확인.

### 미해결 결정과의 충돌 / 선행 plan 미해소 — 해당 없음

`plan/in-progress/**` 전수 grep(`plan-frontmatter|WORKTREE_PLACEHOLDER|positive-only`)에서
이번 신규 plan 외 다른 plan 이 같은 주제를 다루거나 상충하는 결정을 내린 흔적 없음. 이
convention(`spec-impl-evidence.md`, `status: implemented`)이 신규 plan 을 선행조건으로 가정하지
않으며(가드 자체는 이미 동작 중, plan 은 테스트 견고화 백로그), 신규 plan 도 convention 이
결정 안 한 항목을 우회 결정하지 않는다.

### INFO — 참고 (비차단)

- 신규 plan 본문 "할 일" 절의 "그 파일이 이미 세 관심사를 안고 있다는 지적이 별도로
  있다"(30~32행)는 어느 문서·라운드의 지적인지 인용이 없다. `plan-scan.ts` 현재 주석은
  live/complete 수집 + status 검증 2가지를 명시적으로 서술할 뿐 "세 관심사" 라는 표현은
  어디에도 없다. 실행 결정에 영향을 주는 문구는 아니고(착수 시 재판단하겠다는 유보) 착수
  전 확인용 메모라 차단 사유는 아니지만, 착수자가 출처를 못 찾아 헤맬 수 있으니 인용을
  붙이면 좋다.

## 요약

6차 라운드는 신규 plan `docs-guard-legacy-fixture-coverage.md` 하나만 추가됐고, 이는 직전
라운드 리뷰(`02_33_44` W1)의 정당한 등재 처리다 — `git show origin/main` 실측으로 대상
코드가 선재임을 확인했고, PR 범위 밖 인접 코드 확장을 반복 사양해 온 이 PR 의 기존 원칙과
일치한다. 별 plan 으로 분리한 판단은 walker-dedup 과 실패 모드(directory-walk drift vs
vacuous-test)가 달라 발견성 기준에 부합하며, 상호 참조도 갖춰져 있다. frontmatter 스키마는
`plan-lifecycle.md §4` 를 완전히 준수하고 빌드 가드 통과가 실측돼 있다. `plan-frontmatter.
test.ts` 헤더 주석 축약은 plan·spec 서술과 내용상 일치하며 "선재 코드" 주장도 diff 로
재확인했다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 것도 발견되지 않았다.

## 위험도

NONE

STATUS=success
