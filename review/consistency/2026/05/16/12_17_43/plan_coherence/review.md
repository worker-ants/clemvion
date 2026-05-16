# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/2-navigation/4-integration.md`
Worktree: `cafe24-app-url-detail-a7c3f4`

---

### 발견사항

- **[INFO]** `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신이 미완료 상태
  - target 위치: `spec/2-navigation/4-integration.md` §3.2, §4.4, §6, §9, §10.2, Rationale
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — `후속 작업` 체크리스트 `[ ] spec 갱신` 미완료
  - 상세: `spec-update-cafe24-app-url-reuse.md` 는 `install_token persistent` 격상 + `handleInstall` status 분기(connected → frontend redirect, error/expired → frontend redirect) 를 spec 에 반영하도록 요구하고 있으나, 본 계획의 worktree(`cafe24-app-url-detail-a7c3f4`)에서 해당 spec 내용이 이미 갱신 완료되었는지 여부가 plan 에 기록되지 않았다. 다만 `spec/2-navigation/4-integration.md` Rationale 에 이미 2026-05-15 관련 항목이 추가된 정황이 있어 (cafe24-data-model-strengthen 완료 체크), 실제 충돌 가능성은 낮다.
  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신 항목 완료 여부를 확인하고 plan 체크박스를 갱신. 이미 완료됐으면 plan 을 `complete/` 로 이동.

- **[INFO]** `cafe24-pending-polish-followup.md` 의 그룹 F 미완 항목이 동일 spec 파일 대상
  - target 위치: `spec/2-navigation/4-integration.md` §6 mermaid
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` (worktree: `(none — PR #18 머지 후 새 worktree)`) 그룹 F — `[ ] §6 mermaid install_token 보존 정책 명시`
  - 상세: 그룹 F 의 §6 mermaid 항목이 아직 미완료이며, 본 worktree 의 target spec 과 동일 파일이다. 두 작업이 §6 영역을 동시에 변경할 경우 충돌 가능성이 있다. 단, `cafe24-pending-polish-followup.md` 의 `worktree` 필드가 `(none)` 으로 실제 활성 worktree 가 없어 즉각적인 충돌 위험은 낮다.
  - 제안: 본 worktree 의 spec 갱신(`spec-update-cafe24-app-url-detail.md` 위임) 이 §6 을 건드리지 않는지 확인. 건드린다면 `cafe24-pending-polish-followup.md` 그룹 F 의 해당 항목과 조율.

- **[INFO]** `spec-overview-ui-patterns-followup-2026-05-16.md` 가 `spec/2-navigation/4-integration.md §4.2` 를 참조
  - target 위치: `spec/2-navigation/4-integration.md` §4.2
  - 관련 plan: `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` (worktree: `TBD`) — §4.2 누락 scope 배지 항목 언급
  - 상세: `spec-overview-ui-patterns-followup-2026-05-16.md` 는 §4.2 의 inline alert 패턴 표준화를 다루고 있다. 본 target 작업도 §4.2 에 `App URL 카드` 행을 추가한다 (`spec-update-cafe24-app-url-detail.md` 요청 #2). 두 작업이 §4.2 에 각각 독립적인 행을 추가하는 것이라면 충돌은 없으나, 같은 섹션을 편집한다는 점에서 추적이 권장된다. `spec-overview-ui-patterns-followup-2026-05-16.md` 의 `worktree: TBD` 는 아직 실제 worktree 가 없음을 의미한다.
  - 제안: 본 worktree 의 §4.2 변경 후 `spec-overview-ui-patterns-followup-2026-05-16.md` 팀에 §4.2 App URL 카드 추가 사실을 알리고, 나중에 inline alert 패턴 표준화 시 해당 카드도 패턴 참조로 갱신되도록 메모 추가.

- **[INFO]** `cafe24-app-url-3rdparty-shorten.md` 의 Phase 3 PR 생성 미완료 + OAuth 콘솔 재등록 미완료
  - target 위치: 해당 없음 (spec 변경 아님)
  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` (worktree: `cafe24-3rdparty-url-503aa0`) — `[ ] PR 생성`, `[ ] OAuth 콘솔 재등록`
  - 상세: `cafe24-app-url-3rdparty-shorten.md` 가 in-progress 상태로, 동일한 `spec/2-navigation/4-integration.md` 를 Phase 1 에서 이미 갱신 완료했다. 해당 plan 은 PR 머지 전 단계이므로, 본 worktree 의 spec 갱신이 같은 파일의 다른 섹션을 건드릴 때 merge conflict 가능성이 존재한다. 다만 `cafe24-3rdparty-url-503aa0` 의 spec 변경은 §9.2, §10.1, 본문 라우트 표기, Rationale 이며, 본 target 은 §4.2, §9.1, Rationale 신규 항 추가 — 중복 구역은 Rationale 뿐이고 항목이 다르므로 실질 충돌 위험은 낮다.
  - 제안: PR 머지 순서를 `cafe24-app-url-3rdparty-shorten.md` → 본 작업 순으로 직렬화하거나, 머지 후 rebase 로 정리.

---

### 요약

Target `spec/2-navigation/4-integration.md` 는 이미 여러 선행 plan (`cafe24-app-url-3rdparty-shorten`, `cafe24-data-model-strengthen`, `cafe24-pending-polish-followup`) 에 의해 단계적으로 갱신되어 왔으며, 본 worktree(`cafe24-app-url-detail-a7c3f4`) 가 준비하는 `spec-update-cafe24-app-url-detail.md` 의 갱신 요청(§4.2 App URL 카드 추가, §9.1 응답 shape 보강, Rationale 신규 항, data-flow Critical 정정)은 기존 plan 들과 영역이 구별되어 CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. 주의가 필요한 사항은 세 가지 INFO 항목으로, (1) `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신 완료 여부 재확인, (2) `cafe24-pending-polish-followup.md` 그룹 F §6 mermaid 항목과의 범위 조율, (3) `spec-overview-ui-patterns-followup-2026-05-16.md` 의 §4.2 병행 편집 인지 수준의 추적이다. 전체적으로 구현 착수를 차단할 수준의 plan 비정합성은 없다.

### 위험도

LOW
