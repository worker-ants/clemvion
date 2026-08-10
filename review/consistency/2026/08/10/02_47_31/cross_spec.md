# Cross-Spec 일관성 검토 — spec/conventions/ (impl-done, diff-base=origin/main)

## 검토 방법

`git diff origin/main...HEAD` 를 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 직접 실행해
실제 변경분을 확인했다 (`## 구현 변경 사항` 번들 섹션이 예산 초과로 누락된 것으로 알려진 결함이
이번에도 재현). `spec/conventions/` 하위에서 diff 가 있는 파일은 `spec-impl-evidence.md` 단 하나임을
`git diff origin/main...HEAD --stat -- spec/conventions/` 로 확인했다 (다른 번들 파일은 컨텍스트일 뿐
target 변경 아님).

6차 라운드에서 반영됐다고 명시된 세 가지를 개별 확인:

1. **`plan-frontmatter.test.ts` 헤더 주석 축약** (38→22줄 수준) — `git diff` 로 전문 대조.
2. **`describe` 이름 변경** `"plan-frontmatter guard"` → `"plan lifecycle guards (frontmatter + live-plan links)"`.
3. **신규 plan** `plan/in-progress/docs-guard-legacy-fixture-coverage.md`.

## 발견사항

이번 라운드에서 spec-to-spec 또는 spec-to-code 교차 모순은 발견되지 않았다. 확인한 정합성은
다음과 같다.

### 1. 축약된 헤더 주석 vs `spec-impl-evidence.md §4.2`

`spec-impl-evidence.md` 는 이번 diff 에서 `plan-frontmatter.test.ts` row 를 이미
"셋을 본다 — (1)...(2)...(3)..." 형태로 갱신했고 (`git diff origin/main...HEAD -- spec/conventions/spec-impl-evidence.md`
로 확인), 이는 번들에 실린 §4.2 표 내용과 **완전히 일치**한다(선행 라운드에서 이미 반영·번들에
착지). 새로 축약된 `plan-frontmatter.test.ts` 헤더 주석은:

```
//   (1) top-level `plan/in-progress/*.md` 의 `worktree`/`started`/`owner` frontmatter. ...
//   (2) `plan/complete/**` 가 `status` 를 선언했다면 종료 상태여야 한다.
//   (3) top-level 살아있는 plan 의 상대링크가 실재 파일을 가리켜야 한다.
```

— §4.2 표의 (1)(2)(3) 서술과 항목 수·범위(`plan/in-progress/*.md` vs `plan/complete/**`)가
1:1 대응. "규칙 내용 자체는 불변" 이라는 주장은 근거가 있다 — diff 는 회고 서사(예: 종전 "Scope =
..." 단락의 이유 설명, TBD/미정 거부 사유)를 **삭제한 것이 아니라 재배치**했다. 예:
- "`worktree` accepts a real `<task>-<slug>` name OR ... `(unstarted)` ... Legacy placeholders
  ... rejected — they defeat the collision check" → 새 버전에서도 "레거시 placeholder(TBD,
  "assigned at impl-start", "미정", …)는 거부한다 — 살아있지만 죽은 worktree 처럼 보여 충돌
  검출을 오염시킨다" 로 그대로 보존.
- "plan-coherence 충돌 검출" 목적 서술도 (1) 항목 설명 안에 보존.
- 삭제된 것은 PR 라운드 내러티브(구체적 회차 지적 문구)뿐이며, 이는 `plan-lifecycle.md §4`
  (아래)에 이미 "> 2026-08-09 신설. 이 저장소가 두 번 놓친 실패다(#1108·#1117)" 형태로
  더 구체적으로 남아 있어 정보 손실이 아니라 **중복 제거**에 가깝다.

### 2. `PROJECT.md:277` 대조

`git diff origin/main...HEAD -- PROJECT.md` 로 확인한 277행 서술:

> `plan-frontmatter.test.ts` — plan 라이프사이클 가드 **3종**: (1) ... (2) ... (3) ...
> 판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크). SoT: `.claude/docs/plan-lifecycle.md §4`

축약된 헤더 주석의 "SoT 는 `.claude/docs/plan-lifecycle.md §4`. 이 파일은 **호출부**이고, 판정
로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크)에 있다" 와 표현까지 거의 동형 —
"호출부(caller)" 프레이밍과 판정 로직 소재 서술이 두 문서에서 정확히 일치한다.

### 3. `plan-lifecycle.md §4/§5` 대조

`.claude/docs/plan-lifecycle.md` 는 이번 브랜치에서 §2.1·§4·§5 에 각각:
- §2.1: "`plan-frontmatter.test.ts`: 3-필드 스키마 검사는 top-level `plan/in-progress/*.md`
  한정이나, §4 가 추가한 두 검사는 스코프가 다르다 — `status` 종료값은 `plan/complete/**`,
  상대링크는 top-level `in-progress`."
- §4: `status` 종료값 규칙(`complete`/`implemented`/`applied`/`superseded`, 선택 필드,
  `TERMINAL_PLAN_STATUSES` 참조) + 상대링크 무결성 규칙(`plan/complete/**` 는 대상 아님, §3
  "인입 참조" 근거) + `#1108`·`#1117` 배경.
- §5: 이동 commit 자가 점검 체크리스트에 두 항목 추가.

헤더 주석의 "(2)(3) 이 왜 필요한가·`plan/complete/**` 를 링크 검사에서 왜 빼는가는 SoT §3/§4 에
있다" 는 지시가 정확 — 실제로 §3(인입 참조) + §4(status/링크 규칙)에 그 근거가 있다. `TERMINAL_PLAN_STATUSES`
값도 `plan-scan.ts:100-105` 실코드(`complete`/`implemented`/`applied`/`superseded`)와 두 문서
서술이 정확히 일치함을 확인했다(`grep -n "TERMINAL_PLAN_STATUSES" -A5 plan-scan.ts`).

`#1108`·`#1117` 인용도 `git log --oneline --all` 로 실존 확인(`69f4307dd docs(plan): 완료 plan 의
stale 필드 2건 정정 ... (#1117)`, `e97d0d3a6 fix(auth): RolesGuard reflection 경화 ... (#1108)`) —
날조된 근거 아님.

### 4. `describe` 이름 변경의 부작용 범위

`describe("plan-frontmatter guard", …)` 를 참조하는 CI 워크플로·스크립트·문서 grep 결과, 실행 대상
파일 중 살아있는 참조는 없음(과거 정적 리뷰 산출물 `review/consistency/2026/07/16/14_57_19/plan_coherence.md`
에 로그 텍스트로 옛 이름이 한 번 남아있으나 이는 시점 기록이라 갱신 대상 아님 — `plan-lifecycle.md §3`
"인입 참조" 규정과 일치, 재실행되지 않는 정적 문서). 새 이름은 코드 리뷰(02_33_44 라운드)의
maintainability WARNING("describe 이름과 실제 스코프 어긋남")에 대한 직접 대응이며, 그 WARNING 이
제안한 "outer describe 이름을 'plan lifecycle guards' 등으로 포괄화" 옵션을 그대로 채택했다.

### 5. 신규 plan `docs-guard-legacy-fixture-coverage.md`

`spec_impact: none` 선언, `spec/` 미변경 — Gate C 관점에서 정합. 내용은 선재(origin/main 에 이미
있던) 3필드 검사(`worktree`/`started`/`owner`)가 positive-only 라는 테스트 커버리지 갭을 별도
plan 으로 등재한 것으로, spec 문서 어디와도 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 충돌이
없다. `docs-guard-walker-dedup.md` 상호 참조도 실존 파일.

## 요약

이번 라운드(6차)에서 반영된 변경 — `plan-frontmatter.test.ts` 헤더 주석 축약, `describe` 이름
포괄화, 신규 plan 등재 — 은 `spec/` 파일을 건드리지 않았고, `spec/conventions/spec-impl-evidence.md`
자체는 이전 라운드에서 이미 §4.2 표·§2.2 를 갱신해 번들에 반영된 상태다. 헤더 축약이 "규칙 내용
불변" 이라는 주장은 `spec-impl-evidence.md §4.2`·`PROJECT.md:277`·`plan-lifecycle.md §4/§5` 세
문서와 diff 원문을 직접 대조해 검증했으며, 세 곳 모두 (1)(2)(3) 세 가지 검사의 범위·SoT·판정 로직
소재를 정확히 같은 방식으로 서술한다. 축약 과정에서 떨어진 것은 회차 내러티브뿐이고, 그 내용은
`plan-lifecycle.md §4` 에 이미 더 구체적으로(PR 번호까지) 보존되어 있어 사실 손실이 아니다. 새
발견 없음.

## 위험도

NONE

STATUS=success
