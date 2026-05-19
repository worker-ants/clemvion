### 발견사항

- **[WARNING]** `presentation-button-render-investigation.md` 검증 단계(A~E) 미완료 상태에서 root cause 를 단정하고 fix 착수
  - target 위치: `button-cap-spec-validator.md` §배경 "root cause 후보 2 ← 본 PR 의 즉시 fix 대상 cap" / §작업 항목 전체 `[x]` 처리
  - 관련 plan: `plan/in-progress/presentation-button-render-investigation.md` §다음 검증 단계 A~E — 체크박스 5개 모두 미체크(`[ ]`). plan 완료 조건에 "root cause 가 확정됨" 이 명시되어 있음
  - 상세: `presentation-button-render-investigation.md` 는 root cause 를 "확정 전" 으로 남겨두고 payload/URL/개수/플래그/id 중복 다섯 가지 검증을 후속 단계로 요구한다. target plan 은 이 검증 없이 "후보 2(carousel itemButtons 4개 cap)" 를 즉시 fix 대상으로 확정하고 이미 코드 변경(`[x]`)까지 완료한 것으로 표시되어 있다. 검증 A~E 가 "payload 개수가 다르다" 를 선행 확인하지 않으면 후보 1(URL 필터) 또는 후보 3(1MB cap) 이 실제 원인일 때 cap 상향이 근본 해결이 아닌 부분 완화에 그칠 수 있다.
  - 제안: `presentation-button-render-investigation.md` 의 검증 단계 A~E 결과를 target plan §배경에 명시하거나, investigation plan 의 체크박스를 `[x]` 로 갱신하여 root cause 확정을 공식 기록해야 한다. 그래야 investigation plan 의 완료 조건("root cause 확정됨") 이 충족된다.

- **[WARNING]** `presentation-button-render-investigation.md` worktree 와 target worktree 가 다름에도 investigation plan 이동(complete/) 을 target PR 에 포함
  - target 위치: `button-cap-spec-validator.md` §작업 항목 마지막 — `git mv plan/in-progress/presentation-button-render-investigation.md plan/complete/` (본 PR 머지 시점)
  - 관련 plan: `plan/in-progress/presentation-button-render-investigation.md` frontmatter `worktree: node-config-required-defaults-sweep`
  - 상세: investigation plan 의 frontmatter 는 `worktree: node-config-required-defaults-sweep` 로 선언되어 있다. target plan 의 worktree 는 `button-cap-spec-validator` 이다. 두 worktree 가 동일 파일(`presentation-button-render-investigation.md`)을 서로 다른 branch 에서 각자 수정하거나 이동하면 merge 충돌 또는 이중 이동이 발생할 수 있다. 또한 investigation plan 의 모든 체크박스(A~E)가 미완이므로 CLAUDE.md 의 "미체크 체크박스가 하나라도 있으면 in-progress" 규칙에 따라 complete/ 이동이 아직 불가하다.
  - 제안: target PR 에서 investigation plan 을 complete/ 로 이동하기 전에, (1) 검증 A~E 체크박스를 완료 처리하고, (2) investigation plan 의 frontmatter worktree 를 `button-cap-spec-validator` 로 갱신하거나 이동 책임을 target plan 에 명시적으로 위임하는 기록을 남긴다.

- **[WARNING]** `spec/4-nodes/6-presentation/0-common.md` 를 동시에 손댈 가능성 있는 다른 plan 미확인
  - target 위치: `button-cap-spec-validator.md` §작업 항목 — `spec/4-nodes/6-presentation/0-common.md` §1.1 / §Rationale / §9 CHANGELOG 수정
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` — 같은 파일의 carousel/template/chart/table 필드 메타 관련 sweep 이 진행 중(PR push 미완, `[ ] PR 본문 작성 + push`)이며 worktree 가 `node-config-required-defaults-sweep`
  - 상세: `node-config-required-defaults-sweep` 는 presentation 노드 schema 의 `ui.required` 메타를 다루지만 `0-common.md` §1.1 버튼 cap 수치를 직접 건드리지는 않는다. 그러나 해당 sweep PR 이 아직 merge 되지 않은 상태(`[ ] PR 본문 작성 + push` 미완)이므로, 두 worktree 가 같은 spec 파일을 동시에 수정할 경우 merge 충돌이 발생할 수 있다. sweep plan 의 consistency-check/ai-review 항목도 미완이어서 main 에 아직 반영되지 않은 상태다.
  - 제안: `node-config-required-defaults-sweep` PR 이 main 에 merge 된 이후 target branch 를 rebase 하거나, 두 plan 이 건드리는 `0-common.md` 의 섹션이 충돌하지 않음을 명시적으로 확인·기록한다. target plan §관련 문서에 sweep plan 의 merge 선행 권장 여부를 기록한다.

- **[INFO]** `node-config-required-defaults-sweep.md` 후속 follow-up 에 버튼 cap 정책 관련 항목 미기록
  - target 위치: `button-cap-spec-validator.md` §관련 문서 "원 sweep plan: node-config-required-defaults-sweep"
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` §후속 follow-up — 버튼 cap 변경(10→5) 및 validator 추가가 sweep 의 직접 파생 작업임에도 follow-up 목록에 미등재
  - 상세: sweep plan 의 §후속 follow-up 목록은 loop, send-email, variable-modification 등 여러 항목을 추적하지만 버튼 cap 정책 명문화·backend validator 추가는 별 plan(`button-cap-spec-validator`)으로 분리됐음을 링크로만 참조하지 않는다. sweep plan 을 읽는 사람이 연관 작업을 한눈에 파악하기 어렵다.
  - 제안: sweep plan §후속 follow-up 에 "버튼 cap 정책 → `button-cap-spec-validator` plan 으로 분리" 한 줄을 추가하면 인덱스 일관성이 유지된다.

- **[INFO]** `loop-count-policy.md` 와 `button-cap-spec-validator.md` 가 동시 진행 — 병렬 PR 의 merge 순서 미명시
  - target 위치: `button-cap-spec-validator.md` §관련 문서 "병행 PR: A loop-count-policy (PR #192)"
  - 관련 plan: `plan/in-progress/loop-count-policy.md` — `[ ] PR merge (#192)` 미완
  - 상세: target plan 이 loop-count-policy 를 "병행 PR" 로 인식하고 있으며, 두 plan 이 건드리는 파일 집합은 분리되어 있어 직접 충돌 위험은 낮다. 그러나 두 PR 의 merge 순서가 미명시이며, 양쪽 모두 `spec/4-nodes/` 하위 파일을 수정하므로 하나가 merge 된 뒤 나머지 branch 에서 rebase 가 필요하다는 점이 target plan 에 기록되지 않았다.
  - 제안: target plan §관련 문서에 "loop-count-policy (PR #192) merge 후 rebase 권장" 또는 "순서 무관, rebase 불필요 확인됨" 중 하나를 명시한다.

### 요약

target plan(`button-cap-spec-validator.md`)은 사용자가 결정을 부여한 이후 이미 코드·테스트·spec 변경을 완료(`[x]`)한 상태로 작성되어 있다. 주요 정합성 위험은 두 가지다. 첫째, 선행 investigation plan(`presentation-button-render-investigation.md`)의 root cause 검증 체크박스(A~E)가 여전히 미완인데 target plan 이 후보 2를 확정 fix 한 것으로 처리해 두었다 — investigation plan의 완료 조건("root cause 확정됨")이 아직 충족되지 않은 상태에서 그 plan을 target PR에서 complete/로 이동하려 한다. 둘째, investigation plan의 frontmatter worktree가 `node-config-required-defaults-sweep`으로 남아 있어 target worktree(`button-cap-spec-validator`)와 불일치하며, sweep PR이 아직 merge 전이라 동일 spec 파일(`0-common.md`) 편집 충돌 가능성도 열려 있다. 나머지 항목(sweep follow-up 미기록, loop-count-policy merge 순서 미명시)은 추적 편의 수준의 INFO다.

### 위험도

MEDIUM
