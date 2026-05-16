# Plan 정합성 Review

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/4-integration.md`
Target plan: `plan/in-progress/integration-attention-filter.md` (worktree: `integration-attention-filter-053b74`)

---

### 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` 를 동시에 수정하는 다른 활성 plan 다수 존재
  - target 위치: `integration-attention-filter.md` §"Spec 갱신" — §2.1, §2.3, §2.4 수정 예정
  - 관련 plan:
    - `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — §11 (만료 스캐너) 갱신 항목 3개 미완료 (`[ ]`)
    - `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — §3.2, §4.4, §6, §9, §10.2, Rationale 갱신 항목 미완료 (`[ ]`)
    - `plan/in-progress/cafe24-pending-polish.md` (worktree: `cafe24-pending-polish-7fdb7e`) — §9.2/§9.4/§9.8/§2.4 갱신 항목 미완료 (`[ ]`)
  - 상세: 위 세 plan 은 모두 `spec/2-navigation/4-integration.md` 의 서로 다른 절을 수정 예정이며 아직 미완 상태다. `integration-attention-filter` 가 같은 파일의 §2.1, §2.3, §2.4 를 동시에 개정하면 이들 worktree 가 PR merge 시 conflict 를 발생시킬 가능성이 있다. 특히 `cafe24-pending-polish` 의 §2.4 갱신 미완 항목은 target plan 의 §2.4 배너 명세 변경과 동일 절을 건드린다.
  - 제안: 착수 전에 위 세 plan 의 진행 상태를 확인하고, 이미 merge 된 worktree 라면 해당 plan 을 `complete/` 로 이동한다. 아직 진행 중이라면 spec 수정 순서를 직렬화하거나, 각 plan 의 `worktree` 담당자와 수정 절(section)이 겹치지 않도록 명시적으로 조율한 뒤 착수한다.

- **[WARNING]** `spec/2-navigation/4-integration.md` §2.4 가 미결 상태로 충돌 가능
  - target 위치: `integration-attention-filter.md` §"Spec 갱신" — §2.4 배너 동작 명세
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` §"남은 작업" item `[ ] spec 갱신 적용 완료 (spec/2-navigation/4-integration.md §9.2/§9.4/§9.8/§2.4…)` (worktree: `cafe24-pending-polish-7fdb7e`)
  - 상세: `cafe24-pending-polish` plan 은 §2.4 의 배너/필터 동작을 pending_install / callback 실패 정책 관점에서 수정하는 항목을 미완으로 보유하고 있다. `integration-attention-filter` 는 동일한 §2.4 를 `attention` 합집합 필터 동작 관점에서 개정한다. 두 개정이 동시에 진행되면 spec 내용이 혼합되거나 한쪽이 다른 쪽의 갱신을 덮어쓸 수 있다.
  - 제안: `cafe24-pending-polish` 의 §2.4 관련 항목이 실제로 미완인지, 아니면 이미 처리된 내용인지 확인 후 plan 상태를 정리한다. 처리 완료라면 체크박스를 갱신하고 `complete/` 로 이동한다.

- **[WARNING]** target plan 에 frontmatter `worktree` 필드는 있으나, spec 갱신을 "project-planner 위임 예정" 으로만 처리하고 별도 plan 신설 없음
  - target 위치: `integration-attention-filter.md` §"Spec 갱신 (project-planner 위임 예정)"
  - 관련 plan: 해당 없음 (신설 plan 없음)
  - 상세: spec 갱신은 project-planner 의 쓰기 권한 영역이고, 구현 plan 과 별도 worktree 에서 진행하는 것이 프로젝트 규약이다. 현재 target plan 은 spec 갱신을 한 줄 메모로 위임만 선언하고, 별도 plan/worktree 를 신설하지 않았다. 구현이 spec 개정보다 먼저 착수되면 spec 과 코드가 일시적으로 불일치한다. (CLAUDE.md: "plan 은 spec 갱신까지 정식 phase 로 포함, 외부 위임 한 줄로 묶지 말 것" 메모리 항목 참고)
  - 제안: spec 갱신을 위한 별도 plan 항목(또는 별도 plan 파일)을 신설하고, project-planner worktree 에서 spec 수정 후 `/consistency-check --spec` 을 통과하면 구현 착수 순서로 직렬화한다.

- **[INFO]** `spec/2-navigation/4-integration.md` 의 target 내용이 비어 있음 (orchestrator payload 에 `(없음)` 표기)
  - target 위치: prompt_file 의 "Target 문서" 블록
  - 관련 plan: 해당 없음
  - 상세: orchestrator 가 수집한 target spec 파일 내용이 `(없음)` 으로 표기되어 있다. 파일 자체는 존재하나 diff 범위에 포함되지 않은 것으로 보인다 (구현 착수 전이므로 아직 수정되지 않은 상태). plan 과의 정합성은 plan 문서 기반으로 분석하였다.
  - 제안: 추가 조치 불필요. 구현 착수 후 spec 갱신이 진행될 때 다시 `--spec` 모드로 검토한다.

- **[INFO]** `cafe24-node-resource-operation-ux.md` 가 `spec/2-navigation/4-integration.md` 수정 중인 `cafe24-spec-sync-e2a8b9` worktree 를 위험 요소로 명시
  - target 위치: `cafe24-node-resource-operation-ux.md` 의존성·리스크 절
  - 관련 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md`
  - 상세: 해당 plan 이 언급한 `cafe24-spec-sync-e2a8b9` worktree 의 현황이 plan 목록에 명확히 반영되어 있지 않다. 이미 merge 완료됐다면 해당 메모를 제거해야 하고, 아직 활성이라면 target plan 과의 충돌 여부를 추가 확인해야 한다.
  - 제안: `cafe24-spec-sync-e2a8b9` worktree 의 상태를 확인하고 plan 메모를 최신화한다.

---

### 요약

`integration-attention-filter` plan 이 수정 예정인 `spec/2-navigation/4-integration.md` §2.1, §2.3, §2.4 는 현재 최소 3개 다른 활성 plan (`spec-update-cafe24-background-refresh`, `spec-update-cafe24-app-url-reuse`, `cafe24-pending-polish`) 이 동시에 미완 상태로 손대고 있는 파일이다. 특히 §2.4 는 `cafe24-pending-polish` 와 직접 겹쳐 content-level 충돌 위험이 있다. 또한 spec 갱신이 "project-planner 위임 예정" 한 줄로 처리되어 별도 plan/phase 로 분리되지 않은 점이 프로젝트 규약(plan 은 spec 갱신까지 정식 phase 로 포함)과 어긋난다. CRITICAL 수준의 결정 우회나 worktree 직접 충돌은 확인되지 않으나, 동시 수정 위험과 spec-갱신 순서 미정이 WARNING 수준의 위험을 형성한다. 착수 전에 타 plan 의 완료 여부를 정리하고 spec 갱신 phase 를 명시적으로 계획한 뒤 순차 진행을 권장한다.

---

### 위험도

MEDIUM
