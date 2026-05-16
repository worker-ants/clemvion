# Plan 정합성 검토 — `spec/2-navigation/4-integration.md`

검토 모드: spec draft (`--spec`)
검토 일시: 2026-05-16

---

## 발견사항

### 발견사항 1

- **[WARNING]** `integration-attention-filter.md` 의 "Spec 갱신" 단계가 미체크인데 target spec 에 이미 반영됨
  - target 위치: §2.1 ASCII 다이어그램 (`[Attention]` 칩 라인), §2.3 상태 칩 표 (`Attention` 항목), §2.4 "Need attention" 배너 (분해 카운트·단일 건 직접 점프·톤 강조), §9.1 `attention` 가상 필터값, Rationale "Attention 가상 필터값" 항
  - 관련 plan: `plan/in-progress/integration-attention-filter.md` §"작업 체크리스트" — `(project-planner) spec 갱신 + /consistency-check --spec` 항목이 `[ ]` 상태
  - 상세: plan 의 spec 갱신 체크박스(`[ ] (project-planner) spec 갱신 + /consistency-check --spec`)는 아직 미체크이나, target spec draft 는 이미 해당 변경을 완전히 반영하고 있다. `/consistency-check --spec` 통과 확인도 plan 에 기록되어 있지 않다. plan 과 실제 작업 상태가 불일치하여 추적이 끊겨 있다.
  - 제안: target spec 이 정합 상태라면 plan 의 해당 체크박스를 `[x]`로 갱신하고, `/consistency-check --spec` 세션 경로를 plan 에 기록한다. 본 consistency-check 세션 자체가 그 통과 증거가 된다.

---

### 발견사항 2

- **[WARNING]** `spec-update-cafe24-background-refresh.md` 에서 요청한 §11 `cafe24-background-refresh` job 기술이 target 에 추가되었으나 plan 이 미완료 상태
  - target 위치: §11 상단 안내문 (네 번째 job `cafe24-background-refresh`), §11.1 스캐너 잡 표, Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" 및 "`cafe24-background-refresh` 10일 임계" 항
  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — 진행 상태의 체크박스 3개 모두 `[ ]`
  - 상세: plan 이 요청한 4개 항목(§11 안내문 정정, §11.x 신규 소절, §11.1 표 추가, Rationale 항목)이 target 에 이미 기술되어 있다. 단, plan 의 체크박스가 전혀 완료 표기되지 않았고 plan 이 `complete/` 로 이동되지도 않았다. plan 상태와 실제 산출물이 불일치.
  - 제안: plan 체크박스를 `[x]`로 갱신하고, `/consistency-check --spec` 통과 확인 후 `git mv plan/in-progress/spec-update-cafe24-background-refresh.md plan/complete/`로 이동한다.

---

### 발견사항 3

- **[WARNING]** `cafe24-pending-polish-followup.md` 그룹 F — §6 mermaid `install_token` 보존 정책 명시 항목 미반영
  - target 위치: §6 상태 전이 다이어그램 및 전이 표
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` §"그룹 F" — `[ ] §6 mermaid install_token 보존 정책 명시. callback 실패 시 install_token 유지 → 재시도 가능 (data-flow §1.2.1 에는 이미 명시).`
  - 상세: target §6 는 `pending_install → connected` 전이 표 항에서 "install_token 은 **보존**" 텍스트를 설명 열에 담고 있으나, 상단 ASCII 상태 머신 다이어그램 자체에 이 보존 사실이 명시적으로 표현되지 않는다. plan 이 "mermaid `install_token` 보존 정책 명시" 라고 요청한 사항과 현재 다이어그램이 일치하는지 모호하다. 해당 항목은 여전히 미체크.
  - 제안: §6 ASCII 다이어그램 또는 전이 표에 `install_token` NULL 화 예외 경로(`pending_install → expired` 만 NULL)를 주석으로 추가하거나, 이미 충분하다고 판단되면 plan 체크박스를 `[x]`로 갱신해 추적을 닫는다.

---

### 발견사항 4

- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` plan 이 동일 파일(`spec/2-navigation/4-integration.md`)을 다루고 있으며, 해당 내용이 target 에 이미 반영됨 — plan 상태 확인 필요
  - target 위치: §3.2 Cafe24 Private 흐름 step 6 ("install_token 은 **보존**"), §4.4 Scope & Permissions 분기 ② (`cafe24_private_pending` 응답, inline alert 패턴), §6 전이 표, §9.2 `install_token` 관련 설명, Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" 및 "Cafe24 Private request-scopes 흐름"
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — 영향 받는 spec 섹션으로 §3.2, §4.4, §6, §9.2 가 명시되어 있음. 본 worktree(`integration-attention-filter-053b74`)의 spec draft 가 이 변경을 포함하고 있다.
  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 worktree(`cafe24-app-url-reuse-f9a2e3`)와 본 target 의 worktree(`integration-attention-filter-053b74`)가 동일 파일의 같은 섹션에 변경을 기록하고 있을 가능성이 있다. 두 worktree 가 병렬로 해당 파일을 수정 중이라면 merge 시 충돌이 발생할 수 있다. 다만, spec-update-cafe24-app-url-reuse.md 에는 "Spec 갱신" Phase가 완료 여부가 불명확하다.
  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 실제 진행 상태를 확인하고, 해당 spec 변경이 이미 다른 PR 으로 main 에 merge 되었다면 plan 을 `complete/`로 이동한다. 아직 미머지라면 target spec 의 동일 섹션 변경과 충돌 범위를 사전 식별해 직렬화한다.

---

### 발견사항 5

- **[INFO]** `integration-attention-filter.md` 의 `/consistency-check --impl-prep` 단계가 미체크 — target spec 개정과 관계
  - target 위치: 전체 spec draft
  - 관련 plan: `plan/in-progress/integration-attention-filter.md` 작업 체크리스트 `[ ] (developer) /consistency-check --impl-prep`
  - 상세: plan 은 developer 단계에서 `--impl-prep` 을 먼저 수행하도록 규정하고 있으나, 본 세션은 `--spec` 모드로 호출됐다. spec draft 단계에서 `--spec` 으로 시작하는 흐름은 정상이나, 이후 구현 착수 시 `--impl-prep` 을 빠뜨리지 않도록 plan 에 명시적으로 표기해 두는 것이 좋다.
  - 제안: 현재 단계(spec 검토)는 정상이므로 즉각 조치 불필요. 이후 developer 가 구현 착수 시 plan 에 따라 `--impl-prep` 을 반드시 수행한다.

---

### 발견사항 6

- **[INFO]** `cafe24-pending-polish-followup.md` 그룹 F — `spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정 항목 미반영
  - target 위치: §9.4 에러 코드 표의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 항 ("swagger 규약(spec/conventions/swagger.md §2-4)" 참조)
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F `[ ] spec/conventions/swagger.md §2-4 실재 확인 및 cross-link 정정`
  - 상세: target §9.4 에서 `spec/conventions/swagger.md §2-4` 를 인라인 참조하고 있으나, 해당 파일의 실재 여부 및 섹션 번호가 확인되지 않았다. 이 항목은 plan 에서 미체크로 남아 있다.
  - 제안: plan 의 해당 항목이 처리되기 전까지 target 의 인라인 참조가 broken link 일 수 있음을 인지한다. 구현 착수 전 또는 spec merge 전에 해당 경로 존재 여부를 확인한다.

---

## 요약

Target(`spec/2-navigation/4-integration.md`) draft 는 `integration-attention-filter.md` 가 요청한 Attention 필터·배너 개선, `spec-update-cafe24-background-refresh.md` 가 요청한 `cafe24-background-refresh` job 문서화, `spec-update-cafe24-app-url-reuse.md` 가 요청한 `install_token` persistent 처리 및 request-scopes 분기를 모두 적절히 반영하고 있다. 미결 결정을 일방적으로 우회하거나 다른 plan 이 진행 중인 영역과 직접 충돌하는 CRITICAL 수준 이슈는 없다. 주요 위험은 관련 plan 3건(`integration-attention-filter`, `spec-update-cafe24-background-refresh`, `spec-update-cafe24-app-url-reuse`)의 체크박스와 완료 상태가 실제 산출물과 불일치한다는 추적 단절이다. `cafe24-pending-polish-followup.md` 의 §6 다이어그램 보완·swagger cross-link 확인 항목도 여전히 미체크로 남아 있어 후속 처리 시 누락 위험이 있다. worktree 경합 관점에서는 `spec-update-cafe24-app-url-reuse.md`(worktree `cafe24-app-url-reuse-f9a2e3`)가 동일 파일을 다루고 있어 merge 충돌 가능성을 사전에 확인해야 한다.

## 위험도

LOW
