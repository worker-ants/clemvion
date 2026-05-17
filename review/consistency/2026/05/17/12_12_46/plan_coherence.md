### 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` 동시 수정 가능성 — `spec-update-cafe24-test-connection.md` 의 직렬화 조건 충족 여부 불명확
  - target 위치: D5 전체 (`spec/2-navigation/4-integration.md` §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` — 해당 문서 "머지 의존성 — 착수 전 직렬화 필수" 섹션에서 `spec/2-navigation/4-integration.md` 를 동시 수정하는 세 worktree(`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`)가 머지되기 전에는 착수하면 안 된다고 명시하고 있다.
  - 상세: `spec-update-cafe24-test-connection.md` 가 직렬화 선행 조건으로 열거한 세 worktree의 머지 완료 여부를 prompt_file 에서 확인할 수 없다. 이 plan 의 직렬화 조건이 현재 해소되었는지 확인되지 않은 상태에서 target plan(`cafe24-restricted-scopes-a1b2c3`) 도 `spec/2-navigation/4-integration.md` 의 다수 섹션(§3.2·§4.4·§5·§9.4·§10.4·Rationale) 을 수정한다.
  - 제안: target plan 착수 전 `spec-update-cafe24-test-connection.md` 에 명시된 직렬화 조건(3 worktree 머지 여부)이 해소되었는지 확인할 것. 아직 머지되지 않은 worktree가 있다면 해당 PR 머지 후 착수.

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` 수정과 `20260516-full-review/RESOLUTION.md` 의 W-69 처리 후속 가능 드리프트
  - target 위치: D6 전체 (`spec/4-nodes/4-integration/4-cafe24.md` §2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` — W-69 항목: "`spec/4-nodes/4-integration/4-cafe24.md:23,90`의 `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제" 가 full-review-fixes-a1b2c3 worktree 에서 처리됨.
  - 상세: W-69 는 이미 처리 완료로 표시되어 있으나(`full-review-fixes-a1b2c3` branch), 해당 PR 이 main 에 머지되었는지 확인되지 않는다. target plan 이 같은 파일의 §2 와 §8.3 을 수정할 때 W-69 가 포함된 변경이 병합되어 있어야 충돌이 없다. 또한 target plan 이 §2 에 `별도 승인 라벨` 스펙을 추가할 때 cursor 제거 커밋과 충돌이 발생할 수 있다.
  - 제안: `full-review-fixes-a1b2c3` branch(PR)의 main 머지 여부를 확인하고, 미머지라면 해당 PR 이후에 target 을 작성하거나, 동일 파일을 수정할 때 cursor 관련 변경 내용도 반영되어야 함을 plan 에 명시할 것.

- **[WARNING]** `cafe24-backlog-residual.md` — F-2 항목(`spec/2-navigation/4-integration.md §6` mermaid 갱신) 과 target D5 의 §9.4·§10.4 변경이 동일 파일을 건드릴 가능성
  - target 위치: D5.4·D5.5 (`spec/2-navigation/4-integration.md §9.4·§10.4`)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` — F-2: "`spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시" (미완료 `[ ]`)
  - 상세: target plan 은 §9.4·§10.4 를 수정하고, backlog plan 의 F-2 는 §6 을 수정한다. 서로 다른 섹션이므로 직접 충돌은 낮지만, 두 plan 이 같은 파일을 동시에 수정 중임을 양쪽 plan 에 명시해야 한다. `cafe24-backlog-residual.md` 의 worktree 필드가 `TBD` 로 되어 있어 작업이 아직 시작되지 않았을 가능성이 높다.
  - 제안: `cafe24-backlog-residual.md` 의 F-2 착수 시 target plan 과 같은 파일이라는 사실을 worktree 배정 전 확인할 것. target plan 이 먼저 머지된 후 F-2 를 처리하거나, 같은 PR 에 묶는 방안 검토.

- **[WARNING]** `spec-update-impl-prep-findings.md` — C1 항목(`spec/1-data-model.md §2.13` `re_run_of`/`chain_id` 컬럼 추가) 이 미완료 상태로 target plan 의 선행 조건과 무관하나 동시 spec 수정 세션의 혼잡도를 높임
  - target 위치: 해당 없음 (직접 영향 없음)
  - 관련 plan: `plan/in-progress/spec-update-impl-prep-findings.md` — C1·C2 체크박스 미완료. C2 (`spec/5-system/10-graph-rag.md §2.2` `graph_extraction_status` `failed` 추가) 는 `full-review-fixes-a1b2c3` RESOLUTION.md W-15 에서 이미 처리됨으로 표시되어 있어 이중 추적 가능성 있음.
  - 상세: `spec-update-impl-prep-findings.md` C2 항목은 full-review RESOLUTION.md W-15 에서 이미 완료 처리되었으나 spec-update-impl-prep-findings.md 의 체크박스는 여전히 `[ ]`. 이는 target plan 과 직접 충돌하지 않지만, plan 상태 정합성이 흐트러져 있다.
  - 제안: `spec-update-impl-prep-findings.md` 의 C2 체크박스를 완료로 갱신하고, C1 이 target plan 과 직접 겹치지 않음을 확인한 뒤 처리 순서를 정할 것.

- **[INFO]** target plan 의 `catalog-sync.spec.ts` 양방향 동기 검증 테스트는 plan/in-progress 어느 파일에서도 ownership 이 명시되지 않음
  - target 위치: D1 §5 "명단 갱신 절차" step 5 / D2.1 / D3.2 검증 규칙 8
  - 관련 plan: 해당 없음
  - 상세: `catalog-sync.spec.ts` 신설·갱신은 backend 코드 변경이므로 developer 역할이 별도 worktree에서 구현해야 한다. 현재 target plan 이 spec draft 임에도 테스트 파일 위치까지 명시하고 있으나, 이를 위한 developer plan 이나 이슈가 아직 없다. spec 승인 후 후속 developer plan 생성이 필요하다.
  - 제안: `/consistency-check --spec` 통과 후 spec 를 실제 파일에 반영하는 planner 작업과, `catalog-sync.spec.ts` 구현을 위한 developer plan 을 각각 신설할 것.

- **[INFO]** `spec-update-cafe24-test-connection.md` 의 §9.1 — `pending_install` 상태 보호 조항이 target D5 와 동일 파일(`spec/2-navigation/4-integration.md`) 내 다른 섹션에 추가될 예정이나 좌표가 겹치지 않음
  - target 위치: D5 전체
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` §9.1 — §9.1 또는 §14.1 에 `pending_install` 보호 추가 (권장). 아직 미착수 상태 (직렬화 조건 미해소).
  - 상세: target plan D5 는 §3.2·§4.4·§5·§9.4·§10.4·Rationale 를 수정하고, `spec-update-cafe24-test-connection.md` 는 §5.8·§9.1(또는 §14.1) 을 수정한다. §9.4 와 §9.1 이 다른 섹션이므로 직접 충돌보다는 HEAD diff merge 정도의 문제. 하지만 두 plan 이 모두 같은 파일을 수정하므로 순서 조율이 권장된다.
  - 제안: target plan 이 먼저 머지되거나, 두 plan 을 같은 worktree에서 처리하는 방안을 고려. 순서 결정 후 plan 에 명시.

---

### 요약

target plan(`spec-draft-cafe24-restricted-scopes.md`, worktree `cafe24-restricted-scopes-a1b2c3`) 의 핵심 변경 파일인 `spec/2-navigation/4-integration.md` 와 `spec/4-nodes/4-integration/4-cafe24.md` 는 이미 다른 plan·worktree 들과 충돌 위험이 있다. 가장 중요한 이슈는 `spec-update-cafe24-test-connection.md` 에 명시된 직렬화 선행 조건(세 worktree 머지 여부)이 현재 해소되었는지 알 수 없다는 점이다 — 그 조건이 아직 미해소라면 target plan 의 D5 변경은 동일 파일에 대한 병렬 worktree 경합을 유발한다. `full-review-fixes-a1b2c3` 의 `spec/4-nodes/4-integration/4-cafe24.md` W-69 변경이 main 에 머지된 이후에 target 을 작성해야 변경 내용이 누락되지 않는다. 나머지 이슈(backlog F-2, spec-update-impl-prep-findings C2 이중 추적, catalog-sync.spec.ts developer plan 부재)는 WARNING/INFO 수준으로 직접 차단 사유는 아니나 plan 갱신을 통한 명시가 권장된다. 신규 식별자(`restrictedApproval`, `restricted`, `requiresCafe24Approval`, `oauth_invalid_scope`)와 기존 plan 간 직접 충돌은 발견되지 않았고, 미해결 결정을 일방적으로 우회하는 결정도 없다.

---

### 위험도

MEDIUM
