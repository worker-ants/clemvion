# Rationale 연속성 검토 결과

## 검토 대상 / 전제 확인

지시된 검토 모드: `--impl-done, scope=spec/4-nodes, diff-base=origin/main`, target_path=`spec/4-nodes`.

전제 검증을 위해 워크트리 절대경로로 diff 를 직접 재확인했다 (프롬프트 지침에 따라 CWD 를 신뢰하지 않고 `git -C <절대경로>` 사용):

```
git -C "/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379" diff --stat origin/main...HEAD -- spec/4-nodes
```
→ **출력 없음 (0 파일 변경)**.

실제 `origin/main...HEAD` diff 전체 (28 files changed) 는 다음 영역뿐이다:
`.claude/tests/**`, `.github/workflows/harness-checks.yml`, `codebase/packages/*/package.json` (버전 bump), `review/code/2026/08/06/18_55_02/**`. **`spec/**` 는 diff 에 전혀 등장하지 않는다.**

## 발견사항

- **[CRITICAL]** 검토 대상 scope 와 실제 diff 가 완전히 불일치 — 이 라운드는 실질적으로 아무것도 검토하지 못했다
  - target 위치: 본 프롬프트의 `## Target 문서` / `meta.json` (`target_path: "spec/4-nodes"`, `mode: "--impl-done, scope=spec/4-nodes, diff-base=origin/main"`)
  - 과거 결정 출처: 해당 없음 (harness/orchestrator 스코프 라우팅 결함 — spec 내용 문제가 아님)
  - 상세: `--impl-done` 모드는 "diff-base 대비 신규·변경된 코드/spec" 을 target 으로 검토하는 것이 전제다. 그런데 `spec/4-nodes` 전체(0-overview + 1-logic/* 12개 파일, ~2,780줄)가 diff 라인 표시(`+`/`-`/`@@`) 전혀 없이 **최신 상태 그대로 통째로** 번들되어 있고, 실제 `origin/main...HEAD` 비교에서 `spec/4-nodes` 는 바이트 단위로 무변경이다. 이번 PR(harness-review-ci-backstop-91f379)의 진짜 변경분은 CI 백스톱 하네스(`.github/workflows/harness-checks.yml`, `.claude/tests/test_packages_prepare_contract.py`) 와 packages 버전 bump 뿐이며, `spec/4-nodes` 와는 도메인이 전혀 겹치지 않는다. 이 checker(rationale_continuity)뿐 아니라 동일 세션의 다른 4개 checker(`cross_spec`, `convention_compliance`, `naming_collision`, `plan_coherence`) 프롬프트도 각 300~360KB 로 동일하게 `spec/4-nodes` 를 번들한 흔적이 있어(같은 `_prompts/` 디렉토리), 이번 consistency-check 라운드 전체가 잘못된 target 으로 실행됐을 가능성이 높다.
  - 제안: orchestrator 가 `--impl-done` payload 생성 시 `diff-base` 대비 실제 변경 파일 목록(`git diff --name-only origin/main...HEAD`)을 target_path 결정의 1차 근거로 사용하도록 점검할 것. 이번 PR 에 대해서는 실제 변경 영역(`.github/workflows/harness-checks.yml`, `.claude/tests/**`, `codebase/packages/*/package.json`)을 target 으로 하는 consistency-check 를 재실행해야 한다 — 특히 이 변경들은 spec 문서와 직접 연동되지 않는 순수 하네스/CI 영역이라 Rationale 연속성 관점에서는 낮은 위험이지만, "검토했다"는 결과를 신뢰하려면 최소한 올바른 diff 를 대상으로 한 실행이 필요하다.

- **[INFO]** 번들된 `spec/4-nodes` 내용 자체(정적 스냅샷)에서는 Rationale 연속성 위반 미발견
  - target 위치: `spec/4-nodes/0-overview.md` §1.3/`## Rationale`, `1-logic/2-switch.md` §8, `1-logic/3-loop.md` §8, `1-logic/9-foreach.md` `## Rationale`(R-1), `1-logic/10-parallel.md` `## Rationale`(4개 항목), `1-logic/11-merge.md` `## Rationale`(R-wontdo-async-fanin)
  - 과거 결정 출처: 각 문서 자신의 `## Rationale` (예: parallel `waitAll=false spec out — 결정 K`, `중첩 Parallel 허용 — 결정 #3+G+D`, merge `R-wontdo-async-fanin` ADR)
  - 상세: 위 diff 부재를 확인하기 전, 내용 자체도 훑어봤다. 본문(§1~§7)의 서술이 각 절 `## Rationale`/`§8 Rationale` 에 기록된 결정·기각된 대안과 모두 정합했다 — 예: Parallel §1 의 "waitAll: false 미지원" 서술은 결정 K Rationale 과 일치, §3.2 동적 포트 불변성 서술은 §Rationale 의 branch cache 격리 설계와 상충 없음, Merge §1 의 "P1 dormant" 서술은 R-wontdo-async-fanin ADR(P2→P3 격하)과 일치. 흥미롭게도 두 곳(parallel `waitAll` 절, merge 자체)의 Rationale 은 **과거 rationale_continuity 라운드가 발견한 drift 를 이미 처분한 이력**(`consistency 23_36_57 rationale_continuity WARNING#1`, `2026-07-17 ADR`)을 명시적으로 인용하고 있어, 해당 문서가 이 checker 관점에서 이미 여러 차례 정합화를 거친 상태로 보인다.
  - 제안: 없음 (실제 diff 대상 재실행 시 이 INFO 는 참고용으로만 유지, 재검증 불필요 — 어차피 무변경 파일).

- **[INFO]** 컨텍스트 예산 초과로 33개 파일 + 실제 diff(`<git diff origin/main...HEAD -- code_areas>`) 자체가 프롬프트에서 생략됨
  - target 위치: 프롬프트 line ~2742 "⚠️ 컨텍스트 예산 초과로 생략된 파일 33개" 블록
  - 상세: `1-logic/6-split.md`, `1-logic/12-background.md`, `2-flow/*`, `3-ai/*`, `4-integration/*`, `5-data/*`, `6-presentation/*`, `7-trigger/*` 및 **가장 중요한 `<git diff origin/main...HEAD -- code_areas>` 자체**가 생략 목록에 있다. 즉 이번 프롬프트는 애초에 diff 를 포함하려 시도했으나 예산 초과로 diff 가 빠지고 정적 spec 전문만 남은 것으로 보인다 — 위 CRITICAL 항목과 같은 근본 원인(잘못된/과대한 target_path 선정)의 부작용일 가능성이 크다.
  - 제안: target_path 를 실제 diff 파일로 좁히면 이 생략 문제도 자연히 해소된다.

## 요약

이번 세션에서 지정된 `spec/4-nodes` 는 `origin/main...HEAD` diff 상 **전혀 변경되지 않은** 영역이며, 실제 PR 변경분(CI 백스톱 하네스 + packages 버전 bump)은 spec 과 무관하다. 따라서 "target 이 기존 Rationale 을 위반하는가"라는 본 checker 의 질문 자체가 이번 호출에서는 적용 대상이 없다 — 검토는 사실상 공회전했다. 번들된 `spec/4-nodes` 정적 내용만 놓고 보면 각 절의 서술은 자체 `## Rationale` 과 잘 정합되어 있고 과거 drift 처분 이력까지 인용하고 있어 문서 자체의 품질 문제는 없다. 진짜 문제는 orchestrator 의 target 선정/diff 번들링 로직이며, 이는 harness 신뢰성에 대한 CRITICAL 이슈로 별도 조치가 필요하다.

## 위험도

MEDIUM — spec 문서 자체에서는 위반을 찾지 못했으나(CRITICAL 급 spec 위반 없음), 이번 검토 라운드가 실제 변경분을 전혀 커버하지 못했다는 harness 신뢰성 결함은 CRITICAL 등급으로 보고했다. 다만 그 결함이 spec/Rationale 내용의 실질 위반은 아니므로 종합 위험도는 CRITICAL 이 아닌 MEDIUM 으로 판단한다 — 단, 이 회차의 "PASS" 를 근거로 실제 PR 변경분(harness-checks.yml 등)이 검증됐다고 간주해서는 안 된다.
