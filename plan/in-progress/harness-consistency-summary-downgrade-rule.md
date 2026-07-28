---
title: consistency-summary 가 Critical 을 하향할 수 있는가 — 규약에 조항이 없다
worktree: (unstarted)
started: 2026-07-25
owner: developer
priority: P2
---

## Overview

`review/code/2026/07/25/22_58_00` **CRITICAL** 에서 분리. 코드 결함이 아니라 **harness 규약의
구조적 갭**이다.

## 관측

`--impl-done` 22_28_51 에서 `cross_spec` 이 `[CRITICAL]` 로 판정한 항목(§6 구현 현황 표가 실제
코드와 반대)을 `consistency-summary` 가 통합 단계에서 **WARNING 으로 하향**하고 `BLOCK: NO` 를
냈다. 하향 근거 자체는 타당했다 — "이미 planner 에 위임됐고 승격 조건까지 문서화됨".

그런데 규약에는 그런 재량이 없다(실측):

```
.claude/agents/consistency-summary.md:20  Critical 1건이라도 있으면 상단 BLOCK: YES
.claude/agents/consistency-summary.md:45  차단 결정 명시 — Critical 1건 이상 → BLOCK: YES
```

그리고 `review_guard.py` 는 `SUMMARY.md` 의 `BLOCK:` **한 줄만** 파싱하므로, 이 하향은
SPEC-CONSISTENCY 게이트를 실제로 통과시키는 효과를 낸다.

## 진짜 문제 — developer 혼자 닫을 수 없는 CRITICAL 이 존재한다

`spec/` 는 developer 쓰기 권한 밖이다. 그러니 **"구현은 끝났는데 spec 표가 아직 stale"** 은
정상적인 중간 상태인데, 현재 규약대로면 impl-done 이 매번 CRITICAL 을 내고 push 가 막힌다.
planner 턴을 기다리지 않으면 PR 을 올릴 수 없다.

이번엔 summary 가 재량으로 하향해 진행됐지만, 그건 규약 위반이고 다음에 같은 판단이 나온다는
보장도 없다. 즉 **결과가 에이전트의 그때그때 재량에 달려 있다** — 게이트로서 가장 나쁜 성질이다.

## 선택지

- [ ] **(a) 하향 허용 조건 명문화** — "근본 원인이 호출자 권한 밖이고 위임 문서에 명시적으로
      추적되고 있으면 WARNING 으로 통합 가능. 단 원 판정과 재분류 근거를 표에 보존한다."
      (이번 summary 가 실제로 한 일이 정확히 이것이므로, 관행을 규약으로 승격하는 셈)
- [ ] **(b) 하향 금지 + 별도 축 신설** — checker 가 "developer 권한 밖" 을 별도 등급으로 내고
      게이트는 그 등급을 BLOCK 사유에서 제외.
- [ ] **(c) 현상 유지** — 그러면 이런 PR 은 planner 턴 없이는 못 올린다는 사실을 규약에 명시해야
      한다(지금은 어디에도 안 적혀 있다).

## Rationale

**왜 P2.** 활성 우회가 아니다 — 오히려 게이트가 **더 자주 막는** 방향의 갭이다. 다만 규약 위반으로만
진행되는 상태가 반복되면 그 위반이 관행이 되고, 그때는 진짜 Critical 도 하향될 여지가 생긴다.

**왜 developer 가 규약을 못 고치나.** `.claude/agents/**` 는 리뷰어·harness 정의 영역이고,
리뷰어 자신도 "리뷰어 권한 밖, harness 관리자/project-planner 몫" 으로 지목했다.

## 관련

- 발견 맥락: `plan/in-progress/node-cancellation-residual-signal-propagation.md` commerce 2건
- 위임된 근본 원인: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`

## 관련 관측 — `--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다 (2026-07-26)

출처: `review/consistency/2026/07/26/21_06_23` WARNING 4 + INFO 3 (5 checker 중 **3명**이
독립적으로 같은 근본 원인을 지적).

`--impl-done spec/conventions` 세션인데 실측 `git diff origin/main...HEAD -- spec/conventions`
가 **0건**이었다. 그런데 prompt 의 `## Target 문서` 는 `spec/conventions` **전체 스냅샷**
(Cafe24 카탈로그 대용량 dump 포함)으로 채워졌다. 결과:

- `convention_compliance` · `naming_collision` 은 판정 대상 자체가 없어 BYPASS 처리
- 예산이 무관한 문서로 소진돼, 정작 관련 있는 `node-cancellation.md` 본문이 밀려났다
  (같은 날 `--impl-prep 19_30_39` 에서는 이 때문에 **무관한 cafe24 CRITICAL 이 BLOCK 사유**가 됐다)

즉 이 항목은 downgrade 규칙과 별개의 **scope 산정** 결함이지만, 증상(무관한 발견이 게이트
판정을 좌우)이 겹쳐 같은 plan 에 기록해 둔다.

- [ ] orchestrator 의 `--impl-done`/`--impl-prep` scope 산정이 **그 경로에 실제 diff 가 있는지**
      사전 확인하도록 보강. diff 0건이면 (a) 관련 spec 을 diff 에서 역산하거나 (b) 번들을
      비우고 그 사실을 프롬프트에 명시.
- [ ] target 번들 조립 시 plan frontmatter 의 `spec_impact` 목록을 **folder dump 보다 우선**
      포함(19_30_39 INFO 2 제안). 지금은 알파벳순 폴더 dump 가 예산을 선점한다.
- [ ] **정렬이 사전순이라 두 자리 번호가 한 자리를 앞선다 — natural sort 로 교체**
      (2026-07-28 실측, `review/consistency/2026/07/28/01_26_40` WARNING #6).
      위 "알파벳순 폴더 dump" 를 더 좁혀 진단한 것이다: `"1" < "2" < "4"` 이므로
      `10-*.md`/`11-*.md` 가 `4-execution-engine.md` **앞에** 실려 예산을 소진하고, 정작
      대상 파일이 뒤로 밀려 잘린다. `--impl-done spec/5-system/` 세션에서 **checker 5명
      전원**이 이 문제를 겪고 절대경로 직접 Read 로 우회했다 — 누락된 파일은 하필
      CHANGELOG 가 그 PR 의 SoT 로 지목한 `4-execution-engine.md` 였다.
      파일명 선행 숫자를 정수로 파싱해 정렬할 것.
- [ ] **누락을 관측 가능하게** — 예산 초과로 잘린 파일 목록을 프롬프트에 명시하거나 stderr
      경고. 지금은 checker 가 "그 파일이 번들에 없다" 는 사실 자체를 알 수 없어, 우회하지
      않는 checker 는 **spec 을 안 보고 "위반 없음" 을 반환**한다(조용한 거짓 통과, 로그에
      흔적 없음).
- [ ] 부수 점검 — 생략 목록에 비-경로 문자열(`_selectedPort`/`$trigger`/`$env`) 혼입 경로.

> **검증 주의**: 정렬 함수 단위 테스트만으로는 vacuous 하다(헬퍼 테스트 ≠ 호출부 테스트).
> `spec/5-system/` 처럼 **한 자리·두 자리 번호가 섞인 실제 디렉터리로 번들을 만들어
> `4-execution-engine.md` 가 실제로 포함되는지**를 단언할 것.

> 선행 기록: 메모리 `feedback_impl_done_spec_bundle_bug` (prompt grep 0건이면 오탐 → BYPASS +
> 근거 기록). 그 회피책은 지금도 유효하나, 반복 발생하므로 근본 원인 쪽을 남겨 둔다.

### 같은 PR 안에서 **3회** 재현 (2026-07-27 확정)

`ie-resume-turn-boundary-cancel` 한 PR 에서만 세 번 나왔다 — 우연이 아니라 상시 결함이다.

| 회차 | 세션 | 증상 |
|---|---|---|
| 1 | `consistency/2026/07/26/19_30_39` (`--impl-prep`) | `node-cancellation.md` 본문 누락, cafe24 카탈로그가 예산 선점 → **무관한 CRITICAL 이 BLOCK 사유**가 됨 |
| 2 | `consistency/2026/07/26/21_06_23` (`--impl-done`) | scope 내 실 diff **0건**인데 대용량 번들 적재 → checker 2명 BYPASS |
| 3 | `consistency/2026/07/27/03_35_24` (`--impl-done`) | 또 `node-cancellation.md` 가 "예산 초과로 생략된 파일 46개" 에 포함 → **target 정합 판정이 커버리지 0 인 채로 내려짐** |
| 4 | `consistency/2026/07/27/09_16_22` (`--spec`) | 가장 밀접한 sibling plan 2건(`node-cancellation-residual-signal-propagation.md`, `ie-resume-turn-boundary-cancel.md`)이 또 예산 초과로 생략 — plan_coherence 가 직접 지적 |

3회차 plan_coherence 가 이 메타 위험을 스스로 지적했다: *"이번 회차의 'node-cancellation.md
대상 정합 확인 없음'을 미검증으로 취급"*. 즉 **BLOCK: NO 가 '검증했고 문제없음' 이 아니라
'검증 대상이 프롬프트에 없었음' 일 수 있다** — 게이트 신뢰도에 직접 영향.

- [ ] 이 항목은 plan 갱신이 아니라 **harness 코드 수정**이 해법이다(3회차 권장사항 2).
      `spec_impact` 우선 번들링을 구현할 것.
