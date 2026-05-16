### 발견사항

- **[INFO]** `spec-update-cafe24-app-url-reuse.md` 의 미완료 spec 갱신 항목과 target 이 같은 spec 파일 수정
  - target 위치: target plan 전체 (`변경 1`, `변경 2`) — `spec/4-nodes/4-integration/4-cafe24.md` §9.8 및 CHANGELOG
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` — "영향 받는 spec 섹션" 항목 중 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 의 install_token 소거 표기 갱신 (`- [ ] spec 갱신`) 이 미체크 상태
  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 worktree(`cafe24-app-url-reuse-f9a2e3`)는 현재 실제로 존재하지 않는다(`.claude/worktrees/` 확인 결과 없음). 해당 plan 의 spec 갱신 체크박스 `[ ] spec 갱신` 는 미완료 상태이며 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 를 대상으로 한다. target plan 은 같은 파일의 §9.8 을 수정하므로 섹션이 달라 직접 충돌은 없으나, 해당 plan 의 미완 spec 갱신이 target과 같은 CHANGELOG(`§10`) 에도 연관될 수 있다. worktree 가 소멸한 plan 의 미완 spec 갱신이 처리되기 전에 target이 같은 파일을 수정하는 것이므로 순서 문제로 기록.
  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 미완 `[ ] spec 갱신` 항목이 CHANGELOG 행에도 영향을 주는지 확인. 영향 없다면 INFO로 종결, 영향 있다면 해당 plan을 먼저 완료 후 target을 진행하도록 plan 에 선후관계를 명시.

- **[INFO]** `spec-update-cafe24-background-refresh.md` 의 미완료 spec 갱신이 target 파일과 동일 파일 대상
  - target 위치: target plan `변경 2` — `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 행 추가
  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` — `spec/2-navigation/4-integration.md` §11 수정을 위한 미완 항목 3개 (`[ ] project-planner 진입해 위 4개 항목 작성`, `[ ] /consistency-check --spec 통과 확인`, `[ ] PR merge 시 plan/complete 이동`). 이 plan 의 worktree(`prod-rereview-fix-a7c93f`) 는 현재 존재하지 않음.
  - 상세: `spec-update-cafe24-background-refresh.md` 는 `spec/2-navigation/4-integration.md` 만 수정 대상이고 `spec/4-nodes/4-integration/4-cafe24.md` 는 수정 대상이 아니다. target 이 수정하는 `spec/2-navigation/4-integration.md` (변경 3 — Rationale 신규 항 추가) 와 이 plan이 수정하는 `spec/2-navigation/4-integration.md` §11 은 서로 다른 섹션이라 직접 충돌은 없다. 다만 두 plan 이 동일 파일을 (서로 다른 섹션에서) 동시에 수정 예정이라는 점을 추적용으로 기록.
  - 제안: target 진행 시 `spec/2-navigation/4-integration.md` Rationale 추가 완료 후, `spec-update-cafe24-background-refresh.md` 담당자가 §11 추가 시 동일 파일의 변경 이력이 두 개 PR 로 나뉘어 있음을 인지하도록 해당 plan 에 메모 추가 권장.

- **[INFO]** target plan 의 "테스트 보강" 언급이 별도 개발 plan 에서 처리돼야 하는데 후속 plan 이 없음
  - target 위치: target plan `변경 3` — Rationale 내 "테스트 보강" 문단 ("사용자 실제 URL (`user_name=...%20...` + 실제 timestamp + 실제 hmac) 의 회귀 보호 테스트 추가")
  - 관련 plan: 없음 (현존 plan 중 이 회귀 테스트를 명시적으로 추적하는 항목 없음)
  - 상세: target 이 spec-only draft 이므로 구현 테스트 보강은 후속 `developer` plan 에서 처리해야 하나, 아직 해당 plan 이 존재하지 않는다. spec draft 특성상 구현 plan 이 나중에 만들어지는 것이 자연스럽지만, Rationale 에 테스트 기대사항이 구체적으로 기술되어 있어 구현 착수 시점에 별도 plan 이 필요하다는 점을 추적할 필요가 있다.
  - 제안: target plan 에 "후속 작업 — 구현 plan 필요" 항목으로 "회귀 보호 테스트 (`user_name=%20` 형식 케이스) 추가" 를 명시하거나, 구현 plan 생성 시 이 항목을 반드시 포함하도록 메모.

### 요약

target plan(`spec-draft-cafe24-hmac-raw-fix.md`)은 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 정정과 `spec/2-navigation/4-integration.md` Rationale 추가를 다룬다. 현재 진행 중인 다른 plan 들 중 `spec-update-cafe24-app-url-reuse.md`(worktree 소멸, spec 갱신 미완)와 `spec-update-cafe24-background-refresh.md`(worktree 소멸, 미완료)가 동일 파일을 대상으로 하나, 수정 섹션이 다르고(§9.4 vs §9.8 / §11 vs Rationale) worktree 도 현재 존재하지 않아 병렬 경합 위험은 낮다. `cafe24-node-resource-operation-ux.md`(worktree `cafe24-node-ux-catalog-4b8f2c` 활성)는 `spec/4-nodes/4-integration/4-cafe24.md` §2·§9.3 을 다루며 §9.8 HMAC 영역에는 접근하지 않는다. 미해결 결정을 우회하는 항목이나 CRITICAL 수준의 직접 worktree 충돌은 발견되지 않았다. 발견 사항은 INFO 3건으로, 전체 plan 정합성에 미치는 위험도는 낮다.

### 위험도

LOW
