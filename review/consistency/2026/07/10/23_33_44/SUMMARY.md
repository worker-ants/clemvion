# Consistency Check SUMMARY — `--impl-done`

- **일시**: 2026-07-10 23:33:44
- **모드**: `--impl-done` (developer 가 push 직전 의무 호출)
- **diff**: `origin/main...HEAD` (`5e6f70b76` + `bc1810eb3`)
- **checker**: 5종 직접 Agent fan-out

## BLOCK: NO

Critical 0건.

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| cross-spec | 0 | 0 | 0 |
| rationale-continuity | 0 | 0 | 1 |
| convention-compliance | 0 | 2 | 3 |
| plan-coherence | 0 | 1 | 3 |
| naming-collision | 0 | 0 | 0 |

## checker 가 독립 검증한 사실

- **런타임 무변경**: 타입 주석은 emit 되는 JS 에서 제거됨 (cross-spec).
- **spec 정합**: `spec/data-flow/7-llm-usage.md §1.3` · `spec/5-system/4-execution-engine.md §1.3` 불변식과
  일치. 신규 요구사항 ID / 엔티티 / API **0** (cross-spec).
- **컴파일**: `ai-turn-executor.ts` 기인 tsc 에러 0건 (naming-collision; 잔여 9건은 diff 밖 `.spec.ts` 의
  기존 `TS2352`).
- **RESOLUTION §2 defer 근거가 사실**: `runTurnWithCollectionRetries`(`information-extractor.handler.ts:1019-1145`)
  가 루프 전체에서 `params.llmContext` 동일 참조를 재대입 없이 넘기고 `traceChat`(`:1881-1899`) 도 가공 없이
  전달 → "역방향 회귀 발생 경로 없음" 확인 (rationale-continuity).
- **주석의 TS 의미론 주장을 `tsc --strict` 3-케이스로 실증** (rationale-continuity).

## 대응 (3건 전부 fix)

### W (rationale-continuity INFO) — 인라인 주석의 TS 규칙 서술 부정확
"excess-property check 는 fresh object literal 을 **인자로 직접 넘길 때만** 걸린다" 는 서술이,
**주석 붙은 변수 선언**에도 같은 검사가 적용된다는 점을 누락해 논리적으로 불완전했다
(그 문장대로면 이 PR 이 추가하는 주석이 왜 효과가 있는지 설명되지 않는다).
→ **fix**: "object literal 이 타입이 알려진 대상(함수 인자 또는 주석 붙은 변수)에 직접 assign 될 때만 걸린다.
주석 없는 const 는 대상 타입이 없어 리터럴이 그대로 추론되고, 이후 변수로 넘길 땐 freshness 가 사라져
검사되지 않는다" 로 정정.

### W1 (convention-compliance) — RESOLUTION.md 가 SKILL 의 3-헤더 스키마 미준수
developer SKILL `.claude/skills/developer/SKILL.md:113-120` 이 `## 조치 항목` / `## TEST 결과` /
`## 보류·후속 항목` 을 요구한다. 초안은 번호식 자유 서술(`## 1. W1 ...`)이었다.
→ **fix**: RESOLUTION.md 를 해당 스키마로 재작성. `## TEST 결과` 의 e2e 줄도 규정된 4형식 중 "통과" 사용.

### W2 (convention-compliance) — Warning 의 "defer" 가 명시적 예외 카테고리 없이 이뤄짐
checker 스스로 "근거(동시 PR #898 과의 merge 충돌 회피, `--impl-prep` 단계 사전 승인, 명확한 종결 조건)
자체는 상세하고 합리적" 이라 판단. 또 `plan_guard.py` 의 worktree frontmatter 불일치로 이 plan 은
애초에 자동 게이트 대상이 아니다.
→ **처리**: RESOLUTION 재작성으로 defer 가 `## 보류·후속 항목` 아래 정규 위치를 갖게 됐고,
durable 등록(task chip `task_33bc64aa`)이 명시됐다. 추가 조치 불요.

### W (plan-coherence) — 종결 조건이 stale 체크박스 1개를 누락
`plan/in-progress/resume-llm-usage-attribution.md:53` 의 `- [ ] PR (push + gh pr create)` 는 #879 시절부터
남은 미체크이며 그 PR 은 이미 origin/main 에 머지됐다. RESOLUTION 초안의 종결 조건("체크박스 2개")이
이를 놓쳐, 그대로 따르면 `plan-lifecycle.md:68` self-check("모든 체크박스가 `[x]`")를 통과하지 못한다.
→ **fix**: RESOLUTION §보류·후속 항목 1 의 종결 조건을 **체크박스 3개**로 정정. task chip 프롬프트에도 반영
(기존 chip `task_e03a0b87` 은 dismiss, `task_33bc64aa` 로 대체).

## Info (조치 불요)

- plan frontmatter `worktree: elastic-shannon-e52824` 가 현재 worktree 와 불일치 → `plan_guard.py:206-224,291-314`
  가 이 plan 을 "연결된 plan" 으로 인지하지 않는다. **gate 우회가 아니라 gate 미작동** 상태
  (`plan-lifecycle.md:34` 의 "연결된 plan 없는 작업은 차단되지 않는다" 케이스).
- 다른 `plan/in-progress/**` 와의 신규 충돌 없음.
- 신규 fixture id / 테스트 제목 / review 경로 충돌 없음.

## 후속

주석 문구 정정(코드 1건, 런타임 무영향) 이후 **fresh `/ai-review`** 를 재실행해 clean 을 확인한다
(comment-only 편집도 리뷰를 재트리거한다는 저장소 경험칙).
