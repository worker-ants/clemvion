# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done, diff-base origin/main)

## 검토 범위 요약

이 브랜치(`claude/cause-comment-crossref`, worktree `eslint10-upgrade-5e3cf9`)의 실제 diff 는
`spec/**` 를 전혀 건드리지 않는다 — 변경은 5개 코드/테스트 파일(`expression-resolver.service.ts`
+spec, `secret-resolver.service.ts`, `code.handler.ts`+spec)의 **주석 정리**와
`plan/in-progress/deps-peer-gating-and-eslint10.md` 본문 갱신(+52줄)뿐이다. 따라서 "target 문서"
(spec/5-system 전체 번들)는 이 diff 로 새로 결정된 것이 없고, 그 결정(§6.3.1 C1 AND C2 기준)은
이미 별도 planner 턴(`#1230`, 커밋 `44346ec81`)으로 origin/main 에 반영되어 있다. 이번 diff 는
그 정본을 가리키도록 인라인 주석 5곳을 정리하고, 직전 리뷰(`review/code/2026/08/29/01_07_51`)가
잡은 Warning 1건(C2 서술에서 "민감" 한정어 탈락)과 이전 라운드의 잘못된 귀속(isolated-vm 자기
realm → 실제는 Jest realm)을 정정한 것이다.

## 발견사항

- **[INFO]** §6.3.1 후속 백로그 2건은 적절히 등재돼 있고 충돌 없음
  - target 위치: `spec/5-system/3-error-handling.md` §6.3.1 (Rationale 포함)
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` §체크리스트 "(후속, INFO)
    `cause` 부착 판단 근거" 항목 하위의 두 `- [ ]`
    (C2 를 단언으로 잠그기 / `cause` 비노출 불변식의 계측 지점 — `GlobalExceptionFilter`)
  - 상세: 이 plan 은 과거 같은 유형의 실수(조건부 처분을 `plan/complete/` 로 봉인해 유실—
    `spec-draft-error-cause-criterion.md` 관련 서술)를 이미 자기 진단하고, 이번엔 후속 항목을
    **같은 in-progress 문서 안에** 남겨 재발을 막았다. developer SKILL §수렴 예외 (a)~(d)
    조건(동작 결함 아님·spec-linked 파일 재검토 비용·근거 기록·해당 턴 등재)도 본문에 명시돼
    있어 임의 유예가 아니라 근거 있는 유예다. target(§6.3.1)이 이 두 항목의 부재를 전제로
    하지 않으며(§6.3.1 자체는 "다운스트림에 `.cause` 소비자가 없다"는 실측을 근거로 들 뿐, 그
    실측을 강제하는 계측 테스트의 존재를 전제하지 않음), 충돌·선행조건 미해소는 없다.
  - 제안: 조치 불필요. 향후 세션이 이 백로그를 소비할 때 같은 문서(§체크리스트, 해당 중첩
    블록)를 계속 SoT 로 유지할 것 — 다른 곳에 재등재하면 오히려 중복 트래킹이 생긴다.

- **[INFO]** `worktree:` frontmatter 가 실제 작업 위치와 다름 (게이트에는 영향 없음, 확인용 기록)
  - target 위치: 해당 없음(target 자체와 무관, plan 프로세스 메타데이터)
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter
    `worktree: spec-small-followups` (2026-08-10 갱신)
  - 상세: 현재 작업은 `eslint10-upgrade-5e3cf9` worktree / `claude/cause-comment-crossref`
    branch 에서 진행 중이라 `.claude/docs/plan-lifecycle.md §3` 의 "연결 판정"(worktree 이름 또는
    `claude/` 뗀 branch 명과 frontmatter `worktree:` 매칭) 기준으로는 이 plan 이 이 worktree 에
    "연결"되지 않는다. 다만 이번 push 는 이 plan 파일을 실제로 수정하므로 push gate 실효에는
    영향이 없다(연결 판정에 실패해도 "연결된 plan 없음 = ad-hoc, 비차단"으로 통과하는 쪽이라
    오히려 더 관대해지는 방향 — 차단 오탐은 아님). 다만 frontmatter 가 실제 작업 위치를
    반영하지 않는 상태로 계속 방치되면, 이 worktree 이름으로 시작되는 **다음** 관련 작업이
    이 plan 과 연결되지 않아 plan 갱신 없이도 push 가 통과할 여지가 생긴다.
  - 제안: CRITICAL/WARNING 은 아니나, 이 plan 을 더 다룰 계획이면 `worktree:` 값을 현재
    작업 위치로 갱신하는 것을 고려. 이번 PR 범위에서 강제할 사항은 아님.

- 그 외 미해결 결정(예: `spec-update-node-cancellation-shutdown-classification.md` 의 (a)/(b)
  택일 — cancelled vs failed 분류)은 execution-engine/노드 취소 분류에 관한 것으로, 이번
  diff(§6.3.1 `cause` 부착 코멘트 정리)와 대상 코드 경로가 겹치지 않는다. 충돌 없음.
  `plan/in-progress/deps-peer-gating-and-eslint10.md` §체크리스트의 "(무관, 이 티켓 밖)"
  CLAUDE.md skill 권한표 항목도 target 과 무관한 별개 결정 사항으로 그대로 열려 있다 — 이번
  diff 가 손대지 않았고 손댈 이유도 없다.

## 요약

이번 diff 는 스코프가 매우 좁다(주석 정리 5곳 + plan 문서 자기 정정). target spec
(`spec/5-system/3-error-handling.md` §6.3.1)은 diff 이전에 이미 별도 planner 턴으로 확정·병합된
정본이며, 이번 코드 변경은 그 정본을 가리키는 인라인 주석을 정리하고 직전 코드 리뷰가 지적한
표현 결함(민감 한정어 탈락)과 실측 오귀속(realm 정정)을 바로잡은 것이다. `plan/in-progress/`
전수를 대조한 결과 이 diff 가 우회하는 "결정 필요" 항목도, 전제하는 미해소 선행 조건도, 무효화될
후속 항목도 발견되지 않았다. 유일하게 등재된 후속 백로그 2건(C2 단언 잠금·cause 비노출 계측
테스트)은 같은 in-progress 문서에 근거와 함께 적절히 남아 있어 유실 위험이 낮다.

## 위험도
NONE
