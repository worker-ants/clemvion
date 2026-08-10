# 정식 규약 준수 검토 — convention_compliance (재검토)

## 진단 메모

prompt_file 의 diff 섹션이 알려진 결함대로 부재해, 워킹트리 절대경로에서 직접
`git diff origin/main...HEAD` 로 실제 변경분을 재수집했다(`git diff -M`로 rename 감지도
확인). `spec/conventions/**` 자체의 diff 는 `spec-impl-evidence.md` 1개 파일뿐이라 이를
1차 target 으로 삼고, orchestrator 가 지목한 "재검토 확인 사항" 세 미러(`PROJECT.md:277` ·
`spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`) + 신규 plan
(`plan/in-progress/docs-guard-walker-dedup.md`)을 함께 검증했다.

직전 라운드(`review/consistency/2026/08/10/01_09_04/convention_compliance.md`)가 지적한
3건의 처리 상태:

1. **[WARNING] `PROJECT.md:277` 미러 stale** → **해소 확인**. `dd7da2d1b`(`fix(spec):
   spec-impl-evidence 의 plan-frontmatter 가드 서술·code: 등재 정정`)에서 `PROJECT.md:277`
   이 "plan 라이프사이클 가드 **3종**"으로 재서술됐다. `PROJECT.md:277` ·
   `spec-impl-evidence.md §4.2`(129행) · `plan-lifecycle.md §4`(80–91행) 세 곳을 나란히
   대조한 결과, (a) 3검사 목록(frontmatter 3필드 / `plan/complete/**` status 종료값 /
   top-level 상대링크) (b) `TERMINAL_PLAN_STATUSES` 4값(`complete`/`implemented`/
   `applied`/`superseded`) (c) 판정 로직 소재지(`plan-scan.ts`+`spec-links.ts`) (d) SoT
   단일 지정(`plan-lifecycle.md §4`)이 세 문서에서 **line-level 로 일치**한다. 실제 판정
   코드(`plan-frontmatter.test.ts`+`plan-scan.ts`)도 그대로 구현돼 있고 관련 스위트
   1503 tests PASS 로 실측했다.
2. **[INFO] `spec-links.ts` JSDoc "8건, 전부 이동형" 서술 stale** → **해소, 그것도 더 정확해짐**.
   현재 JSDoc(268–301행)은 "This guard sees 8"(이동 7 + stale anchor 1) vs "A 9th was fixed
   by hand and this guard cannot see it"(코드펜스 안 `../` 깊이 오류)로 갈라 쓴다 — 가드가
   증명하는 것과 손으로 고친 것을 명확히 구분해, 직전 라운드가 지적한 "숫자·유형 오분류"를
   반복하지 않는다.
3. **[INFO] Gate C `collectCompletePlans` 독립 구현 잔존** → **추적 위치가 개선됨**. 직전엔
   `harness-env-value-subpattern-dedup.md`에 있었으나, 이번 라운드에서 전용 신규 plan
   `plan/in-progress/docs-guard-walker-dedup.md` §"함께 볼 것 — Gate C 의 4번째 walker"로
   분리 이관됐다. 두 plan 사이의 "왜 병합하지 않았는가"(코드베이스·언어·실패모드가 다름)도
   `harness-env-value-subpattern-dedup.md` 쪽에 상호 링크로 남아 orphan 이 아니다.

## 발견사항

- **[INFO] 같은 기능(plan `status` 종료값 build 가드)의 도입일이 미러 문서 간 하루 어긋남**
  - target 위치: `spec/conventions/spec-impl-evidence.md:87` (§2.2 신설 불릿)
  - 위반 규약: 명시적 conventions 조항 위반은 아님. 다만 CLAUDE.md "정보 저장 위치" 단일
    진실 원칙과, 본 문서 R-8("cutoff 값은 spec-impl-evidence·plan-lifecycle·test 3곳에
    동기 유지")이 보여주는 "같은 사실을 서술하는 여러 SoT는 값이 정합해야 한다"는 이
    저장소의 관행에 대한 사소한 이탈
  - 상세: `spec-impl-evidence.md:87`은 "`status:` 키 (**plan frontmatter**, **2026-08-10**
    추가) — `plan/complete/**` 의 `status` 도 **2026-08-10** 부터 build 가드 대상이
    되면서…" 라고 적는다. 그러나 실제로 그 build 가드(`completed plans declare a terminal
    status` in `plan-frontmatter.test.ts`)를 도입한 커밋은 `9e880e908`
    (`feat(harness): plan 이동이 남기던 두 갭에 게이트…`, author date **2026-08-09
    23:33:51 +0900**)이고, 같은 사실을 서술하는 자매 문서 두 곳도 "2026-08-09"로 적는다 —
    `plan-lifecycle.md:84` "> 2026-08-09 신설. 이 저장소가 **두 번** 놓친 실패다…", 그리고
    `plan-frontmatter.test.ts:27` "// ── 2026-08-09: 이동(...)이 남기는 두 갭을 함께
    막는다 ──". `spec-impl-evidence.md`의 해당 불릿 자체는 자정을 넘긴 후속 커밋
    `dd7da2d1b`(2026-08-10 01:11:56)에서 작성됐으므로 "이 **불릿이 추가된 시점**"이
    2026-08-10 이라는 서술은 맞지만, "**가드가 build 대상이 되기 시작한 시점**"까지
    2026-08-10 으로 적은 것은 실제 커밋 이력과 하루 어긋난다.
  - 제안: `spec-impl-evidence.md:87`을 "`plan/complete/**` 의 `status` 도 **2026-08-09**
    부터 build 가드 대상이 되면서…"로 정정하거나, "부터 build 가드 대상이 되면서" 구절을
    "이번(2026-08-09~10 작업)에 build 가드 대상이 되면서"처럼 날짜 단수 표기를 피하는 방향도
    가능. 기능적 영향은 없음(순수 날짜 서술 정확도).

- **[INFO] `code:` frontmatter 에 신규 판정 모듈(`plan-scan.ts`)은 등재됐으나 그 fixture
  증명 테스트(`plan-scan.test.ts`)는 등재되지 않음 — 기존 비대칭 패턴의 연장**
  - target 위치: `spec/conventions/spec-impl-evidence.md:1-16` (frontmatter `code:` 목록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` `code:` 필드 정의("본 spec 이
    약속한 surface 의 구현 경로") — 강제 위반은 아님(`code:` 는 글로브 요구가 아니라
    명시 파일 목록이고, `spec-code-paths.test.ts` 는 "≥1 매치"만 요구하므로 build 는
    깨지지 않는다)
  - 상세: 이번 diff 가 `code:` 에 `plan-scan.ts` 를 새로 추가했는데(원본은 `spec-links.ts`
    만 있었음), 그 fixture 증명 스위트 `plan-scan.test.ts`(§4.2 R-9 도입 근거의 핵심 —
    "positive-only 로는 검사 작동을 증명 못한다"는 이번 PR 자신의 교훈을 실제로 지키는
    테스트)는 목록에 없다. 다만 이는 신규 결함이 아니다 — origin/main 시점부터 이미
    `spec-links.ts`(비-테스트 헬퍼)만 등재되고 그 fixture 증명 파일 `spec-links.test.ts`
    는 등재된 적이 없다(`git show origin/main:spec/conventions/spec-impl-evidence.md`로
    확인). 이번 PR 은 그 기존 비대칭 패턴을 `plan-scan.ts`/`plan-scan.test.ts` 쌍에
    그대로 연장했을 뿐이다.
  - 제안: 조치 불요(빌드 비차단, 기존 패턴과 일관). 다만 향후 §6 rollout 정책의 "spec 이
    약속한 surface" 해석을 헬퍼 모듈뿐 아니라 그 증명 테스트까지 포함할지 결정하는 별도
    정리 turn 이 있다면 `spec-links.test.ts`·`plan-scan.test.ts` 둘 다 함께 등재하는 편이
    일관적이다.

## §4/§5 상호 정합 확인 (`.claude/docs/plan-lifecycle.md`)

요청받은 "§5 체크리스트 추가분이 §4 와 모순 없는지"를 line-level 대조:

- §4(80–91행)의 두 규칙(① `plan/complete/**` `status` 종료값 4개, ② top-level 상대링크
  무결성)과 §5(106–109행) 체크리스트 두 항목이 **같은 값·같은 스코프**로 재진술된다 —
  터미널 어휘 목록(`complete`/`implemented`/`applied`/`superseded`), 대상 스코프
  (`plan/complete/**` vs top-level `in-progress`) 모두 불일치 없음.
- §2.1(34행)이 추가한 문장("§4 가 추가한 두 검사는 스코프가 다르다")도 §4 본문과 어긋나지
  않는다 — `research/` 가 3필드 스키마 검사 대상은 아니되(§2.1 기존 서술), §4 신설 두 검사는
  애초에 `plan/complete/**`·top-level `in-progress` 만 보므로 `research/` 를 언급할 필요가
  없고 실제로 언급하지 않는다.
- §5 말미의 메타 코멘트("위 두 항목은 `plan-frontmatter.test.ts` 가 사후에도 잡는다")는
  실제로 그 가드가 정확히 그 두 검사(`completed plans declare a terminal status` · `no
  broken relative links`)를 갖고 있음을 코드로 확인했다 — 서술과 구현이 일치.
- 판정 코드(`plan-scan.ts`)의 `TERMINAL_PLAN_STATUSES`(4값)도 두 문서와 정확히 같은
  집합이고, `plan-scan.test.ts`("TERMINAL_PLAN_STATUSES pins the four accepted values")가
  값 자체를 fixture 로 고정해 향후 drift 시 RED 로 드러난다.

모순 없음.

## 신규 plan `plan/in-progress/docs-guard-walker-dedup.md` 규약 준수

- frontmatter: `title`/`worktree: (unstarted)`/`started: 2026-08-10`/`owner: developer`/
  `status: in-progress`/`priority: P3`/`spec_impact: none` — `plan-lifecycle.md §4` 필수
  3필드(worktree/started/owner) 충족, `worktree` 는 미착수 sentinel `(unstarted)` 정확히
  사용(placeholder 아님). `status: in-progress` 는 `plan/in-progress/`에 있으므로 신설
  터미널-값 가드의 대상이 아니다(가드는 `plan/complete/**` 만 검사) — 값 자체도 실제
  상태와 일치해 모순 없음.
- 문서 구성: `## Overview` → 본문(대상 표·착수 전 체크리스트·관련 plan 교차참조) →
  `## Rationale` 3섹션 구조를 따른다(CLAUDE.md 의 spec 3섹션 권장과 이 저장소의 plan 문서
  관행에 부합).
- 실제 파일 존재 확인: `git ls-files codebase/frontend/src/lib/docs/__tests__/`로 walker
  3벌(`walkPlanMarkdown`/`collectSpecMarkdown`/`collectCodebaseSources`)이 모두 실재함을
  대조. plan 이 서술하는 "4번째 walker"(`collectCompletePlans`)도 `spec-plan-completion
  .test.ts:59`에 실제로 독립 구현으로 남아 있음을 확인 — plan 의 사실 서술이 코드와
  정합.
- `plan/in-progress/harness-env-value-subpattern-dedup.md` 쪽에도 본 plan 을 가리키는
  상호 링크·"왜 편입하지 않았는가" 설명이 있어, 신규 plan-frontmatter 가드가 검사하는
  top-level 상대링크 무결성 요구와도 부합(양쪽 다 실재 경로를 가리킴, `plan-frontmatter
  .test.ts` 스위트가 GREEN 임을 실행으로 확인).

## 부가 검증 — plan 이동/상태 정정 사례

`plan/complete/**` 15개 파일의 `status: in-progress → complete` 일괄 정정과
`plan/complete/spec-draft-secret-store-verification-footnote.md`의 rename
(`plan/in-progress/` → `plan/complete/`, `git diff -M`로 R074 확인)이 이번 PR 자신이 신설한
가드(§4의 두 규칙)를 실제로 만족시키는 방향으로 이뤄졌음을 diff 로 확인했다.
`c1-pr2-aiturn-blueprint.md`는 비표준 값 `"complete (PR #625 머지)"`를 `status: complete`
+ 신규 `pr: 625` 필드로 정규화해, `TERMINAL_PLAN_STATUSES.has()`의 정확 문자열 매치 요건에도
맞춘다 — 규약(§4)이 요구하는 "새 종료 어휘가 필요하면 `TERMINAL_PLAN_STATUSES` 에 등재"의
반대 경로(비표준 자유서술을 표준 값 + 별도 필드로 분리)를 정확히 택했다.

## 요약

직전 라운드가 지적한 CRITICAL 은 애초에 없었고, 유일한 실질 WARNING(`PROJECT.md:277` 미러
stale)은 이번 라운드에서 완전히 해소됐다 — `PROJECT.md:277`·`spec-impl-evidence.md §4.2`·
`plan-lifecycle.md §4/§5` 세 미러가 3검사(3필드 강제/종료값 검증/상대링크 무결성)의 스코프·
값·SoT 를 line-level 로 정합하게 서술하고, 실제 판정 코드·테스트(1503 tests PASS)도 그
서술을 뒷받침한다. §4/§5 사이 모순도 없다. 신규 plan `docs-guard-walker-dedup.md`는 frontmatter
스키마·3섹션 구성·상호 링크 위생 모두 규약을 준수한다. 남은 것은 순수 INFO 2건 — (a) 같은
기능의 도입일을 세 미러 중 한 곳(`spec-impl-evidence.md`)만 "2026-08-10"으로 다르게 적어
실제 도입 커밋(2026-08-09) 및 나머지 두 미러와 하루 어긋남, (b) `code:` frontmatter 가
신규 헬퍼 모듈은 등재하되 그 fixture 증명 테스트는 등재하지 않는 기존 비대칭 패턴을
그대로 연장함(비차단, 기존부터 있던 패턴). 둘 다 CI 를 막지 않고 구조적 규약 위반도
아니다.

## 위험도

LOW

STATUS=success
