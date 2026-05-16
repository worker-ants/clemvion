# Plan Coherence Review
# Target: plan/in-progress/cafe24-node-resource-operation-ux.md
# Checker: plan_coherence
# Date: 2026-05-16

---

### 발견사항

---

- **[CRITICAL]** `spec/4-nodes/4-integration/4-cafe24.md` 동시 수정 충돌 — `cafe24-spec-sync-e2a8b9` worktree 와 파일 경합
  - target 위치: Phase 1 체크리스트 `spec/4-nodes/4-integration/4-cafe24.md §9.3 + spec/conventions/cafe24-api-metadata.md §4 — 카탈로그 링크 한 줄씩`
  - 관련 plan: `cafe24-spec-sync-e2a8b9` worktree (branch: `claude/cafe24-spec-sync-e2a8b9`). 해당 worktree 의 `git diff main..HEAD --name-only` 결과에 `spec/4-nodes/4-integration/4-cafe24.md` 가 포함됨. 이 worktree 는 아직 main 에 merge 되지 않은 상태로 동 파일을 수정 중.
  - 상세: 본 target plan 의 Phase 1 은 `spec/4-nodes/4-integration/4-cafe24.md` 에 카탈로그 링크 1줄을 추가하는 작업을 포함한다. `cafe24-spec-sync-e2a8b9` worktree 도 동일 파일을 수정 중이며 아직 merge 되지 않았다. 두 worktree 가 git 수준에서 동일 파일을 변경 중이므로 통합 시 충돌이 발생할 수 있다. CLAUDE.md 정책("같은 `spec/` 파일을 두 worktree 가 동시에 수정 중이면 직렬화")에 해당하는 CRITICAL 케이스.
  - 제안: `cafe24-spec-sync-e2a8b9` 의 PR 이 먼저 merge 된 뒤 본 plan 의 Phase 1 spec 수정 단계를 진행하도록 직렬화한다. 또는 `cafe24-spec-sync-e2a8b9` 를 리베이스한 결과를 본 worktree 에 미리 가져와 충돌을 선해소한 뒤 진행한다. 본 plan 의 `## 위험` 절에 해당 사실을 명기하고, Phase 1 spec 수정 체크박스 앞에 "전제: `cafe24-spec-sync-e2a8b9` merge 완료" 조건을 추가한다.

---

- **[CRITICAL]** `spec/conventions/cafe24-api-metadata.md` 동시 수정 충돌 — `cafe24-spec-sync-e2a8b9` worktree 와 파일 경합
  - target 위치: Phase 1 체크리스트 `spec/conventions/cafe24-api-metadata.md §4 — 카탈로그 링크 한 줄씩`
  - 관련 plan: `cafe24-spec-sync-e2a8b9` worktree (`git diff main..HEAD --name-only` 에 `spec/4-nodes/4-integration/4-cafe24.md` 포함 — 동 worktree 가 수정 중인 spec 그룹에 `cafe24-api-metadata.md` 가 포함될 가능성을 별도로 검증해야 하나, 동 파일이 `4-cafe24.md` 의 상호 참조 대상이고 해당 worktree 의 수정 범위에 들어있을 개연성이 높음). 실제 포함 여부는 `git diff main..HEAD --name-only` 로 재확인 필요.
  - 상세: `cafe24-api-metadata.md` 는 `4-cafe24.md` 와 강하게 결합된 컨벤션 문서이며, 본 plan 이 §4 에 카탈로그 링크를 추가한다. `cafe24-spec-sync-e2a8b9` 의 수정 범위가 이 파일까지 포함한다면 동일한 직렬화 필요. 포함하지 않더라도 §1 CRITICAL 의 `4-cafe24.md` 직렬화가 해소된 이후에 진행하는 것이 안전하다.
  - 제안: §1 의 제안과 동일하게 처리한다. `cafe24-spec-sync-e2a8b9` merge 후 진행.

---

- **[WARNING]** `cafe24-pending-polish-followup.md` 그룹 C 의 `Cafe24Config` 재작성과 Phase 3 의 `Cafe24Config` 재작성 — 동일 컴포넌트 동시 착수 위험
  - target 위치: Phase 3 전체 — `Cafe24Config` 재작성 (resource → op 셀렉트, 동적 fields 폼, 조건부 pagination)
  - 관련 plan: `cafe24-pending-polish-followup.md` 그룹 C: `Cafe24PrivatePendingStep` 커스텀 훅 분리, `isReauthorizeDisabled` 위치 이동, 매직 상수 추출 등 Cafe24 관련 프런트엔드 컴포넌트 리팩토링이 미완료 상태. 동 plan 의 `worktree` frontmatter 는 `(none — PR #18 머지 후 새 worktree 에서 진행)` — 아직 worktree 미할당 상태이므로 실제 파일 수준 경합은 현재 없음.
  - 상세: `cafe24-pending-polish-followup.md` 그룹 C 는 Cafe24 프런트엔드 컴포넌트(Cafe24PrivatePendingStep, integration-configs.tsx 내 관련 유틸) 리팩토링을 남겨두고 있다. 본 plan 의 Phase 3 는 `integration-configs.tsx:298` 의 `Cafe24Config` 를 재작성한다. 두 작업이 같은 파일(`integration-configs.tsx`) 또는 인접 파일을 편집하게 되면 충돌이 발생할 수 있다. 현재 follow-up plan 의 worktree 가 없으므로 즉각적인 git 충돌은 없으나, 실제 작업이 겹치는 시점에는 직렬화 필요.
  - 제안: Phase 3 착수 직전 `cafe24-pending-polish-followup.md` 그룹 C 의 진행 상황을 재확인한다. 그룹 C 항목이 먼저 완료되거나 별 worktree 에 할당되어 있지 않다면 Phase 3 를 진행해도 무방하다. 본 plan 의 `## 위험` 절에 이 점을 추가한다.

---

- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` 의 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 수정 항목 — 선행 미해소 상태에서 본 plan 이 동 파일을 수정함
  - target 위치: Phase 1 체크리스트 `spec/4-nodes/4-integration/4-cafe24.md §9.3`
  - 관련 plan: `spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — "영향 받는 spec 섹션" 에 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 의 `install_token 소거 표기 갱신` 이 아직 `[ ]` (미완) 상태.
  - 상세: `spec-update-cafe24-app-url-reuse.md` 는 `4-cafe24.md §9.4` 를 수정하는 작업을 남겨두고 있으나 해당 worktree(`cafe24-app-url-reuse-f9a2e3`) 의 실제 commit 에 이 변경이 포함되어 있는지 확인이 필요하다. 본 plan 이 §9.3 을 수정하면서 §9.4 가 아직 구 버전(install_token 소거 표기) 상태인 채로 merge 되면 동 파일 내에서 §9.3(카탈로그 링크 신규 추가)과 §9.4(install_token 정책 outdated) 사이의 정합성이 깨진다.
  - 제안: Phase 1 착수 전 `spec-update-cafe24-app-url-reuse.md` 의 `4-cafe24.md §9.4` 수정이 완료되었는지 확인한다. 완료되지 않았다면 해당 변경이 merge 된 뒤 Phase 1 을 진행하거나, 본 PR 에서 §9.4 도 함께 반영하여 단일 PR 로 일관성을 유지한다. 본 plan 의 `## 후속` 절에 이미 언급되어 있으나 Phase 1 의 전제 조건으로 격상시키는 것이 바람직하다.

---

- **[WARNING]** `NodeDefinitionResponse.extras` 신규 필드 — `cafe24-data-model-strengthen.md` 의 `Cafe24OperationMetadata.toPublicOperationMeta()` 선행 필요 여부 불명확
  - target 위치: Phase 2 — `NodeDefinitionResponse.extras?: Record<string, unknown>` 신규 옵셔널 필드 + `cafe24NodeMetadata.extras`
  - 관련 plan: `cafe24-data-model-strengthen.md` (worktree: `cafe24-data-model-strengthen-464de9`) — 모든 체크박스 완료 상태. 다만 해당 plan 이 "사용자 결정 2 (install_token → short-lived JWT) 는 다음 별도 PR 로 분리" 를 언급하고 있어, 잠재적으로 Node metadata API 의 `extras` 계약과 충돌하는 변경이 후속에 올 가능성 존재.
  - 상세: `cafe24-data-model-strengthen.md` 는 모두 완료되었으나, 분리된 "사용자 결정 2" PR 이 `NodeDefinitionResponse` 또는 `cafe24NodeMetadata` 를 동시에 수정할 경우 Phase 2 의 `extras` 신규 필드와 충돌할 수 있다. 현재 해당 plan 이 없어 직접적인 conflict 는 없으나 향후 추적이 필요하다.
  - 제안: Phase 2 착수 전 "사용자 결정 2" plan 이 생성되었는지 확인하고, 생성된 경우 `NodeDefinitionResponse` 수정 범위를 조율한다. 본 plan 의 `## 위험` 절에 추가한다.

---

- **[INFO]** `cafe24-pending-polish.md` 변경 1~5 의 대부분 항목 미완료 — Phase 3 의 `Cafe24Config` 재작성과 내용 범위 부분 중복 가능성
  - target 위치: Phase 3 — `Cafe24Config.test.tsx` 추가, 표현식 입력 보존
  - 관련 plan: `cafe24-pending-polish.md` 변경 1 (FE: pending step 폴링 + 목록 갱신 정책) 미완. 해당 plan 의 worktree `cafe24-pending-polish-7fdb7e` 는 "PR #18 머지 대기 → complete 이동 예정" 상태로 기술되어 있어 현재 활성 worktree 가 아닐 가능성이 높음.
  - 상세: `cafe24-pending-polish.md` 의 변경 1 은 `Cafe24PrivatePendingStep` 의 FE 상태 변경(reauthorize 비활성, appType 필드)을 포함하며, 본 plan Phase 3 의 `Cafe24Config` 재작성과 동일 파일(integration-configs.tsx 또는 인접) 을 건드릴 수 있다. 그러나 해당 plan 의 worktree 가 "PR #18 머지 후 complete 이동" 상태이므로 실제 활성 worktree 충돌은 낮다.
  - 제안: Phase 3 착수 시 `cafe24-pending-polish.md` 가 `plan/complete/` 로 이동됐는지 확인한다. 이동되지 않았다면 미완 항목이 Phase 3 와 겹치는지 재검토한다.

---

- **[INFO]** `spec-update-cafe24-fields-ui-buffer.md` 의 `spec/4-nodes/4-integration/4-cafe24.md §2` 수정 — 본 plan Phase 1 과 같은 §2 섹션 접촉
  - target 위치: Phase 1 체크리스트 `spec/4-nodes/4-integration/4-cafe24.md §9.3`
  - 관련 plan: `spec-update-cafe24-fields-ui-buffer.md` (worktree: `(none — project-planner 진입 시 새 worktree)`) — `4-cafe24.md §2` 또는 §9 에 한 줄 추가하는 작업이 `[ ]` 미완.
  - 상세: 본 plan 이 §9.3 을 수정하고, `spec-update-cafe24-fields-ui-buffer.md` 가 §2 또는 §9 를 수정한다. 같은 파일 내 다른 섹션이므로 git merge 충돌 확률은 낮으나, §9 Rationale 을 동시에 건드리면 충돌 가능성 있음. 해당 plan 은 worktree 미할당 상태라 즉각적 위험은 없음.
  - 제안: `spec-update-cafe24-fields-ui-buffer.md` 의 worktree 할당 전에 본 plan 의 Phase 1 이 먼저 merge 되거나, 두 plan 이 같은 worktree 에서 묶여 한 PR 로 처리되는 것이 바람직하다.

---

### 요약

Target plan(`cafe24-node-resource-operation-ux.md`)의 주요 관심사인 `spec/conventions/cafe24-api-catalog/**` (신규 디렉토리) 와 `backend/` Phase 2/3 구현은 기존 in-progress plan 들과 직접 영역 충돌이 없다. 그러나 Phase 1 에서 수정하는 `spec/4-nodes/4-integration/4-cafe24.md` 와 `spec/conventions/cafe24-api-metadata.md` 두 파일을 `cafe24-spec-sync-e2a8b9` worktree 가 현재 동시에 수정 중(미merge)이어서 CRITICAL 수준의 worktree 충돌이 발생한다. 이 충돌은 CLAUDE.md 정책상 직렬화가 요구되므로 Phase 1 의 spec 수정 단계를 `cafe24-spec-sync-e2a8b9` merge 이후로 순서를 지정해야 한다. 나머지 WARNING 두 건(cafe24-pending-polish-followup 그룹 C 와 spec-update-cafe24-app-url-reuse §9.4)은 실제 작업 착수 전 확인하면 해소 가능한 수준이다.

### 위험도

HIGH
