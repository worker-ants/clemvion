# Plan 정합성 검토 결과

검토 모드: --impl-done, scope=spec/data-flow, diff-base=origin/main

---

## 발견사항

### [WARNING] W7 미해소 vs spec/data-flow/12-workspace.md 의 WorkspaceInvitationsPrunerService 구현 주장

- **target 위치**: `spec/data-flow/12-workspace.md` §1.2 rate-limit 각주 및 §3.1 상태 다이어그램
  - §1.2: "매일 04:00 Asia/Seoul 에 BullMQ repeatable 잡(`WorkspaceInvitationsPrunerService`)이 삭제한다 — `login-history-pruner` 와 동일 패턴(멀티 인스턴스에서 전역 1회). 비즈니스 로직은 `WorkspaceInvitationsService.pruneExpired(now)`."
  - §3.1: "만료(`expires_at < now`)되고 수락되지 않은(`accepted_at IS NULL`) row 는 `WorkspaceInvitationsPrunerService` (매일 04:00 Asia/Seoul, BullMQ repeatable job — §1.2)가 주기적으로 삭제한다."
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/trigger-review-deferred-fixes.md` 항목 W7 (미체크)
  - "WorkspaceInvitationsService.pruneExpired 프로덕션 호출자 없음 — 만료 초대 row 영구 잔존. `login-history-pruner` 패턴 BullMQ 연결 또는 기회적 purge."
- **상세**: target 은 `WorkspaceInvitationsPrunerService` 를 현재형 사실로 기술한다 ("삭제한다", "주기적으로 삭제한다"). 이는 구현된 BullMQ scheduler 가 존재한다고 주장하는 것이다. 반면 plan W7 은 `pruneExpired` 의 프로덕션 호출자가 없다고 명시하며 구현이 필요한 상태로 열려 있다. --impl-done 검토 모드에서 spec 이 구현 사실을 기술한다면 plan W7 이 이미 해소됐거나, spec 이 미구현을 현재형으로 오기술한 것이다.
- **제안**: 두 가지 중 하나.
  - (a) `WorkspaceInvitationsPrunerService` 가 이미 구현됐다면 plan W7 을 `[x]` 로 체크하고 구현 커밋/PR 참조를 기재한다.
  - (b) 아직 미구현이라면 target `spec/data-flow/12-workspace.md` §1.2·§3.1 에 "(Planned)" 마커를 추가해 현재형 사실 기술을 철회한다.

---

### [WARNING] W1 미해소 vs spec/data-flow/10-triggers.md Rationale 의 @IsUUID('4') 구현 주장

- **target 위치**: `spec/data-flow/10-triggers.md` §Rationale "Webhook `endpoint_path` 의 UNIQUE 범위"
  - "**서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제한다**(`@IsUUID('4')` — `create-trigger.dto.ts`·`update-trigger.dto.ts`)"
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/trigger-review-deferred-fixes.md` 항목 W1 (미체크)
  - "trigger `endpoint_path` 가 클라이언트 생성(`crypto.randomUUID()`) + 서버 UUID 형식 미강제 — 예측 가능 값 직접 지정 가능. 서버 강제 발급 또는 DTO `@IsUUID(4)` 검증. (data-flow/10-triggers.md §Rationale 에 현황 기술됨)"
- **상세**: target spec 은 `@IsUUID('4')` 를 이미 시행 중인 사실로 기술한다. plan W1 은 여전히 미체크 상태이나, 그 메모 란에 "(data-flow/10-triggers.md §Rationale 에 현황 기술됨)" 라고 명시돼 있어 spec 이 현황을 기술하고 있음을 plan 작성자가 이미 인지했다. spec 이 `@IsUUID('4')` 를 구현 사실로 기술하는 이상, W1 은 사실상 해소된 상태일 가능성이 높다. 그러나 plan 체크박스가 미체크인 채로 남아 있어 추적상 혼란을 일으킨다.
- **제안**: `create-trigger.dto.ts`·`update-trigger.dto.ts` 에 `@IsUUID('4')` 장식자가 실제로 존재한다면 plan W1 을 `[x]` 로 체크한다. spec 기술이 선제적이어서 코드에 아직 없다면 target spec 의 해당 문장을 "(Planned)" 로 조건화하거나, W1 이 해당 이 worktree 에서 구현됐음을 plan 에 명시한다.

---

### [INFO] spec-sync-data-flow-12-workspace-gaps.md 의 4개 미결정과 target 일관성

- **target 위치**: `spec/data-flow/12-workspace.md` §1.5, §Rationale "X-Workspace-Id 헤더 우선 정책", §Rationale "personal 워크스페이스 유일성", §4 외부 의존 (audit 범위)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` 결정 1~4 (전부 미확정)
- **상세**: 네 미결정 항목(워크스페이스 전환 모델·JWT 클레임명·DB UNIQUE 강제·audit 적재 범위)에 대해 target spec 은 plan 이 기술한 현재 상태를 그대로 반영하고 있다 — §1.5 는 "미구현 (Planned)" 로 마킹돼 있고, JWT 클레임은 `workspaceId` 로 명시되어 있으며, DB 레벨 강제는 언급 없고 앱 레이어 로직만 기술, audit 범위는 `transfer_ownership` 1건만 언급한다. 일방적 결정 우회는 없다. plan 의 "결정 옵션" 권장안(옵션 A·A·B·B)이 target 에 선반영되지 않아 충돌이 없다.
- **제안**: 이 점에서 충돌 없음을 확인. 추적 메모로만 기록.

---

### [INFO] spec-sync-data-flow-8-notifications-gaps.md 의 미구현 항목 추적 필요

- **target 위치**: `spec/data-flow/8-notifications.md` (prompt 내 전문 미포함으로 직접 검토 불가)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` — `notify()` 단일 표면·이메일 발송 경로·`email_sent_at` setter·WebSocket emit·`execution_failed`·`schedule_failed`·`team_invite` 발사 7건 미체크
- **상세**: target scope 에 `spec/data-flow/8-notifications.md` 가 포함된다. 이 파일의 전문이 제공된 payload 에 없어 직접 충돌을 확인하지 못했다. plan 의 미구현 항목들이 target spec 에서 현재형 사실로 기술됐다면 추가 WARNING 이 발생한다.
- **제안**: `spec/data-flow/8-notifications.md` 를 직접 열람해, plan 의 7개 미구현 항목이 spec 에서 현재형으로 기술됐는지 확인한다. 발견 시 해당 문장에 "(Planned)" 를 추가하거나 plan 을 체크한다.

---

## 요약

Plan 정합성 관점에서 두 건의 명확한 WARNING 이 존재한다. 첫째, `spec/data-flow/12-workspace.md` 가 `WorkspaceInvitationsPrunerService` 를 운영 중인 BullMQ 스케줄러로 현재형 기술하지만, `trigger-review-deferred-fixes.md` W7 은 `pruneExpired` 의 프로덕션 호출자가 없다고 열려 있어 spec-vs-plan 불일치가 발생한다. 둘째, `spec/data-flow/10-triggers.md` Rationale 이 `@IsUUID('4')` 를 이미 구현된 사실로 기술하지만, W1 plan 항목은 여전히 미체크다(단 plan 메모에 "현황 기술됨" 으로 spec 인지를 이미 기록한 상태). 두 경우 모두 코드 현실을 확인해 plan 체크박스를 갱신하거나 spec 에 "(Planned)" 마커를 추가하는 것으로 해소된다. 미결 결정(워크스페이스 전환·audit 범위 등)은 target spec 이 plan 의 unresolved 상태를 그대로 유지하고 있어 일방적 결정 우회는 없다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
