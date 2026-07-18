# Plan 정합성 검토 — plan_coherence

## 사전 노트 — target 페이로드 재확인 방법

전달된 "Target 문서" 페이로드는 `spec/conventions/audit-actions.md` +
`spec/conventions/cafe24-api-catalog/**` 전체 덤프였다. 실 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/interaction-type-guard-followup-bd683a`)에서
`git diff origin/main -- spec/conventions/` 를 직접 실행해 확인한 결과 **이번 세션에서
`spec/conventions/` 는 전혀 변경되지 않았다** — payload 는 기존에 이미 등재된 harness 결함
(`interaction-type-guard-comment-false-negative.md` L135-144 "[harness, 비차단]" 항목,
`review/consistency/2026/07/18/12_04_53/SUMMARY.md` WARNING #1 로 이미 심각도 격상 기록됨)의
재현이다 — alphabetic 순회 중 `cafe24-api-catalog/**`(222개 field 파일)에 예산이 소진돼 실
target(`spec/conventions/interaction-type-registry.md`, 무변경 확인됨)이 완전히 치환됐다.

실제 diff 를 확인하기 위해 `git merge-base HEAD origin/main`(`22cc48ef3`)을 계산했다 — `origin/main`
이 이 세션의 fork-point 이후 별도 커밋(`d25f552b2`, PR #978, 병렬 세션)을 하나 더 얹어 fork-point
보다 앞서 있어 `git diff origin/main` 이 그 병렬 커밋을 "이 브랜치가 삭제한 것"처럼 reverse-diff
오염을 일으켰다(plan 자체가 "harness 항목" 으로 이미 아는 패턴). 이 병렬 세션과의 충돌은 검토
대상이 아니므로(worktree/branch 동시 작업), `merge-base` 기준 실 diff 만 아래 분석에 사용했다:

- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (JSDoc "grep 가드"→"AST 가드" 3곳)
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (self-test fixture 보강)
- `plan/in-progress/interaction-type-guard-comment-false-negative.md` (체크박스 갱신 + 해소 근거)
- `review/consistency/2026/07/18/12_04_53/**` (직전 세션 산출물)

## 발견사항

- **[WARNING]** harness 번들링 결함 후속 항목의 "분기 완료" 주장이 추적 가능한 산출물 없이 종결 처리됨
  - target 위치: `plan/in-progress/interaction-type-guard-comment-false-negative.md` L135-144
    (`- [ ] **[harness, 비차단]**` 항목, 특히 L143-144 "본 항목은 ... **별도 harness task 로 분기**
    (아래 종결 처리 참조) — 이 분기로 본 plan 의 종결 조건을 충족한다")
  - 관련 plan: 같은 문서 자신 + 자매 완료 plan `plan/complete/resumable-handler-generic-typing.md`
    "잔여 후속" 절의 선례("IE `endMultiTurnConversation` errorPayload 미수용 ... → **별도 backlog
    task `task_1844c96b` 로 분기 완료**")
  - 상세: 체크박스는 여전히 `[ ]`(미해소)인 채로, 본문은 "harness 인프라 결함이라 별도 task 로
    분기했고 이것으로 본 plan 의 종결 조건을 충족한다"고 서술한다. 그러나 저장소 전체에서
    이 번들링 결함을 추적하는 신규 plan 파일이나 식별 가능한 task ID 를 찾지 못했다
    (`plan/in-progress/harness-guard-followups.md`, `harness-workflow-contract-fix.md`,
    `harness-push-guard-subcommand-detection.md` 3개 harness plan 모두 `cafe24-api-catalog`/
    `번들`/`target 문서`/`reverse-diff`/`fork-point` 키워드 0건, 최근 mtime 도 이번 세션 커밋과
    무관). 자매 plan(`resumable-handler-generic-typing.md`)이 같은 "분기" 패턴을 쓸 때는
    구체적 `task_xxxxxxxx` 식별자를 남겨 추적 가능하게 했던 것과 대비된다. 현재 상태로는 "분기
    완료"가 검증 불가능한 주장이며, 이 plan 이 (체크박스 미해소로) `in-progress/` 에 남아있는
    한 당장 실질적 피해는 없으나, 향후 누군가 이 서술을 근거로 체크박스를 `[x]` 로 바꾸고 plan 을
    `complete/` 이동시키면 3회째(11_19_02→12_04_53→12_34_30 세션) 재현된 번들링 결함이
    어디에도 추적되지 않은 채 유실된다.
  - 제안: (a) 본 plan L143-144 를 실제 task ID/plan 경로로 구체화하거나, (b) 진짜로 아직
    분기하지 않았다면 "분기 예정" 으로 표현을 낮추고 harness 담당(project-planner/harness
    세션)에게 `plan/in-progress/harness-guard-followups.md` 같은 기존 harness plan 에 항목을
    신설하도록 명시적으로 위임. 번들러 로직 자체는
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 target 파일 선택/
    예산 로직이 실질 수정 지점.

## 참고 (INFO)

- 우발 포함된 target(`spec/conventions/audit-actions.md`, `cafe24-api-catalog/**`) 자체는
  관련 plan(`plan/in-progress/cafe24-backlog-residual.md` G-1~G-4)과 여전히 완전히 정합하며
  이번 세션에서 무변경(직전 12_04_53 세션의 INFO #7 재확인, 신규 충돌 없음).
- 이번 세션의 실 diff(`interaction-type-registry.ts` JSDoc 정정, exhaustiveness self-test fixture
  보강, `(c) .tsx ts.ScriptKind` 분기 명시적 철회)는 `plan/in-progress/
  interaction-type-guard-comment-false-negative.md` 의 "[developer, 선택]" 두 항목(L118, L122)을
  정확히 해소하며, 저장소 어떤 다른 plan/spec 도 `.tsx` 등록 사이트나 `ScriptKind` 분기를
  전제하지 않아(corpus 전수 검색 0건) 철회 결정이 다른 plan 과 충돌하지 않는다.
- `plan/in-progress/eia-context-schema-followups.md` L16 이 `interaction-type-registry.md` 를
  참조하나 완전히 별개(완료된 DTO 경로 정정 각주)라 이번 diff 와 무관.

## 요약

이번 세션의 실질 변경(merge-base 기준: `interaction-type-registry.ts` JSDoc 정정 3곳,
exhaustiveness self-test fixture 보강, `interaction-type-guard-comment-false-negative.md` 체크박스
2건 해소)은 해당 plan 이 명시한 "[developer, 선택]" 후속 항목과 정확히 대응하며, `.tsx` 분기
철회 결정도 다른 plan/spec 어디와도 충돌하지 않는다. 전달된 target 페이로드(`spec/conventions/`
audit-actions·cafe24-api-catalog 덤프)는 이미 3회째 재현된 known 번들링 결함으로 실 target
(`interaction-type-registry.md`, 무변경)을 대체한 것이며 그 자체 내용은 관련 plan 과 여전히
정합. 유일한 신규 발견은 harness 항목의 "분기 완료" 주장이 검증 가능한 산출물(task ID·plan
파일) 없이 남아 있다는 bookkeeping 갭으로, 비차단이지만 plan 종결 시점의 신뢰도를 낮춘다.

## 위험도

LOW
