### 발견사항

- **[INFO]** `spec-update-cafe24-jwt-exp.md` 가 제안하는 spec 변경이 target 에 아직 미반영
  - target 위치: `spec/2-navigation/4-integration.md §5.8` (line ~555), `§10.5` (line ~813), `## Rationale` 섹션 끝
  - 관련 plan: `plan/in-progress/spec-update-cafe24-jwt-exp.md` (worktree: `cafe24-jwt-exp-fix-7a3f1c`) — §1·§2·§3 의 세 변경 제안
  - 상세: `spec-update-cafe24-jwt-exp.md` 는 project-planner 에게 spec 갱신을 위임하는 노트다. 현재 `spec/2-navigation/4-integration.md §5.8` 의 응답 shape 설명은 "JWT exp 우선" precedence 가 아닌 "expires_at ISO 우선" 로 기술돼 있고, §10.5 에 "만료 시각 SoT" bullet 이 없으며, Rationale 에 "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 항이 없다. 구현(`cafe24-jwt-exp-fix.md`)이 spec 보다 선행되는 일시적 드리프트. 본 `--impl-prep` 검토 시점에서 spec 이 구현 의도와 불일치하나 위임 노트가 명시적으로 있어 SDD 순서 위반은 아니다.
  - 제안: project-planner 가 `spec-update-cafe24-jwt-exp.md` 에 기술된 3개 변경 제안을 `spec/2-navigation/4-integration.md` 에 반영한 뒤 developer 의 구현 착수를 허용. 또는 구현과 spec 갱신을 같은 PR 에서 동시 처리할 경우 spec 변경 commit 을 코드 변경보다 먼저 위치시켜 SDD 흔적을 남긴다.

- **[INFO]** `cafe24-backlog-residual.md` F-2 항이 동일 파일 §6 수정을 예고하나 직접 충돌 없음
  - target 위치: `spec/2-navigation/4-integration.md §6` mermaid
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` F-2 항 (worktree: TBD, 착수 전)
  - 상세: F-2 는 §6 mermaid 에 `install_token` 보존 정책 명시를 요청한다. 현재 worktree (`cafe24-jwt-exp-fix-7a3f1c`) 가 제안하는 변경(§5.8·§10.5·Rationale) 과 §6 는 별개 섹션이라 내용 충돌은 없다. F-2 에는 "cafe24-restricted-scopes merge 후 착수" 조건이 이미 기재되어 있다.
  - 제안: 정보 수준. 현재 worktree 착수에 차단 요인 아님. F-2 착수 시 `cafe24-jwt-exp-fix-7a3f1c` 의 변경이 이미 main 에 있어야 하므로 순서만 확인.

- **[INFO]** `cafe24-oauth-invalid-scope-handler.md` 가 §10.4 를 참조하나 현재 worktree와 영역 겹침 없음
  - target 위치: `spec/2-navigation/4-integration.md §10.4`
  - 관련 plan: `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` (worktree: TBD)
  - 상세: 해당 plan 은 §10.4 의 `invalid_scope` backend 처리를 다루며, 현재 worktree 가 다루는 §5.8·§10.5·Rationale 과 다른 섹션. 두 계획이 동일 파일을 touch 하지만 서로 다른 섹션이라 직접 worktree 경합은 없다. 단, 두 worktree 가 같은 파일에 동시 커밋하면 merge conflict 위험이 있으므로 직렬 처리를 권장한다.
  - 제안: 정보 수준. `cafe24-jwt-exp-fix-7a3f1c` 가 먼저 merge 된 후 `cafe24-oauth-invalid-scope-handler` 를 착수하는 순서를 plan 에 명시하면 좋음.

- **[INFO]** `full-review-fixes-a1b2c3` worktree 가 이미 `spec/2-navigation/4-integration.md:951` 을 수정한 기록 (C-15) — branch 는 이미 소멸
  - target 위치: `spec/2-navigation/4-integration.md:951`
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` C-15 항
  - 상세: C-15 는 `:951` 의 앵커를 `§7/#7-allowlist-와의-관계` 로 수정했다. git worktree list 기준 `full-review-fixes-a1b2c3` branch 는 현재 존재하지 않아 해당 변경이 이미 main 에 merge 됐거나 abandoned 된 것으로 보인다. 현재 target spec 의 같은 라인이 갱신돼 있는지 확인이 필요하나, 현재 worktree 의 작업 범위(§5.8·§10.5·Rationale)와 겹치지 않으므로 차단 요인은 아니다.
  - 제안: 정보 수준. `20260516-full-review/RESOLUTION.md` 의 C-15 완료 여부를 확인해 plan 상태를 갱신하면 일관성이 높아진다.

---

### 요약

`spec/2-navigation/4-integration.md` 를 대상으로 한 이번 `--impl-prep` 검토에서 CRITICAL 또는 WARNING 수준의 plan 정합성 문제는 발견되지 않았다. 현재 worktree(`cafe24-jwt-exp-fix-7a3f1c`)가 제안하는 spec 변경(§5.8 응답 shape, §10.5 만료 SoT bullet, Rationale 신규 항)은 동일 파일의 다른 섹션을 다루는 `cafe24-backlog-residual.md` F-2, `cafe24-oauth-invalid-scope-handler.md` 와 직접 충돌하지 않는다. 주의할 점은 `spec-update-cafe24-jwt-exp.md` 가 project-planner 위임을 명시적으로 기재한 spec 갱신 노트이므로, 구현과 spec 변경을 같은 PR 에 묶거나 spec 변경이 선행돼야 SDD 순서가 보존된다는 것이다. `integration-token-ui-autorefresh` plan 은 이미 `plan/complete/` 에 이동돼 있어 해당 plan 이 완료됐음을 확인했다. 전반적으로 이 worktree 의 구현 착수는 진행 가능하나 spec 선행 갱신 또는 동시 처리 여부를 project-planner 와 협의하는 것이 권장된다.

### 위험도

LOW
