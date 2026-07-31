---
title: consistency-summary 가 Critical 을 하향할 수 있는가 — 규약에 조항이 없다
worktree: harness-review-gate-fixes-1bd6aa
started: 2026-07-25
owner: developer
priority: P2
---

> **2026-07-31 종결** — 두 사안 모두 처리했다. 두 사안은 독립이다: 번들 결함은 "검토 대상이
> 프롬프트에 없었다", 하향 규약은 "발견된 Critical 을 어떻게 처리하나" 이다.
>
> - **부속 관측(번들 예산 결함, 8회 재발)** — **8회 기록된 증상은 닫혔다**: 대상 파일이
>   브랜치-변경(tier 0) 또는 plan-언급(tier 1)이면 이제 항상 예산 앞자리를 받는다.
>   **2026-07-31 잔여분도 종결** — 같은 tier 안의 정렬을 `_natural_key` 로 바꿔, 대상이
>   변경도 안 됐고 plan 에도 언급되지 않은 세션에서 `10-*.md` 가 `4-*.md` 를 앞서던 원래
>   패턴까지 닫았다(실측: `4-execution-engine.md` 가 18개 중 12번째 → 4번째).
>   사전순을 "의도된 동작" 으로 고정하던 `test_ties_stay_alphabetical` 은 반대 단언의
>   `test_ties_use_natural_order_not_lexicographic` 로 교체됐다.
> - **본체 (a)/(b)/(c)** — **사용자 결정: 하향 금지 + planner 즉시 인계** (= (c) 계열이되,
>   "막다른 길" 로 두지 않고 인계 경로를 함께 명문화). 반영 완료:
>   - `.claude/agents/consistency-summary.md` — §요약 지침에 **3. 하향 금지**(상향만 허용) +
>     **4. 권한 밖 Critical 은 planner 즉시 인계** 신설. 출력 형식에 **§planner 인계** 표 추가
>     (등급·BLOCK 은 그대로 유지한 채 *다음 행동*만 지정하는 표임을 명시).
>   - `.claude/skills/consistency-checker/SKILL.md §4 BLOCK 처리` — 하향 금지 사유(게이트가
>     `BLOCK:` 한 줄만 파싱한다)와 인계 경로를 호출자 관점에서 기술.
>
> 설계 노트: 금지만 넣으면 안 된다. 애초에 요약 에이전트가 하향을 **발명한** 이유가 "developer
> 혼자 닫을 수 없는 Critical 에 진행 경로가 없어서" 였다. 막다른 길처럼 보이면 우회가 생기므로
> 금지와 인계를 같은 개정에 넣는다.

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

- [x] ~~**(a) 하향 허용 조건 명문화** — "근본 원인이 호출자 권한 밖이고 위임 문서에 명시적으로
      추적되고 있으면 WARNING 으로 통합 가능. 단 원 판정과 재분류 근거를 표에 보존한다."
      (이번 summary 가 실제로 한 일이 정확히 이것이므로, 관행을 규약으로 승격하는 셈)~~ → **미채택**
- [x] ~~**(b) 하향 금지 + 별도 축 신설** — checker 가 "developer 권한 밖" 을 별도 등급으로 내고
      게이트는 그 등급을 BLOCK 사유에서 제외.~~ → **미채택**
- [x] ~~**(c) 현상 유지** — 그러면 이런 PR 은 planner 턴 없이는 못 올린다는 사실을 규약에 명시해야
      한다(지금은 어디에도 안 적혀 있다).~~ → **채택** (2026-07-31 사용자 결정, 상단 배너 참조).
      단 "막다른 길" 로 두지 않고 planner 인계 경로를 함께 명문화했다.

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
- [x] **정렬이 사전순이라 두 자리 번호가 한 자리를 앞선다 — natural sort 로 교체** ✅ 2026-07-31
      (2026-07-28 실측, `review/consistency/2026/07/28/01_26_40` WARNING #6).
      위 "알파벳순 폴더 dump" 를 더 좁혀 진단한 것이다: `"1" < "2" < "4"` 이므로
      `10-*.md`/`11-*.md` 가 `4-execution-engine.md` **앞에** 실려 예산을 소진하고, 정작
      대상 파일이 뒤로 밀려 잘린다. `--impl-done spec/5-system/` 세션에서 **checker 5명
      전원**이 이 문제를 겪고 절대경로 직접 Read 로 우회했다 — 누락된 파일은 하필
      CHANGELOG 가 그 PR 의 SoT 로 지목한 `4-execution-engine.md` 였다.
      **구현 완료**: `_natural_key` 를 `collect_markdown_files` 와
      `prioritize_bundle_files` 의 tie-break 양쪽에 적용. 실측(`spec/5-system/` 18개):
      `4-execution-engine.md` 가 12번째 → **4번째**. 종전 `test_ties_stay_alphabetical` 이
      사전순을 "의도된 동작" 으로 고정하고 있었어서 그 테스트도 새 계약으로 교체했다.
- [x] **누락을 관측 가능하게** ✅ — 양쪽 orchestrator 모두 구현 완료(consistency: `OMITTED_FILES_HEADING`, code-review: `_omitted_content_note`/`_aggregate_omission_note`). 원문: 예산 초과로 잘린 파일 목록을 프롬프트에 명시하거나 stderr
      경고. 지금은 checker 가 "그 파일이 번들에 없다" 는 사실 자체를 알 수 없어, 우회하지
      않는 checker 는 **spec 을 안 보고 "위반 없음" 을 반환**한다(조용한 거짓 통과, 로그에
      흔적 없음).
- [x] ~~부수 점검 —~~ **근본 결함이었다, 수정 완료 (2026-07-31)**. 생략 목록의
      `_selectedPort`/`$trigger`/`$env` 는 `5-expression-language.md` 의 실제 레벨-4 헤딩이고,
      splitter 가 그걸 **파일 경계로 오인**했다. 개수 오류(21 vs 실제 18)는 눈에 보이는 절반이고,
      위험한 절반은 **한 파일이 여러 조각으로 쪼개져** "파일 단위로 버린다" 는 보장이 깨진 것.
      본문이 만들 수 없는 sentinel 로 경계 이전. **2R 에서 진입점이 2곳이 아니라 4곳임이
      드러나 확장**했다 — `format_file_bundle` · `extract_rationale_sections` 외에
      `--spec`/`--plan` 의 원시 `target_doc` 읽기와 `--impl-done` 의 diff 섹션도 같은 경로다.
      diff 는 자기 경계가 없어 마지막 spec 청크에 얹혀 **이름 없이** 버려지던 별개 결함도 함께
      수정(고유 경계 + 이름 부여).

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

- [x] **구현 완료 (2026-07-31)** — `prioritize_bundle_files` 신설. 번들을 4계층으로 재배열한다
      (버리지 않는다 — 버리는 건 여전히 `truncate_file_bundle` 이고 생략 목록도 그쪽이 남긴다):
      **0** 이 브랜치가 변경한 파일 → **1** in-progress plan 이 이름으로 언급한 파일 →
      **2** 나머지 → **3** `*-api-catalog/**` 자동생성 대량 문서.
      계층 1이 `--impl-prep` 을 담당한다 — 착수 전이라 spec 이 아직 안 고쳐져 있어 계층 0이
      비고, plan 언급이 유일한 신호다. `spec_impact` frontmatter 대신 plan 본문 언급을 쓴 이유는
      새 의존성 없이 같은 모듈 안에서 해결되고, `spec_impact` 미기재 plan 도 커버하기 때문.
      적용 지점: `--impl-prep`/`--impl-done` 의 scope 번들 + `related_specs` + `conventions`.
      테스트 `test_consistency_bundle_priority.py` 18건 + mutation 6종 RED (라운드마다 증가 — 정확한 수는 파일이 SoT).

> 검증 교훈: 첫 seam 테스트가 **vacuous** 했다. `prioritize_bundle_files` 의 **호출 횟수**를
> 셌는데, 호출부 pass-through 뮤턴트(`… = prioritize_bundle_files(...) and scope_files`)는
> 호출을 그대로 두고 **반환값만 버린다** → 스파이는 GREEN. 실제로 두 호출부 뮤턴트가 모두
> 미검출이었다. 스파이가 sentinel 순서를 강제하고 산출물이 그 순서로 렌더되는지(=효과) 단언하도록
> 바꾼 뒤에야 RED. **헬퍼 테스트 ≠ 호출부 테스트이고, 호출 여부 ≠ 결과 사용 여부다.**

### 재발 관측 (2026-07-28) — 6번째

`--impl-prep spec/5-system/` (`review/consistency/2026/07/28/17_21_27`) 에서 정작 작업 대상인
`4-execution-engine.md` 가 **5개 checker 중 4개의 프롬프트에서 생략**됐다(알파벳순으로
`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md` 3개만 실려 예산 소진). 3개 checker 가
브랜치명·plan 을 단서로 직접 Read 해 보완했고 **그 보완에서 CRITICAL #2 가 나왔다** — 즉
우회하지 않았다면 실제 작업 대상의 CRITICAL 을 통째로 놓쳤을 것이다.

부수 확인: `--impl-prep` 는 **디렉터리 단위 scope 만** 받는다(`--impl-prep <파일>.md` 는 usage
에러). 그래서 무관한 같은-영역 결함(이번엔 auth RBAC·graph-rag 명명)이 함께 차단 사유가 되어
착수 전 게이트가 별 PR 을 강제한다. natural sort 만으로는 이 문제가 안 풀리므로, 위
"code diff 매칭 spec 우선 포함" 항목이 근본 대응이다.

### 재발 관측 (2026-07-28, 같은 날 2회차) — 7번째 + 신규 축

`--impl-prep spec/5-system/` (`19_51_18`) 에서 `4-execution-engine.md` 가 **또** 생략됐다
(5개 checker 프롬프트 전원이 `1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md` 3개만 받음).
이번엔 `rationale_continuity` **하나만** 프롬프트 지시를 따라 직접 Read 해 CRITICAL 을 발견했고,
`cross_spec`/`convention_compliance`/`naming_collision` 3개는 **그 영역을 전혀 검토하지 못했다.**
즉 "checker 가 알아서 우회한다" 는 완화책은 **checker 마다 불균등**하다 — 지시를 따르지 않는
실행에서는 false negative 다.

**신규 축 (convention_compliance WARNING #4)**: `convention_compliance` 프롬프트의 "정식 규약
모음" 번들이 `spec/conventions/cafe24-api-catalog/**` 하위 **자동생성 필드별 참조 문서 약 230개**
로 먼저 채워져, target 이 실제로 인용하는 상위 규약 문서(`error-codes.md`/`node-output.md`/
`swagger.md`/`secret-store.md`/`migrations.md`/`execution-context.md` 등) 전량이 예산 밖으로
밀려났다. `spec-impl-evidence.md` 자신이 그 카탈로그를 "정식 spec 아님" 으로 명시하는데도
우선 적재된다.

- [x] **구현 완료 (2026-07-31)** — 카탈로그성 대량 문서를 계층 3(최후순위)으로 강등.
      경로 세그먼트(`*-api-catalog/`)로 매칭하므로 카탈로그가 이동·추가돼도 코드 변경 없이
      강등을 상속한다. plan 이 카탈로그 페이지를 언급해도 계층 1로 끌어올려지지 않는다
      (언급 하나가 덤프 전체를 앞으로 끌고 오면 안 되므로 강등이 우선) — 그 반대 방향도
      테스트로 고정.
