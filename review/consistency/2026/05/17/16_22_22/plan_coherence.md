### 발견사항

- **[INFO]** `spec/data-flow/8-notifications.md` 의 dismiss 반영 — `spec-draft-notification-dismiss.md` 의 변경안이 이미 본문에 적용됨
  - target 위치: `spec/data-flow/8-notifications.md` §2.1, §3, §4, Rationale 전체
  - 관련 plan: `plan/in-progress/spec-draft-notification-dismiss.md` (worktree: `notification-actions-8806b6`)
  - 상세: `spec-draft-notification-dismiss.md` 는 "작업 절차" §1~§4 순서 중 §2(spec 반영)까지 완료된 상태로 보인다. target `spec/data-flow/8-notifications.md` 에 dismiss 컬럼·인덱스·§4 절·Rationale 이 모두 기재되어 있어, draft 내용과 spec 본문이 정합하다. plan 자체는 `plan/in-progress/` 에 남아 있는 상태 (B안 전체 완료 전 complete 이동 불가)이므로 충돌 아님 — 정상 진행 중.
  - 제안: 추적용 메모. spec 반영 완료 후 plan 의 체크박스 갱신 여부 확인 권장.

- **[INFO]** `spec/data-flow/8-notifications.md` §1.1 `integration_action_required` type 미등록
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 "Type 별 source · 트리거" 표
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §A-1 (frontend 액션 UI 항목)
  - 상세: `integration_action_required` type 은 `spec/5-system/` 과 코드베이스에서 사용되고, DB CHECK constraint 도 migration `V052`에서 추가됐다 (full-review RESOLUTION C-9). 그러나 data-flow `8-notifications.md` §1.1 의 type 표에 `integration_action_required` 항목이 없다. `cafe24-backlog-residual.md §A-1` 이 frontend UI 구현을 다루지만, data-flow spec 표 갱신은 누락이다. 현재 범위 내 구현이 완료됐음에도 spec 이 이를 반영하지 않은 상태.
  - 제안: `8-notifications.md §1.1` 표에 `integration_action_required` type 행을 추가한다. worktree `notification-actions-8806b6` 의 현 plan(`spec-draft-notification-dismiss.md`) 범위 안이 아니므로, `cafe24-backlog-residual.md` plan 에 별도 TODO 항목으로 기록하거나 이번 spec 반영 시 함께 처리한다.

- **[INFO]** `spec-update-impl-prep-findings.md` C1 미해소 — `spec/data-flow/3-execution.md` 영향
  - target 위치: `spec/data-flow/3-execution.md` §2.1 Postgres 표 (`execution` 테이블 컬럼 목록)
  - 관련 plan: `plan/in-progress/spec-update-impl-prep-findings.md` C1 항목 (worktree: `ai-thread-source-mark-7c4f2a`)
  - 상세: `spec-update-impl-prep-findings.md` C1은 `spec/1-data-model.md §2.13` 에 `re_run_of UUID NULL` / `chain_id UUID NOT NULL` 컬럼 추가를 요구한다. `3-execution.md §2.1` 은 `execution` 테이블의 schema 매핑을 담고 있으므로, C1 이 실행되면 동 doc §2.1 도 함께 갱신되어야 한다. 그러나 현재 C1 은 미체크(`[ ]`) 상태이며 target 문서(`3-execution.md`)도 이 컬럼을 반영하지 않았다. 기존 사전 조건(`spec-update-impl-prep-findings.md` C1 처리)이 미해소인 채로 target 영역(`3-execution.md`)이 impl-prep 대상에 포함될 경우 실행 spec 과 구현 간 정합성 공백이 남는다.
  - 제안: `spec-update-impl-prep-findings.md` C1 처리 이후 `3-execution.md §2.1` 에 `re_run_of`, `chain_id` 컬럼을 추가한다. C1 을 담당하는 `ai-thread-source-mark-7c4f2a` worktree와 진행 순서를 조율한다.

- **[INFO]** `spec/data-flow/0-overview.md` §2 도메인 인덱스 — 파일 수(13) 와 실제 항목(12) 불일치
  - target 위치: `spec/data-flow/0-overview.md` §2 첫 문장 "다음 13개 도메인 spec"
  - 관련 plan: 없음 (기존 정합화 plan 완료 후 잔존)
  - 상세: `0-overview.md §2` 는 "13개 도메인 spec" 이라 표기하지만 실제 표의 항목은 12개다 (`audit`, `workspace`, `workflow`, `execution`, `knowledge-base`, `integration`, `triggers`, `llm-usage`, `file-storage`, `notifications`, `observability` 11행 + notifications 포함 해도 12개). 주석 없이 숫자만 다르다. 어느 도메인이 누락됐거나 숫자가 오기인지 확인 필요.
  - 제안: 실제 도메인 파일 수와 표의 항목 수를 세어 `0-overview.md §2` 의 카운트를 교정한다. 이는 spec 내부 일관성 문제로 중요도는 낮으나 추적 권장.

### 요약

target `spec/data-flow/` 문서들은 전반적으로 진행 중 plan 들과 충돌하지 않는다. `spec-draft-notification-dismiss.md` (worktree `notification-actions-8806b6`) 의 변경안이 `8-notifications.md` 에 이미 적용되어 있고, 나머지 도메인 spec(`1-audit.md` ~ `12-workspace.md`)은 어느 in-progress plan 에서도 동시 수정하는 항목이 확인되지 않는다. 주요 관찰사항은 (1) `integration_action_required` 알림 type 이 코드·migration 에서는 완료됐으나 `8-notifications.md §1.1` 표에 미기재, (2) `spec-update-impl-prep-findings.md` C1(Execution 컬럼 추가)이 미해소인 채로 `3-execution.md` 의 schema 매핑이 선행 조건과 불일치하는 잠재 상태, (3) `0-overview.md §2` 의 도메인 카운트 오기(13 vs 12)의 세 INFO 사항으로, 모두 작업 차단 사유는 아니다.

### 위험도

LOW
