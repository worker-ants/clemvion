### 발견사항

- **[INFO]** `presentation-button-render-investigation.md` — fix PR 완료 전 미해소 체크박스 잔존
  - target 위치: `button-cap-spec-validator.md` §작업 항목 L77–79 (investigation plan 갱신·complete 이동)
  - 관련 plan: `plan/in-progress/presentation-button-render-investigation.md` L49–79
  - 상세: investigation plan 의 "본 티켓 완료 조건" 에서 "fix 작업이 별도 worktree·PR 로 분리되어 머지됨" 과 "본 plan 의 모든 체크박스가 [x]" 두 항목이 아직 `[ ]` 상태이다. 후보 B(parseButtonConfig URL 필터)·D(output size cap)·E(button id 중복) 의 별 follow-up 체크박스도 미처리인 채 남아 있다. target plan 이 "동일 PR 내 chore commit 으로 complete/ 로 이동" 을 예고하고 있어 현 상태로 진행하면 미체크 체크박스를 남긴 채 complete/ 로 이동되는 PLAN 문서 라이프사이클 규칙(`분류 기준: 미체크 체크박스가 하나라도 있으면 in-progress/`) 위반이 발생한다.
  - 제안: PR merge 시점 이전에 investigation plan 의 B/D/E 항목을 별 follow-up plan 으로 이전하거나 scope-out 주석("본 PR 범위 외 — 별 follow-up plan 으로 분리 예정") 처리하여 체크박스를 모두 해소한 뒤 complete/ 로 이동해야 한다. 또는 각 항목에 별 plan 링크를 달아 명시적으로 분리 예고한다.

- **[INFO]** `node-config-required-defaults-sweep.md` — PR merge 전 미완 체크박스 상태에서 target plan 참조
  - target 위치: `button-cap-spec-validator.md` §관련 문서 L93 "원 sweep plan"
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` L75–77 (`PR 본문 작성`, `/ai-review`, `PR merge` 미완)
  - 상세: sweep plan 이 아직 in-progress (PR merge 전) 이다. target plan 이 sweep plan 을 "원 sweep plan" 으로만 참조할 뿐 의존하지 않으므로 직접 충돌은 없다. 단, sweep plan 의 후속 follow-up 목록(`send-email.to 정준화`, `spec Rationale 공식화` 등)이 presentation 관련 spec 파일(`spec/4-nodes/6-presentation/0-common.md`)에도 영향을 줄 수 있어 선후 순서가 명시되어 있지 않다.
  - 제안: sweep plan 의 후속 follow-up 중 presentation spec 에 영향을 주는 항목이 있는지 재확인하고, 있다면 target plan §관련 문서 또는 sweep plan 의 follow-up 절에 "button-cap-spec-validator 머지 이후 진행" 처리 조건을 명시하면 충분하다.

- **[INFO]** `loop-count-policy.md` 병행 PR — 동일 파일 접촉 없음, 단 관련 commit 정책 확인 권장
  - target 위치: `button-cap-spec-validator.md` §관련 문서 L95 "병행 PR A [loop-count-policy] (PR #192)"
  - 관련 plan: `plan/in-progress/loop-count-policy.md` (PR #192, merge 대기)
  - 상세: target plan 과 loop-count-policy 는 각각 `spec/4-nodes/6-presentation/0-common.md` 와 `spec/4-nodes/1-logic/3-loop.md` 를 수정하므로 파일 충돌 없음. 단 loop-count-policy 의 `node-output.md §9.2` 정합화 후속("loop output.count 3중 문서")이 아직 plan 에 남아 있어 그 후속 PR 이 `spec/4-nodes/6-presentation/0-common.md §9.1/§11` loop 행을 손댈 경우 target plan 이 수정한 동일 파일과 경합할 수 있다. 현재는 후속 PR 이 별도 plan 으로 분리 예고만 되어 있어 즉각적 worktree 충돌은 없다.
  - 제안: loop output.count 후속 plan 신설 시 `spec/4-nodes/6-presentation/0-common.md` 접촉 범위를 frontmatter 로 명시하고 button-cap-spec-validator 의 merge 완료 여부를 선결 조건으로 기록한다.

### 요약

target plan (`button-cap-spec-validator`) 은 사용자 결정(cap 5)과 spec 명문화·backend validator·frontend default 갱신을 명확한 체크리스트로 추적하고 있으며, 다른 in-progress plan 과 직접적인 spec 파일 충돌이나 미해결 결정 우회는 발견되지 않는다. 주요 주의점은 동일 worktree 에서 함께 처리할 예정인 `presentation-button-render-investigation.md` 의 미체크 항목(B/D/E 후속 후보)이 PLAN 라이프사이클 규칙상 complete/ 이동 조건을 충족하지 못한 채 PR merge 가 진행될 수 있다는 점이다. 이 항목들을 별 follow-up plan 으로 명시적으로 분리하거나 scope-out 처리하면 라이프사이클 규칙 위반 없이 진행 가능하다. 나머지 병행 plan 과의 관계는 파일 충돌 리스크가 낮고 정보성 추적에 해당한다.

### 위험도

LOW
