# Plan 정합성 Review

대상 plan: `plan/in-progress/spec-draft-cafe24-private-followup.md`  
worktree: `spec-cafe24-private-followup-ae9995`  
대상 spec 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

### 발견 1
- **[INFO]** target plan 의 변경 1 §4.4 내용이 cafe24-request-scopes-ui-b6e34d worktree의 이미 구현된 코드·설계와 정합
  - target 위치: target plan §"변경 1 — §4.4 의 UI 결정 흡수 (consistency I-1, I-2, I-4)"
  - 관련 plan: `plan/in-progress/cafe24-request-scopes-ui.md` (worktree: `cafe24-request-scopes-ui-b6e34d`) 체크리스트 항목 "spec 역반영 follow-up (project-planner 위임): consistency I-1·I-2·I-4"
  - 상세: target plan 의 변경 1 은 cafe24-request-scopes-ui-b6e34d worktree 의 구현이 spec 에 역반영 요청한 follow-up 항목(I-1·I-2·I-4)을 정확히 수행하고 있다. 즉 target plan 은 그 worktree 의 위임을 받아 생성된 정상 흐름이다. 충돌 없음.
  - 제안: 정합성 문제 없음. target plan 완료 후 `cafe24-request-scopes-ui.md` 체크리스트의 해당 항목([ ] spec 역반영 follow-up)을 cross-mark 처리하는 절차가 target plan 체크리스트에 이미 명시되어 있으므로 추가 조치 불필요.

### 발견 2
- **[INFO]** target plan 의 변경 2 (Rationale 보강 — "install_token mismatch 회복 흐름" cross-reference + N≤2 보장 근거 + TOCTOU 부재 명시)가 `spec-update-cafe24-install-recovery.md` 계열과 동일 Rationale 섹션을 다룬다
  - target 위치: target plan §"변경 2 — Rationale 'Cafe24 install_token mismatch 회복 흐름' cross-reference 보강 (consistency W-1)"
  - 관련 plan: `plan/in-progress/spec-update-cafe24-install-recovery.md` (worktree: `cafe24-install-recovery-8b3c4d`) — "후속 작업: spec 갱신 (Rationale 추가)" 항목 미완료
  - 상세: `spec-update-cafe24-install-recovery.md` 의 후속 작업 중 `spec/2-navigation/4-integration.md` Rationale 에 "Cafe24 install_token mismatch 회복 흐름" 항목을 추가하는 작업이 미완료 상태다. target plan 의 변경 2 는 그 Rationale 항이 이미 존재함을 전제로 cross-reference 를 보강하는 작업이다. 따라서 `spec-update-cafe24-install-recovery.md` 의 spec 갱신이 먼저 merge 되거나, 적어도 동일 spec 파일을 두 plan 이 동시에 다루는 상황이다. 두 plan 의 worktree 는 각각 다르므로 파일 내 편집 충돌 위험이 있다. 단, `spec-update-cafe24-install-recovery.md` 는 backend 구현과 같이 묶인 plan 이고, target plan 은 순수 spec 텍스트 보강이므로 실제 변경 위치(Rationale 섹션 내 다른 단락)가 분리될 가능성이 높다. 충돌 가능성은 낮지만 주의가 필요하다.
  - 제안: target plan 수행 시 `spec-update-cafe24-install-recovery.md` 의 Rationale 추가 작업 완료 여부를 먼저 확인한다. 해당 항이 이미 삽입되어 있으면 target plan 의 변경 2 를 그대로 진행하면 된다. 아직 삽입되지 않았다면 target plan 내에서 Rationale 항을 함께 생성하거나, 순서를 직렬화한다.

### 발견 3
- **[INFO]** `spec-update-cafe24-app-url-reuse.md` 가 §4.4 의 request-scopes Private 응답 shape 및 안내 문구를 이미 spec 에 반영했을 수 있으며, target plan 의 변경 1 과 동일 위치를 다룬다
  - target 위치: target plan §"변경 1" (§4.4 `[Request scopes]` 행 교체)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — "영향 받는 spec 섹션: §4.4 (Scope & Permissions 탭의 Request scopes 동작)" 미완료 ("spec 갱신" 체크박스 미체크)
  - 상세: `spec-update-cafe24-app-url-reuse.md` 도 `spec/2-navigation/4-integration.md §4.4` 를 변경 대상으로 명시하고 있으나 "spec 갱신" 체크박스가 미체크다. 현재 §4.4 본문(line 270)을 확인한 결과, cafe24_private_pending 분기 응답 shape 은 이미 기술되어 있고 UI 표현(inline alert, toast, scopesAdded 칩 렌더 등) 은 명시되지 않은 상태다. 따라서 target plan 의 변경 1 은 UI 표현 영역을 보강하는 것이고, spec-update-cafe24-app-url-reuse 의 §4.4 변경은 install_token persistent + post-install 분기 관련이므로 실제 편집 위치는 다를 것으로 보인다. 그러나 두 plan 이 같은 §4.4 를 동시에 수정하는 형태이므로 merge 시 충돌 가능성이 있다.
  - 제안: target plan 의 consistency-check 완료 후 spec 반영 전에 `spec-update-cafe24-app-url-reuse.md` 의 §4.4 갱신이 merge 되었는지 확인한다. 아직 merge 되지 않은 경우, 두 변경을 하나의 PR 로 묶거나 순서를 명시적으로 직렬화한다.

### 발견 4
- **[INFO]** `cafe24-pending-polish-followup.md` 그룹 F §6 "mermaid `install_token` 보존 정책 명시" 항목이 미완료이며 target plan 의 변경 대상 spec 파일과 연관
  - target 위치: target plan § "영향 범위 / 영향받는 다른 spec" — §6 에 변경 없음으로 명시
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F ([ ] §6 mermaid install_token 보존 정책 명시)
  - 상세: target plan 은 §6(상태 전이 mermaid) 을 변경하지 않는다고 명시하고 있다. 그룹 F 의 해당 항목도 독립적으로 진행 가능하므로 target plan 의 작업과 충돌하지 않는다. 다만 target plan 완료 후에도 그룹 F 의 §6 항목이 미완료로 남는 상황이 명확히 인식되어야 한다.
  - 제안: 충돌 없음. 단, target plan 이 spec 역반영을 완료한 뒤 그룹 F 의 §6 항목이 여전히 미완료임을 추적해야 한다. 별도 조치 불필요.

---

## 요약

target plan(`spec-draft-cafe24-private-followup.md`, worktree `spec-cafe24-private-followup-ae9995`)은 `cafe24-request-scopes-ui-b6e34d` worktree 가 developer 로서 명시적으로 위임한 spec 역반영 작업(consistency I-1·I-2·I-4·W-1·W-2)을 project-planner 관점에서 수행하는 정상적인 흐름이다. 미해결 결정을 일방적으로 우회하거나 작업 직렬화 요건을 위반하는 CRITICAL 항목은 발견되지 않았다. 단, `spec/2-navigation/4-integration.md` 를 다루는 진행 중 plan 이 다수(spec-update-cafe24-install-recovery, spec-update-cafe24-app-url-reuse)이므로, 특히 §4.4 와 Rationale 섹션의 동시 편집에 대해 merge 전 순서를 확인하는 절차가 권장된다. 발견된 항목은 모두 추적 메모 수준의 INFO 이며 작업 차단 요인은 없다.

---

## 위험도

LOW
