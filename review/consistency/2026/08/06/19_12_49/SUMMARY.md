# Consistency Check 통합 보고서

**BLOCK: YES** — 5개 checker 전원이 독립적으로 동일 근본 사실(target scope 와 실제 diff 완전 불일치)을 확인했고, `rationale_continuity` 가 이를 CRITICAL 로 분류했다. 이 요약 에이전트도 `git branch --show-current` / `git diff origin/main...HEAD --stat` 로 직접 재실측해 **동일 결과를 재확인**했다.

## 실측 재확인 (요약 에이전트 독립 검증)

```
$ git branch --show-current
claude/packages-prepare-stale-dist   # ← task 디렉토리 slug(harness-review-ci-backstop-91f379)와 다른 브랜치

$ git diff origin/main...HEAD --stat
28 files changed, 966 insertions(+), 7 deletions(-)
  .claude/tests/README.md, .claude/tests/test_packages_prepare_contract.py(신규 216줄)
  .github/workflows/harness-checks.yml(+5)
  codebase/packages/*/package.json ×7(버전 bump만)
  review/code/2026/08/06/18_55_02/**(직전 ai-review 산출물)
→ spec/4-nodes/** 는 이 diff 에 전혀 등장하지 않는다.
```

이번 5개 checker 호출은 `target_path=spec/4-nodes, --impl-done, diff-base=origin/main` 로 지정됐지만, 이 워크트리는 현재 그 task 와 무관한 `claude/packages-prepare-stale-dist` 브랜치에 체크아웃되어 있고 `spec/4-nodes` 는 `origin/main` 대비 바이트 단위로 무변경이다. 프롬프트에 첨부된 "diff" 섹션 자리에는 미치환 placeholder(`<git diff origin/main...HEAD -- code_areas>`)가 그대로 남아 있어, orchestrator 가 diff 산출/payload 조립 단계에서 실패한 것으로 보인다.

## 전체 위험도
**HIGH** — spec 콘텐츠 자체에서 발견된 위반은 LOW~WARNING 수준이지만, 이번 검토 라운드가 "실제로 무엇을 검증했는가"라는 전제 자체가 무너져 있어 이 결과를 어떤 PR(원래 의도한 `harness-review-ci-backstop-91f379`이든, 실제 브랜치 `claude/packages-prepare-stale-dist`이든)의 consistency 근거로도 쓸 수 없다. "발견 없음"을 신뢰성 있는 PASS 로 오인하면 위양성(false PASS) 위험이 크다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (전원 독립 확인: cross_spec / convention_compliance / plan_coherence / naming_collision + 이 요약 에이전트 재검증) | target scope(`spec/4-nodes`)가 실제 diff 와 완전히 무관 — 워크트리가 task slug 와 다른 브랜치(`claude/packages-prepare-stale-dist`)로 재사용되어 있고, `spec/4-nodes` 는 `origin/main` 대비 무변경. 진짜 변경분(`harness-checks.yml`, `test_packages_prepare_contract.py`, `codebase/packages/*/package.json`, `review/code/**`)은 검토 대상에서 완전히 빠짐. 프롬프트 diff 섹션은 미치환 placeholder 로 남아 있음 | 프롬프트 `## 검토 모드`/`meta.json` (`target_path: spec/4-nodes`, `--impl-done, diff-base=origin/main`) | 워크트리 실제 상태(`git branch`, `git diff origin/main...HEAD`) | 이 라운드 결과를 이 워크트리/PR 의 consistency 근거로 사용 금지. orchestrator 의 target_path·diff-base 산출 로직 점검 후, 실제 변경 영역(`.github/workflows/harness-checks.yml`, `.claude/tests/test_packages_prepare_contract.py`, `codebase/packages/*/package.json`)을 target 으로 consistency-check 재실행. task slug(`harness-review-ci-backstop-91f379`)와 실제 브랜치(`claude/packages-prepare-stale-dist`) 불일치의 근본 원인(워크트리 재사용/병렬 세션 충돌)도 별도 조사 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 2 | cross_spec | `spec/1-data-model.md` §2.6 "Node.type 전체 목록" 표에 trigger 카테고리(`manual_trigger`) 행 누락 — `spec/4-nodes` 가 정의하는 7 카테고리·29종 노드 개수와 불일치(기존 문서 결함, 이번 diff 와 무관) | `spec/1-data-model.md:171-202` | `spec/4-nodes/0-overview.md` §1.2/§2.0, `spec/4-nodes/7-trigger/0-common.md`·`1-manual-trigger.md` | `spec/1-data-model.md` §2.6 표에 `| trigger | manual_trigger | 워크플로우 시작 트리거 |` 행 추가 (project-planner) |
| 3 | convention_compliance | `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` 6개 파일 frontmatter `id: common` 충돌 — 같은 영역의 자매 파일(`6-presentation/0-common.md`=`presentation-common`, `0-overview.md`=`nodes-overview`)은 disambiguation 패턴을 따르는데 나머지 6개만 예외(기존 문서 결함, 이번 diff 와 무관) | `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` (frontmatter `id`) | `spec/conventions/spec-impl-evidence.md` §2.1 (basename 충돌 시 영역 prefix 로 회피) | 6개 파일 `id` 를 `logic-common`/`flow-common`/`ai-common`/`integration-common`/`data-common`/`trigger-common` 으로 정정 (project-planner, 순수 문서 수정·side-effect 없음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | `plan/in-progress/marketplace-and-plugin-sdk.md` 헤더가 존재하지 않는 "0-unimplemented-overview.md §A" 상위 인덱스를 여전히 참조. 자매 plan `ai-agent-tool-connection-rewrite.md` 는 2026-07-17 자로 이미 취소선 정정 완료 | `plan/in-progress/marketplace-and-plugin-sdk.md` 헤더 | `ai-agent-tool-connection-rewrite.md` 와 동일한 취소선 정정 반영 (developer 트랙에서 바로 수정 가능, 낮은 우선순위) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | scope/diff 불일치(INFO) + `spec/1-data-model.md` trigger 행 누락(WARNING, 기존 결함) |
| rationale_continuity | MEDIUM (개별 finding 은 CRITICAL 태그) | scope/diff 완전 불일치를 CRITICAL 로 분류(harness 신뢰성 결함) — spec 콘텐츠 자체엔 위반 없음 |
| convention_compliance | LOW | scope/diff 불일치(사전확인) + `0-common.md` id 6중 충돌(WARNING, 기존 결함) |
| plan_coherence | MEDIUM | scope/diff 불일치(WARNING) — 이 PR 의 실제 governing plan(`harness-review-gate-ci-backstop.md`) 검증 불가. plan 내용 충돌은 없음 |
| naming_collision | NONE | scope/diff 불일치(WARNING) — 신규 diff 없어 신규 식별자 충돌 판정 대상 자체가 없음 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** orchestrator 의 `--impl-done` target_path/diff-base 산출 로직 점검. 이 워크트리(slug=`harness-review-ci-backstop-91f379`)가 실제로는 `claude/packages-prepare-stale-dist` 브랜치를 체크아웃하고 있는 원인(워크트리 재사용/병렬 세션 충돌 추정)을 규명하고, 실제 변경 영역(`.github/workflows/harness-checks.yml`, `.claude/tests/test_packages_prepare_contract.py`, `codebase/packages/*/package.json`)을 target 으로 consistency-check 를 재실행할 것. 이번 라운드의 "발견 없음"을 그 변경에 대한 검증 근거로 삼지 말 것.
2. 재실행 여부와 무관하게, 이번에 스팟체크로 드러난 기존 spec 결함 2건(WARNING #2, #3)은 project-planner 에게 별도 전달 — `spec/1-data-model.md` trigger 행 추가, `spec/4-nodes/*/0-common.md` id 6중 disambiguation.
3. `marketplace-and-plugin-sdk.md` 죽은 상위 인덱스 참조 정정 (INFO #1, 낮은 우선순위).