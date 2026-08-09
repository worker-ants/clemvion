# 정식 규약 준수 검토 — convention_compliance (3차 라운드, 종결 확인)

## 검토 범위·방법

- 대상: `spec/conventions/**` (bundle 원문 — spec-impl-evidence.md, audit-actions.md, cafe24-api-catalog/{_overview,category,store}.md 등)
- diff-base: `origin/main...HEAD` (`git diff --stat` 101 files changed 확인)
- 3차 라운드는 신규 전수 재검토가 아니라 **2차(`01_37_01`) 지적사항의 정정 여부 확인**이 목적:
  1. INFO — 도입일 하루 불일치 (`spec-impl-evidence.md:87` 08-10 vs 자매 문서·commit author date 08-09) → 08-09 로 정정 요구
  2. (참고, 본 checker 대상 아님) cross-spec/plan-coherence WARNING — `plan-scan.ts:21` stale plan 포인터
  3. 세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`) 정합 재확인

## 확인 결과

### 1. 도입일 정정 (INFO) — 반영 확인, 정합

- `spec/conventions/spec-impl-evidence.md:87` 현재 값:
  > `- \`status:\` 키 (**plan frontmatter**, 2026-08-09 추가) — \`plan/complete/**\` 의 \`status\` 도 2026-08-09 부터 build 가드 대상이 되면서 …`
  — 두 곳 모두 `2026-08-09` 로 정정됐다 (기존 08-10 잔존 없음, `grep -n "2026-08-09\|2026-08-10" spec-impl-evidence.md` 로 확인, 단일 히트).
- 실제 도입 commit 재확인: `plan-frontmatter.test.ts` 에 status 검사를 최초로 추가한 commit은
  `9e880e90802af8f31c49c46710c8c95b29aa4213` (`feat(harness): plan 이동이 남기던 두 갭에 게이트 — status 모순 · 살아있는 plan 의 깨진 링크`), author date **`2026-08-09T23:33:51+09:00`**. → 문서 값(08-09)과 정확히 일치.
- 자매 문서 `.claude/docs/plan-lifecycle.md:84` — `> 2026-08-09 신설. 이 저장소가 **두 번** 놓친 실패다(#1108·#1117) …` — 동일하게 08-09. 세 지점(spec-impl-evidence §2.2 두 곳, plan-lifecycle §4, 실제 commit author date) 이 모두 08-09 로 수렴. **불일치 없음.**

### 2. cross-spec/plan-coherence WARNING (`plan-scan.ts:21` stale plan 포인터) — 반영 확인

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:21` 현재:
  > `그 통합은 \`plan/in-progress/docs-guard-walker-dedup.md\` 에 등재했다.`
- 대상 plan 파일 실존 확인: `plan/in-progress/docs-guard-walker-dedup.md` (frontmatter `worktree: (unstarted)`, `started: 2026-08-10`, `owner: developer`, `status: in-progress`, `spec_impact: none`) — 실존 + 유효 frontmatter. dangling 포인터 아님.
- (본 checker 의 1차 관점은 아니나 교차 확인 결과 반영 확인됐음을 기록)

### 3. 세 미러 정합 재확인 — 정합

- **`PROJECT.md:277`**: `plan-frontmatter.test.ts` — plan 라이프사이클 가드 **3종**: (1) 3-필드 frontmatter 강제, (2) `plan/complete/**` status 종료값 강제(`complete`/`implemented`/`applied`/`superseded`, 선택 필드), (3) top-level 살아있는 plan 상대링크 무결성. 판정 로직 `plan-scan.ts`+`spec-links.ts`. SoT = `plan-lifecycle.md §4`.
- **`spec-impl-evidence.md §4.2`** (표 행 `plan-frontmatter.test.ts`): "셋을 본다 — (1)/(2)/(3)" 동일 3분류, 동일 종료값 enum, 동일 판정 로직 소재(`plan-scan.ts`/`spec-links.ts`), 동일 SoT 위임 문구("가드 규약 SoT = plan-lifecycle §4; 본 절은 가드 파일 등재 위치만 선언").
- **`plan-lifecycle.md §4/§5`**: §4 본문이 (1) 3-필드 스키마(worktree/started/owner, `(unstarted)` sentinel), (2) status 종료값 강제(2026-08-09 신설, `TERMINAL_PLAN_STATUSES` 확장점), (3) 상대링크 무결성(`plan/complete/**` 제외 근거 §3 인입 참조)을 동일 순서·동일 세부(enum 4값, 면제 대상)로 서술. §5 자가 점검 체크리스트도 두 항목(status/링크)을 동일 문구로 반영.
- 세 문서의 "선언 자체가 없으면 위반 아님(선택 필드)" · "`plan/complete/**` 는 링크 검사 대상 아님(시점 기록 문서)" 같은 예외 조건 문구도 세 곳 모두 동일하게 유지되어 있어 **드리프트 없음**.

### 신규 발견

없음. 2차 라운드에서 지적한 INFO(도입일 정정) 는 반영됐고 다른 곳과 새로 어긋나지 않는다. 세 미러는 여전히 정합이다. bundle 에 포함된 나머지 target 문서(audit-actions.md, cafe24-api-catalog/{_overview,category,store}.md)에서도 명명 규약(`<resource>.<verb>`, kebab-case operation id, resource dot-prefix)·frontmatter 스키마(`id`/`status`/`code`)·금지 패턴(prefix 없는 action 표기 등) 위반은 관측되지 않았고, 이번 diff 로 인한 신규 변경분(`spec-impl-evidence.md` 4-라인 diff)도 §2.1 필드 정의표·§4/§4.2 가드 표 서술과 완전히 정합한다.

기존 INFO(`plan-scan.test.ts` 가 spec-impl-evidence frontmatter `code:` 에 미등재 — 기존 비대칭 패턴 연장)는 조치되지 않았음을 확인했다(오케스트레이터 판단대로 미조치 유지, 재지적 안 함).

## 요약

3차 라운드는 2차에서 낸 INFO 1건(도입일 하루 불일치)의 정정을 확인하는 것이 목적이었고, 실측 결과 `spec-impl-evidence.md:87` 이 `2026-08-09` 로 정확히 정정되어 실제 도입 commit(`9e880e908`, author date 2026-08-09T23:33:51+09:00) 및 자매 문서(`plan-lifecycle.md:84`)와 완전히 일치한다. 별도로 cross-spec/plan-coherence 가 지적한 `plan-scan.ts:21` stale plan 포인터도 실존하는 신규 plan(`docs-guard-walker-dedup.md`)으로 교체되어 해소됐다. `PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5` 세 미러는 3종 가드(frontmatter 3필드/status 종료값/링크 무결성) 서술이 순서·세부·예외 조건까지 동일하게 유지되어 정합 상태다. 신규 CRITICAL/WARNING/INFO 발견 없음 — 본 라운드는 게이트를 열어도 되는 종결 상태로 판단한다.

## 위험도

NONE
STATUS=success
