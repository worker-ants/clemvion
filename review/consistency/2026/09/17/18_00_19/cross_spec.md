# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep, 트리거 삭제 자원 정리)

대상: `spec/2-navigation/2-trigger-list.md`(§3 «동시 쓰기 직렬화» · §4.3 cascade 동작, 2026-09-17
결정 「트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다」) 및 그 자매 문서
(`1-workflow-list.md`, `3-schedule.md`). 같은 커밋(`aaee17206`)에서 함께 갱신된
`spec/data-flow/10-triggers.md` · `spec/data-flow/11-workflow.md` · `spec/data-flow/12-workspace.md` ·
`spec/conventions/secret-store.md` · `spec/1-data-model.md`, 그리고 `spec/5-system/1-auth.md`(RBAC) ·
`spec/5-system/14-external-interaction-api.md` · `spec/5-system/15-chat-channel.md` ·
`spec/2-navigation/4-integration.md`(cafe24 lock 선례 인용)를 대조했다.

## 발견사항

- **[WARNING]** `data-flow/10-triggers.md` §1.4 표의 "Trigger 직접 삭제" 행만 비밀 정리 시점을
  이미 확정된 사실처럼 서술 — 형제 행 둘과 다르게 「미구현 (Planned)」 태그가 빠졌다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.3 상단 註 — *"그 전까지는 트리거 화면
    삭제만 네 자원을 모두 정리하고(스케줄 화면 삭제는 schedule job 만), **비밀을 행 삭제 전에
    지운다**"* (2026-09-17 결정 문단). 즉 **현재(구현 전) 트리거 화면 삭제는 비밀을 행 삭제
    커밋 *전*에 지운다** — 이 developer plan(DRT-2)이 정확히 그 순서를 반전시키는 작업이다
    (`plan/in-progress/trigger-deletion-release.md` 설계: *"트리거: 외부 해제 → 락·행 삭제 →
    **커밋 뒤 비밀(순서 반전)**"*).
  - 충돌 대상: `spec/data-flow/10-triggers.md` §1.4 동기화 표, "Trigger(type='schedule') 직접
    삭제 (`DELETE /api/triggers/:id`)" 행 — *"삭제 전 `removeJob(schedule.id)` 으로 BullMQ job
    scheduler 엔트리 해제 (`triggers.service.ts` remove()) · **비밀 정리는 행 삭제 커밋 뒤**
    ([트리거 목록 §4.3])"*. 같은 표의 위·아래 행("Schedule 삭제", "Workflow·Workspace 삭제 (FK
    CASCADE)")은 나란히 **"— 미구현 (Planned)"** 를 명시하는데, 이 행만 그 태그 없이 현재형으로
    적혀 있다.
  - 상세: 커밋 `aaee17206`(#1345) 이 세 spec 문서를 같은 diff 로 갱신했다. `spec/data-flow/11-workflow.md`
    §3 (`workflow` 삭제 row) 와 `spec/data-flow/12-workspace.md` §1.10 (`DELETE
    /api/workspaces/:id` row) 는 각각 **"트리거 자원 정리 — 미구현 (Planned)"** 를 명시적으로
    붙였고, `10-triggers.md` 자체도 "Schedule 삭제"·"Workflow·Workspace 삭제" 두 행에는 같은 태그를
    붙였다. 그런데 유독 "Trigger 직접 삭제" 행만 **비밀 정리 시점**을 태그 없이 서술해, 이 표만
    읽는 독자는 트리거 화면 삭제가 이미 "행 삭제 커밋 뒤 비밀 정리" 순서로 동작한다고 오해한다.
    그러나 SoT 인 `2-trigger-list.md` §4.3 은 정확히 반대(현재는 커밋 *전*)라고 명시하며, 커밋
    메시지도 *"비밀은 행 삭제가 **커밋된 뒤** 지운다(**트리거 삭제도 순서 반전**)"* 라고 적어 트리거
    직접 삭제 경로의 순서가 아직 안 뒤집혔음을 스스로 확인한다. 즉 같은 커밋 안에서 같은 사실에
    대해 한 문서는 "아직 아니다" 를, 다른 문서는 "이미 그렇다" 를 말한다 — 상태 전이(비밀 정리
    시점) 서술의 자기모순이다.
  - 영향: 이 developer plan 자체는 `plan/complete/spec-draft-deletion-releases-trigger-resources.md`
    와 `2-trigger-list.md` §4.3 을 SoT 로 명시했으므로 구현 착수에 실질적 장애는 없다(설계
    섹션이 이미 "순서 반전" 을 올바르게 반영). 다만 `data-flow/10-triggers.md` 를 참조하는
    제3자(다른 developer·차기 spec 독자)는 트리거 직접 삭제 경로가 이미 올바른 순서로 동작한다고
    오판할 수 있다.
  - 제안: `spec/data-flow/10-triggers.md` §1.4 의 "Trigger(type='schedule') 직접 삭제" 행에도
    "— 미구현 (Planned)" 또는 동등한 시제 정정을 추가해 형제 행 둘과 정합시킨다. 이 plan 은
    `spec_impact: none` 이라 developer 가 이 줄을 직접 고칠 권한이 없다 — 그 문장을 이 developer
    가 쓴 것도 아니므로 "자기-반증형 소정정" 예외(다섯 조건의 조건 1)도 적용되지 않는다. 별도
    `project-planner` 턴(짧은 spec 정정)으로 처리하거나, 이번 구현이 완료돼 실제로 순서가
    반전된 시점에 `--impl-done` 후속으로 이 행을 "구현 완료" 로 갱신하며 동시에 정정한다.

- **[INFO]** `Trigger.type = 'manual'` 행의 실행 결부 방식이 문서 간 서술되지 않음 (기존 상태,
  본 변경이 만든 gap 아님)
  - target 위치: `spec/2-navigation/2-trigger-list.md` 화면 목업·§2.1·§3(`POST /api/triggers` 가
    `webhook`/`manual` 타입 허용)·§4.2 (manual 타입 삭제 확인 문구)
  - 충돌 대상: `spec/data-flow/10-triggers.md` §1.1 (Manual trigger 시퀀스 — `execution.trigger_id
    = NULL` 로 고정, Trigger row 를 전혀 참조하지 않음) · `spec/4-nodes/7-trigger/1-manual-trigger.md`
    (캔버스의 "Manual Trigger 노드" 는 워크플로우당 1개, 자동 생성·삭제 불가 — Trigger DB row 와는
    별개 개념)
  - 상세: `2-trigger-list.md` 는 `type=manual` 인 `Trigger` row 가 트리거 목록에 실재 항목으로
    나타나고(이름·상태·연결 워크플로우 보유) API 로 생성·삭제 가능하다고 서술하는 반면,
    data-flow 문서의 "Manual 진입점" 시퀀스는 Run 버튼 실행이 어떤 Trigger row 도 참조하지
    않는다고(`trigger_id: NULL`) 명시한다. `type='manual'` Trigger row 가 실행 시점에 무엇과
    결부되는지(예: 어떤 API/UI 경로가 그 row 를 실제로 만들고, 만들어진 뒤 무엇이 그 row 를
    실행과 연결하는지) 이 트리거 삭제 자원 정리 스코프 안 어떤 문서에도 없다.
  - 제안: 이번 DRT-2 구현(삭제 경로 자원 정리)의 범위 밖이라 차단 사유는 아니다. 다만 향후
    `manual` 타입 트리거의 목적을 명확히 하는 spec 정비(별도 트랙)를 권장 — 특히 이번 삭제
    자원 정리가 "manual" 타입도 대상에 포함하는지(현재 코드는 타입 무관하게 동일 삭제 경로를
    타므로 포함될 것으로 보이나, 그 타입이 애초에 어떤 외부 자원을 갖는지 불명확하면 회귀 테스트
    설계 시 빈 케이스로 취급하기 쉽다) 확인해 둘 가치가 있다.

## 확인했으나 충돌 없음 (참고)

- RBAC: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스의 `Trigger | CRUD | CRUD | CRUD | R`
  (Owner/Admin/Editor 모두 CRUD) 은 `2-trigger-list.md` §4.1 삭제 권한 표(viewer 불가, editor+
  가능)와 정합한다. `Auth Config | CRUD | CRUD | R | R` (Editor 는 read-only) 도 §2.3.1 의
  "'+ 새 인증 설정 만들기' 는 Admin+ 전용" 근거 인용과 정확히 일치한다.
- 감사 액션명: `trigger.deleted` / `trigger.notification_secret_rotated` /
  `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked` 모두
  `1-auth.md` §4.1 기록 대상 액션 표에 등재돼 있고 `2-trigger-list.md` §3 API 표의 서술과 이름이
  일치한다.
- Cafe24 lock 선례 인용: `2-trigger-list.md` §3 의 *"Cafe24 토큰 갱신이 같은 락을 기각한 사유(lock
  보유 중 HTTP 요청이 DB 커넥션 점유를 늘린다)"* 는 `spec/2-navigation/4-integration.md` Rationale
  절의 실제 문구(*"lock 보유 중 HTTP 요청... 을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이
  늘고"*)와 정확히 대응한다 — 인용 정확.
- `secret-store.md` §2.1/§5.3/§6/R4, `1-data-model.md` §2.8 `secret_store.workspace_id` 서술,
  `data-flow/11-workflow.md`·`12-workspace.md` 의 "트리거 자원 정리 — 미구현 (Planned)" 주석은
  서로 시제·책임 소재가 일관되며 `2-trigger-list.md` §4.3 을 SoT 로 정확히 인용한다(위 WARNING
  대상인 `10-triggers.md` 한 행만 예외).
- EIA/Chat Channel: `EIA-AU-07`(per-trigger 토큰 삭제 시 자동 invalidate), `CCH-AD-03`(트리거
  삭제 시 `teardownChannel()` 필수 호출)은 정규 요구사항 서술이며 `2-trigger-list.md` §4.3 cascade
  표의 "Inbound interaction 토큰 — 별도 revoke 불필요" 서술과 모순되지 않는다.

## 요약

이번 변경(`2-trigger-list.md` §3/§4.3 의 "트리거 행을 없애는 모든 경로가 자원을 정리한다" 규칙)은
RBAC·감사 로그·EIA/Chat Channel 명세·Cafe24 lock 선례 인용과는 정합하며, 같은 커밋에서 갱신된
`secret-store.md`·`1-data-model.md`·`data-flow/11-workflow.md`·`data-flow/12-workspace.md` 도 이
규칙을 SoT 로 올바르게 인용한다. 다만 `data-flow/10-triggers.md` §1.4 표의 "Trigger 직접 삭제" 행
하나가 형제 행들과 다르게 "미구현 (Planned)" 태그 없이 비밀 정리 순서를 현재형으로 서술해,
2-trigger-list.md 가 명시한 "현재는 순서가 반대(비밀을 행 삭제 전에 지움)" 라는 사실과 어긋난다 —
이 developer plan 의 구현 착수 자체를 막지는 않지만(설계 섹션이 SoT 를 올바르게 참조), spec
정합을 위해 별도 정정이 필요하다. 그 외 `Trigger.type='manual'` 의 실행 결부 방식 미서술은 기존
갭으로 이번 스코프 밖이라 INFO 로만 남긴다.

## 위험도

LOW
