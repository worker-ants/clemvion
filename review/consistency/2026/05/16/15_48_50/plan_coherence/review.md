# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
대상 worktree: `cafe24-mall-dup-ux-a7f2c8`
검토 시점: 2026-05-16

---

### 발견사항

- **[CRITICAL]** `spec/2-navigation/4-integration.md` Rationale 말미를 동시에 수정하는 다른 worktree 존재
  - target 위치: 변경 4 — Rationale 신설 2개 항목 (섹션 말미에 추가)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree `cafe24-app-url-reuse-f9a2e3`) — "spec/2-navigation/4-integration.md Rationale (신규 항목)" 이라고 명시. 또한 `plan/in-progress/spec-update-cafe24-test-connection.md` 도 선행 직렬화 필수 조건으로 `cafe24-app-url-reuse-f9a2e3` 를 나열하고 있어 해당 worktree 의 Rationale 수정이 아직 미완료임을 확인.
  - 상세: target plan 의 변경 4 는 `spec/2-navigation/4-integration.md` 의 Rationale 섹션 말미에 2개 항목("Cafe24 Public 흐름의 begin-time 사전 가드 추가", "precheck endpoint — mall_id 입력 단계 사전 감지 UX")을 추가한다. `spec-update-cafe24-app-url-reuse.md` 도 동일 Rationale 절 말미에 신규 항목을 추가하는 작업을 진행 중이며, 두 worktree 가 독립적으로 Rationale 를 확장하면 merge 시 텍스트 충돌이 발생한다. 이 충돌은 이미 이전 consistency-check (2026-05-16 14:28 BLOCK:YES Critical 3) 에서 `cafe24-hmac-raw-fix-b8e2d1` 이 Rationale 말미 수정 중이라는 Critical 으로 보고된 적 있고, target plan 의 `cafe24-mall-dup-ux.md` 는 "위임 단계에서 rebase 처리"로 해소 예정이라고 기록했다. 그러나 이 rebase 의존성이 spec-draft plan 본문에는 명시되지 않아 spec 작업 착수 시 인지 실패 위험이 있다.
  - 제안: `spec-draft-cafe24-public-dup-guard.md` 에 "착수 전 의존성" 항목을 추가해 `cafe24-app-url-reuse-f9a2e3` 의 Rationale 수정이 main 에 merge 된 이후에 본 spec draft 를 실제 spec 파일에 적용한다는 직렬화 조건을 명시한다. 또는 `spec-update-cafe24-public-dup-guard.md` (spec 갱신 위임 plan) 에 해당 직렬화 조건을 이미 기록해두어야 project-planner 가 착수 전 인지할 수 있다.

- **[CRITICAL]** `spec/2-navigation/4-integration.md` §9.2 를 동시에 수정하는 다른 worktree 존재
  - target 위치: 변경 1 — §9.2 OAuth begin 행 (line 696), 변경 2 — §9.2 신규 endpoint 행 추가
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` (worktree `cafe24-pending-polish-7fdb7e`) — "spec/2-navigation/4-integration.md §9.2 / §9.4 …을 갱신" 이라고 명시. `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree `cafe24-app-url-reuse-f9a2e3`) — "spec/2-navigation/4-integration.md §9 (API — App URL endpoint 의 status 분기…)" 를 수정 대상으로 열거. `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree `prod-rereview-fix-a7c93f`) — §11 수정이 main 이지만 동일 파일 편집.
  - 상세: `cafe24-pending-polish-7fdb7e` 는 §9.2 에 `meta.appType` 필드 추가를 포함한 미체크 항목(`[ ] spec §9.1`)이 남아있고, `cafe24-app-url-reuse-f9a2e3` 도 §9 전반을 수정 중이다. 이들이 아직 main 에 merge 되지 않은 상태에서 `cafe24-mall-dup-ux-a7f2c8` 이 §9.2 의 동일 행에 덮어쓰기하면 git merge 충돌 또는 의미 유실이 발생한다.
  - 제안: spec 갱신 착수(`spec-update-cafe24-public-dup-guard.md` 실행 시점) 전에 `cafe24-pending-polish-7fdb7e` 및 `cafe24-app-url-reuse-f9a2e3` 의 §9.2 관련 작업이 main 에 합류되었는지 확인 후 직렬화 조건으로 명시한다.

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 오류 코드 rename 미결 결정이 plan 에 잔존
  - target 위치: 변경 3 — §9.4 errors 의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 행, 변경 1 의 동일 코드 언급
  - 관련 plan: `plan/in-progress/cafe24-mall-dup-ux.md` (동일 worktree `cafe24-mall-dup-ux-a7f2c8`) — "Warning 8 (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` rename) — 기각. 사용자 지시: 에러 코드는 기존 그대로 재사용" 이라고 기록.
  - 상세: rename 기각 결정은 `cafe24-mall-dup-ux.md` 에만 기록되어 있고 target 의 spec-draft plan 에는 보이지 않는다. spec-draft 만 읽는 project-planner 가 스스로 rename 을 "미결 사항" 으로 판단하고 코드 이름을 바꿔버릴 가능성이 있다.
  - 제안: `spec-draft-cafe24-public-dup-guard.md` 변경 3 설명에 "오류 코드 이름 rename 은 사용자 지시로 기각 (2026-05-16) — 코드 이름의 `PRIVATE` 토큰은 historical artifact 이며 의미는 spec 정의에 따름" 을 한 줄 추가해 project-planner 가 착수 전 인지하도록 한다.

- **[WARNING]** `cafe24-pending-polish.md` 의 §9.4 관련 미체크 항목과 중복 가능
  - target 위치: 변경 3 — §9.4 errors 의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 행 확장
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` (worktree `cafe24-pending-polish-7fdb7e`) — "동일 `(workspaceId, mall_id, app_type='private')` 에 `connected` 가 이미 있으면 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) 반환 (swagger 규약 — spec §9.4)" 라는 미체크 항목.
  - 상세: `cafe24-pending-polish` 가 §9.4 의 동일 오류 코드 행을 아직 작업 중이라면, target plan 의 변경 3 과 의미가 겹치거나 상충될 수 있다. 특히 `cafe24-pending-polish` 가 §9.2/§9.4 갱신을 완료했다고 표기한 체크박스(`[x] spec 갱신 적용 완료`)가 있지만 다른 미체크 항목과 공존하므로 §9.4 수정이 완전히 끝난 상태인지 불분명하다.
  - 제안: spec 갱신 착수 전 `cafe24-pending-polish.md` 의 §9.4 관련 작업 상태를 재확인하고, 완료된 경우 spec-draft 의 변경 3 과 중복 없이 보완만 함을 확인한다.

- **[WARNING]** `spec-update-cafe24-background-refresh.md` 의 Rationale 추가와 말미 위치 경합
  - target 위치: 변경 4 — Rationale 신설 2개 항목 (Rationale 섹션 말미에 추가)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree `prod-rereview-fix-a7c93f`) — "Rationale 끝부분에 '왜 별도 job 으로 분리하는가' 메모" 를 추가하는 미체크 항목.
  - 상세: `prod-rereview-fix-a7c93f` 도 동일 Rationale 말미에 별도 항목을 삽입하려 한다. 이 plan 이 먼저 merge 될 경우 `cafe24-mall-dup-ux-a7f2c8` 의 변경 4 는 rebase 후 새 말미 기준으로 맞춰야 한다.
  - 제안: `spec-draft-cafe24-public-dup-guard.md` 또는 `spec-update-cafe24-public-dup-guard.md` 에 "Rationale 절 착수 전 `prod-rereview-fix-a7c93f` 가 주입한 항목 확인 후 말미에 이어붙임" 메모를 추가한다.

- **[INFO]** `cafe24-pending-polish-followup.md` 의 Swagger `@ApiResponse` 항목 미처리와 precheck endpoint 연동
  - target 위치: 변경 2 — §9.2 신규 `GET /api/integrations/cafe24/precheck` 행
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` (worktree 동일 연계) — "신규 에러 코드 2종 `@ApiResponse` 데코레이터 미처리" 미체크 항목 (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 포함).
  - 상세: precheck endpoint 가 spec 에 추가된 후에는 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 포함한 precheck 응답의 Swagger `@ApiResponse` 도 추가해야 할 수 있다. `cafe24-pending-polish-followup.md` 의 미체크 항목이 이 범위를 자동 포함하는지 확인 필요.
  - 제안: `cafe24-pending-polish-followup.md` 의 Swagger 항목에 "precheck endpoint 의 throttle-related 응답(429)" 포함 여부를 명시하거나, spec-draft 의 precheck 행 설명에 Swagger 데코레이터 추가 필요 후속을 언급한다.

- **[INFO]** `spec-draft-cafe24-public-dup-guard.md` 자체에 미완 후속 항목 체크박스가 없어 lifecycle 관리 불명확
  - target 위치: 전체 문서
  - 관련 plan: `plan/in-progress/spec-update-cafe24-public-dup-guard.md` (동일 worktree) — `[ ] project-planner 진입해 위 변경 내용 작성`, `[ ] /consistency-check --spec 통과 확인`, `[ ] PR merge 시 본 plan 을 complete/ 로 git mv` 의 체크박스를 보유.
  - 상세: spec-draft plan 은 spec 변경 내용만 기술하고 체크박스가 없다. `spec-update-cafe24-public-dup-guard.md` 가 별도의 lifecycle 추적 plan 역할을 하므로 두 문서의 관계가 명시되어야 한다. spec-draft 가 spec-update plan 의 부속 문서임을 모르는 reviewers 가 spec-draft 를 완료된 단독 plan 으로 오인할 수 있다.
  - 제안: `spec-draft-cafe24-public-dup-guard.md` 상단에 "본 문서는 `plan/in-progress/spec-update-cafe24-public-dup-guard.md` 의 변경 상세 첨부이다" 한 줄을 추가하거나, 두 문서를 하나로 병합한다.

---

### 요약

target plan(`spec-draft-cafe24-public-dup-guard.md`) 이 수정하려는 `spec/2-navigation/4-integration.md` 의 §9.2, §9.4, Rationale 세 절이 모두 다른 활성 worktree(`cafe24-app-url-reuse-f9a2e3`, `cafe24-pending-polish-7fdb7e`, `prod-rereview-fix-a7c93f`)에 의해 동시에 수정 중이다. 특히 Rationale 말미 추가와 §9.2 begin 행 수정은 두 건 모두 CRITICAL 수준의 동시 편집 경합으로, spec-draft 를 실제 spec 파일에 적용하기 전에 선행 worktree 들이 main 에 merge 되어야 한다. 이 직렬화 조건이 spec-draft plan 이나 spec-update 위임 plan 에 명시적으로 기록되어 있지 않아, project-planner 가 착수 시점에 충돌을 인지하지 못할 위험이 있다. 오류 코드 rename 기각 결정도 `cafe24-mall-dup-ux.md` 에만 있어 spec-draft 단독 독자에게 전달되지 않는다.

### 위험도

CRITICAL
