# Plan 정합성 검토 — 3차 라운드(종결 확인)

## 검토 범위

- target: `spec/conventions/` (diff-base `origin/main`, impl-done)
- diff-base 확인: `git diff origin/main...HEAD` (worktree
  `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`, 전부 커밋됨)
- 2차(`01_37_01`)에서 낸 WARNING 1건(`plan-scan.ts:21` stale plan 포인터)의 정정 반영 여부,
  `harness-env-value-subpattern-dedup.md` 의 `#970` 인용 범위 축소가 타당한지, 두 plan
  (`docs-guard-walker-dedup.md` / `harness-env-value-subpattern-dedup.md`) 의 상호 참조 일관성,
  그 외 진행 중 plan 과의 새 충돌 여부를 확인.

## 정정 반영 확인

### 1) `plan-scan.ts:21` stale 포인터 → `docs-guard-walker-dedup.md` 신설로 정정 (확인됨)

`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:21` 주석은 이제 walker 통합 판정을
`plan/in-progress/docs-guard-walker-dedup.md` 로 가리킨다. 해당 파일을 직접 읽었다
(`plan/in-progress/docs-guard-walker-dedup.md`, 74줄, frontmatter `started: 2026-08-10`,
`spec_impact: none`). Overview 의 "왜 별 plan 인가" 절(11~22줄)이 정확히 2차 라운드가 지적한
문제를 스스로 서술한다:

> "한때 [`harness-env-value-subpattern-dedup.md`] 에 이관했는데, 그 plan 은
> `.claude/hooks/*.py` 의 정규식 상수 중복을 다룬다 — 코드베이스·언어·실패 모드가 전부
> 다르고 … 그 자리에 두면 'TS 문서 가드 walker 중복' 을 찾는 사람이 발견하지 못한다
> (consistency plan-coherence WARNING)."

WARNING 이 명시적으로 인용되고, 분리 근거(코드베이스/언어/실패모드 상이)도 구체적이다.
정정 완료로 판정.

### 2) `#970` 인용 범위 축소 (타당함)

`harness-env-value-subpattern-dedup.md` 의 "함께 볼 것 — 같은 'DRY vs 안전성' 축의 다른
plan" 절(56~72줄)을 확인:

> "(`#970`(blind 정규식 vs 정밀 파서)을 그 기준의 출처로 적었다가 **인용 범위를 좁혔다** —
> 그 사건이 세운 원칙은 '막는 쪽은 무지하게, 푸는 쪽만 정밀하게' 라는 **security 게이트
> 설계** 원칙이지, 일반 코드 중복을 문서상 어떻게 나눌지의 기준이 아니다. 이 분리 결정은
> 그 인용 없이도 성립한다 — 코드베이스·언어·실패 모드가 다르다는 독립 근거가 있다."

`#970`(사용자 메모리 `project_reaper_anchor_keep_and_push_guard_withdrawn.md` 요지: "blind
정규식은 '무지해서 안전', 정밀 파서는 무한 표면")은 실제로 **push-gate 같은 차단 표면의
정규식 vs 파서 선택** 에 관한 security 게이트 설계 판단이었고, 두 plan의 분리 여부(문서
조직 문제)와는 결이 다르다. 인용을 좁히고 "코드베이스·언어·실패 모드가 다르다" 는 독립
근거로 결정을 지탱한 것은 과잉 일반화를 정정한 타당한 조치다.

### 3) 두 plan 의 상호 참조 일관성 (확인됨)

- `docs-guard-walker-dedup.md` → `harness-env-value-subpattern-dedup.md` 를 가리키는 링크
  (17줄) 와, `harness-env-value-subpattern-dedup.md` → `docs-guard-walker-dedup.md` 를
  가리키는 링크(58줄) 가 상호 존재.
- 두 문서 모두 "분리 이유"를 동일한 근거(코드베이스·언어·실패 모드 상이, 주제 유사성뿐)로
  서술해 서로 모순되지 않는다.
- 두 plan 모두 `priority: P3`, `spec_impact: none`(또는 미선언 — `harness-env-value-...`
  는 `spec_impact` 필드 자체가 없음, `started: 2026-07-25` 로 Gate C cutoff `2026-06-04`
  이후이므로 완료 시 `spec_impact` 선언 의무 대상이지만 현재 `in-progress` 라 문제 없음).

## 새 충돌 확인 (없음)

- `spec/conventions/spec-impl-evidence.md` diff(§2.2 신규 `status:` 구분 항목, §4 표
  `plan-frontmatter.test.ts` 검증 범위 확장 — (1)(2)(3) 세 가지로 명문화)와 `plan-lifecycle.md`
  diff(§4 신설 체크리스트 항목: `status` 종료값 갱신 · 상대링크 정정)가 서로 정합하며,
  진행 중 다른 plan 이 이 규약을 우회하거나 반대되는 결정을 내린 흔적은 없음.
- `plan/in-progress/**` 전체에서 `Gate C`/`plan-frontmatter`/`TERMINAL_PLAN_STATUSES` 를
  언급하는 plan 7건(`auth-guard-reflection-hardening.md`,
  `spec-update-node-cancellation-shutdown-classification.md`,
  `eia-context-schema-followups.md`, `cafe24-backlog-residual.md`,
  `backend-lint-gate-broken-on-main.md`, `retry-turn-terminal-guard.md`,
  `docs-guard-walker-dedup.md`)를 확인 — 전부 기존 Gate C 동작을 전제로 한 관찰/합격
  기록이고, 이번 diff 가 정의하는 Gate C·plan-frontmatter 동작과 충돌하는 "결정 필요"
  항목은 없음.
- `plan/in-progress/harness-review-gate-followups.md` 에 이번 라운드 중 추가된 절
  ("`--impl-done` 세션은 spec-linked 편집 이후에 준비해야 한다", 2026-08-10)은 이번
  세션 자체의 리뷰 freshness 타이밍 관찰이며 target(spec/conventions/) 과 결정 충돌 없음.

## 참고 확인 요청 — "코드 주석이 이름으로 부르는 실존 plan 파일 12종 중 stale 1건" 재확인

이 주장은 **범위(scope) 를 어떻게 잡느냐에 따라 결과가 갈린다.**

- `codebase/frontend/src/lib/docs/__tests__/` (이번 두 plan 이 속한 도메인, walker 코드
  자체) 로 좁히면 실제 이름 지정 참조는 `plan-scan.ts:21` 단 1건뿐이고 stale 0건 —
  이 범위라면 사용자 주장과 정합.
- `.claude/hooks/*.py` + `.claude/tests/*.py` (harness 전반, 두 plan 중 나머지 하나의
  도메인) 로 넓히면 합성 fixture(`x.md`/`a.md`/`b.md` 등, 가드 자체를 테스트하는 더미
  이름) 를 제외한 실제 이름 지정 참조가 6건이고, 그중 **1건이 stale**:
  `.claude/tests/test_review_changeset_warning.py:10` 이 여전히
  `plan/in-progress/harness-review-gate-ci-backstop.md` 를 가리키나, 실제로는
  `plan/complete/harness-review-gate-ci-backstop.md` 로 이동했다 (`plan/in-progress/`
  에는 존재하지 않음). **이 stale 참조는 이번 PR 의 diff 에 없는 파일**(사전에 존재하던
  것)이라 이번 라운드가 만든 새 결함은 아니다.
- 저장소 전체(migration 주석·서비스 파일 주석·README 등, markdown 링크가 아닌 평문 경로
  언급 포함)로 넓히면 유사 패턴의 참조가 훨씬 많고(`eslint.config.mjs` →
  `plan/in-progress/eslint-unicorn-peer-restore.md` 도 실제로는
  `plan/complete/eslint-unicorn-peer-restore.md` 로 이동, 다수의 migration 파일 주석이
  가리키는 plan 이름이 `plan/in-progress/`·`plan/complete/` 어느 쪽에도 없는 경우도
  다수 확인됨), "1건뿐" 이라는 수치는 이 범위에서는 성립하지 않는다.

다만 이 광역 스캔은 **plan-coherence-checker 의 문서화된 소관 밖**이다.
`spec/conventions/spec-impl-evidence.md §4.2` 의 `spec-link-integrity.test.ts` 행 각주가
명시적으로 구분한다: "plan-coherence-checker 가 담당하는 것은 `plan/**` **문서 내부**의
링크 위생이지 spec→plan 링크가 아니다." 코드 주석 속 평문 plan 경로 언급(마크다운
`[..](path)` 링크가 아닌 것)은 어떤 build 가드도 검증하지 않고, 이 문서가 정의하는 plan
coherence 검토 범위에도 포함되지 않는다 — 그래서 위 발견은 이번 라운드의 게이트를
막는 사유가 아니며 INFO 로만 남긴다.

## 발견사항

- **[INFO]** "12종 중 1건 stale" 주장은 범위에 따라 갈린다 — harness 도메인으로 좁히면
  추가로 1건(`test_review_changeset_warning.py:10` → `harness-review-gate-ci-backstop.md`,
  실제로는 `plan/complete/`), 저장소 전체로 넓히면 다수의 유사 stale/dangling 평문 참조가
  확인된다.
  - target 위치: 해당 없음(target `spec/conventions/` 의 diff 와 무관)
  - 관련 plan: `.claude/tests/test_review_changeset_warning.py` (plan 문서 아님, plan 을
    이름으로 언급하는 코드 주석)
  - 상세: 이번 PR 의 diff 에 포함되지 않은 사전 존재 파일이며, `spec-link-integrity.test.ts`
    는 마크다운 링크 문법만 검증하고 평문 경로 언급은 검증 대상이 아니다.
    plan-coherence-checker 소관도 명시적으로 아니다(§4.2 각주).
  - 제안: 게이트를 막을 사유 아님. 원한다면 별도 저비용 정리 plan(예: 코드 주석의 stale
    plan 경로 언급 일괄 점검)을 새로 열 수 있으나, 이번 라운드의 종결 판정과는 무관.

## 요약

2차 라운드에서 지적한 WARNING(`plan-scan.ts:21` stale 포인터)은 `docs-guard-walker-dedup.md`
신설로 명확히 정정됐고, 그 문서가 WARNING 을 직접 인용하며 분리 근거(코드베이스·언어·실패
모드 상이)를 구체적으로 서술한다. `harness-env-value-subpattern-dedup.md` 의 `#970` 인용
범위 축소도 타당하다 — 원 사건의 성격(security 게이트의 정규식 vs 파서 설계 원칙)과 이번
결정(문서 조직)의 성격이 다르다는 점을 정확히 짚었고, 인용 없이도 성립하는 독립 근거를
남겼다. 두 plan 의 상호 참조는 양방향으로 일관되며, target(`spec/conventions/`) diff 와
진행 중 다른 plan 사이에 새로운 미해결 결정 충돌이나 선행 조건 미해소는 발견되지 않았다.
사용자가 별도 확인을 요청한 "12종 중 1건 stale" 주장은 검토 범위를 어떻게 잡느냐에 따라
갈리는데, 이번 PR 의 도메인(문서 가드 walker)으로 좁히면 정합하지만 harness 전반이나
저장소 전체로 넓히면 추가 stale/dangling 참조가 발견된다 — 다만 이는 plan-coherence-checker
의 명시된 소관 밖(평문 코드 주석, 마크다운 링크 아님)이라 이번 게이트를 막는 사유가 아니다.
새로운 CRITICAL/WARNING 은 없음. 이 라운드는 종결 라운드로 판정할 수 있다.

## 위험도

NONE

STATUS=success
