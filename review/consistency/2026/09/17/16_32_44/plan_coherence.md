# Plan 정합성 검토 — spec-draft-deletion-releases-trigger-resources.md

## 발견사항

- **[WARNING]** `secret-store.md` 안에서 개정 대상(§R4)과 미개정 구간(§6)이 서로 모순하게 된다
  - target 위치: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 「변경안」 S7 (`spec/conventions/secret-store.md §R4`)
  - 관련 문서: `spec/conventions/secret-store.md ## 6. Trigger 삭제 시 cascade` (S1~S7 어디에도 포함되지 않은 절)
  - 상세: S7 은 §R4 한 문장만 "트리거 행을 없애는 **모든** 경로" 로 정정한다. 그런데 같은 파일 §6
    "Trigger 삭제 시 cascade" 절에는 정정 대상과 **동일한 문장**이 그대로 남는다 — 첫 문단이
    "Trigger 삭제 시 application 이 ref 를 정리한다 — `TriggersService.remove()` 가 … 하는 의무"
    라고 §R4 의 옛 문장과 같은 주어(트리거 삭제 한 경로)로 다시 적고, 둘째 문단은 한발 더 나아가
    **"`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용 (`DELETE FROM secret_store WHERE
    workspace_id = $1`)"** 라고 — draft 의 D4 가 "새로 추가해야 한다" 고 결정한 바로 그 SQL 이
    **이미 구현되어 있다는 듯이** 서술한다. `codebase/backend/src/modules/workspaces/workspaces.service.ts`
    전수 확인 결과 그런 쿼리는 없다(draft 자신의 실측과도 일치). 즉 draft 를 S1~S7 대로만 적용하면
    한 파일 안에 "모든 경로가 책임진다"(개정된 §R4)와 "트리거 삭제 한 경로만 책임지고, workspace
    쪽은 이미 별도로 처리돼 있다"(미개정 §6) 는 **정면으로 모순되는 두 절**이 공존한다. 더 심각한
    문제는 §6 둘째 문단이 D4 가 아직 구현되지 않았다는 사실 자체를 가려 — 이 문장을 읽는 다음
    사람은 "이미 정리된다" 고 오판해 필요한 developer 후속 작업을 아예 만들지 않을 수 있다.
  - 제안: target 의 변경안에 S8 로 §6 두 문단을 함께 정정하는 항목을 추가한다(§R4 와 같은 "모든
    경로" 서술로 통일, 둘째 문단의 미구현 SQL 은 "해야 한다" 로 시제 교정 또는 §R4/D4 참조로 대체).

- **[WARNING]** 이 draft 가 전제하는 developer 구현 작업이 어떤 `plan/in-progress/**` 에도 등재돼 있지 않다
  - target 위치: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 「이 draft 가
    **안** 하는 것」 — "구현 — developer 턴이 별 PR 로 한다(**트래커에 등재**)"
  - 관련 plan: 전수 검색 결과 `plan/in-progress/**` 어디에도 "워크플로·워크스페이스 삭제가 트리거
    외부 자원(schedule job·chat channel·secret_store)을 해제하지 않는다" 는 항목이 없다(신설
    draft 자신을 제외하면 0건). 가장 근접한 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 "developer 범위 후속" 표(항목 1~11)에도 이 결함은 없다.
  - 상세: D1~D5 는 `workflows.service.ts` / `workspaces.service.ts` 의 실제 코드 변경을 전제하는
    결정이다. 그런데 draft 는 "트래커에 등재" 라고만 적고 실제로 어느 트래커의 어느 항목인지
    만들지 않았다. 동시에 이 draft 가 편집하는 spec 중 `spec/1-data-model.md` 와
    `spec/conventions/secret-store.md` 는 **`status: implemented`**(frontmatter, `pending_plans:`
    없음)다 — `spec/conventions/spec-impl-evidence.md` R-5 는 `status: partial` 일 때만
    `pending_plans:` 를 의무화하지만, 그 취지("spec 이 자기를 책임지는 plan 을 가리킨다")를
    적용하면 이 draft 가 서술하는 새 규칙(D1)이 코드에 없는 채 "implemented" 문서에 얹히는 셈이라
    구현 완료 시점까지 이 상태(문서 vs 코드 괴리)를 추적할 자리가 없다. `2-trigger-list.md` ·
    `1-workflow-list.md` 는 이미 `status: partial` + `pending_plans:` 를 갖고 있지만 그 목록엔
    이 새 구현 항목이 없다(각각 `spec-draft-nullable-notation-followups.md`, `marketplace-and-plugin-sdk.md`
    만 등재).
  - 제안: 이 draft 를 승인해 spec 에 반영하는 시점에 실제 `plan/in-progress/<name>.md` 를
    신설(또는 기존 트래커에 항목 추가)하고, 위 네 spec 파일 중 최소한 `secret-store.md`·
    `1-data-model.md` 의 관련 행/절 근방에 그 plan 을 가리키는 명시적 포인터(또는 `pending_plans:`
    갱신)를 남긴다.

- **[WARNING]** 착수 계기였던 트래커 항목이 미해소 상태로 방치되고 새 draft 와의 교차 참조가 없다
  - target 위치: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 「배경」 —
    "트래커 developer 항목 8(…)을 착수하며 전제를 쟀다 … 항목 8 의 경합은 이 결함의 아주 좁은 한
    경우였다. 사용자 결정(2026-09-17)으로 이 결함으로 전환한다."
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`trigger-config`
    advisory lock 이 남긴 developer 범위 후속" 표, 항목 8 — `rewriteTriggerConfigLocked` 반환값을
    무시하는 호출부 2곳(`normalizeNotificationSecretRef` · `chat-channel-binder.service.ts` degraded
    fallback). 여전히 **미체크**(`- [ ]`)이고 이 새 draft 로의 참조가 전혀 없다.
  - 상세: draft 자신은 "항목 8 착수 중 더 넓은 결함으로 전환했다" 고 명시하지만, 정작 항목 8 이
    등재된 트래커 문서에는 이 사실이 반영돼 있지 않다. 다음에 그 트래커를 읽는 사람은 항목 8 이
    독립적으로 아직 열려 있는 별개 작업으로 보고 (a) 이 draft 의 존재를 모른 채 항목 8 을 좁게
    다시 조사하거나, (b) 이 draft 완료 후 항목 8 이 자동으로 해소되는지 여부를 판단할 근거가 없다.
    이 저장소가 이미 겪은 "미룬 항목은 그 턴에 plan 에 적어라" 클래스의 재발이다.
  - 제안: `spec-draft-nullable-notation-followups.md` 항목 8 옆에 "→ 본 결함(넓은 버전)으로 전환,
    `spec-draft-deletion-releases-trigger-resources.md` 참조" 한 줄을 추가하고, 항목 8 자체가
    이 draft 완료로 흡수되어 닫히는지 아니면 별도로 남는지(반환값 무시는 CASCADE 삭제와 다른
    메커니즘 — concurrent PATCH 대 concurrent DELETE) 를 명시한다.

## 요약

target 의 핵심 결정(D1~D5, 트리거 행을 없애는 모든 경로가 외부 자원을 해제해야 한다)은 `plan/in-progress/**` 의 어떤 "결정 필요" 항목과도 정면 충돌하지 않고, 오히려 이미 열려 있던 두 트래커 항목(planner 몫 `TriggersService.delete()` 오기 두 곳, `data-flow/11-workflow.md §3.1` CASCADE 행 신설)을 올바르게 승계·완결하는 방향으로 짜여 있다. 다만 (1) draft 가 손대는 `secret-store.md` 안에 정정 대상과 똑같은 오류를 반복하는 미개정 구간(§6)이 남아 개정 취지를 스스로 훼손할 위험이 있고, (2) 이 draft 가 전제하는 developer 구현 작업이 어떤 plan 에도 등재돼 있지 않아 "트래커에 등재" 라는 draft 자신의 약속이 아직 지켜지지 않았으며, (3) 이 조사의 발단이 된 트래커 항목(item 8)이 미체크 상태로 새 draft 와 연결되지 않은 채 남아 있다. 셋 다 즉시 결정 충돌은 아니지만 이 draft 가 승인·병합되는 시점에 함께 처리하지 않으면 후속 작업이 누락되거나 spec 이 자기모순 상태로 남는다.

## 위험도

MEDIUM
