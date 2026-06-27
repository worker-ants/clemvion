# 신규 식별자 충돌 검토 결과

검토 대상: `spec/data-flow` (diff-base: origin/main)
검토 시각: 2026-06-27

---

## 발견사항

### [WARNING] 신규 큐 `workspace-invitations-pruner` 가 마스터 BullMQ 카탈로그에 미등재

- **target 신규 식별자**: `workspace-invitations-pruner` (BullMQ 큐 이름), `WorkspaceInvitationsPrunerService` (TypeScript 클래스), `WORKSPACE_INVITATIONS_PRUNER_QUEUE` (상수)
- **기존 사용처 (충돌)**:
  - `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` §1.2 행: "현재 등록된 큐 **(16개)**" — 신규 큐 추가로 17개가 되어 숫자가 stale.
  - `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 표 — 16개 항목만 있으며 `workspace-invitations-pruner` 항목이 없음. 동 카탈로그는 "큐가 늘어나면 본 표와 해당 도메인 spec 의 `외부 의존` 섹션 모두 갱신한다" 및 `system-status.constants.ts` 의 `MONITORED_QUEUES` 는 **본 표를 SoT** 로 삼는다고 명시.
  - `/Volumes/project/private/clemvion/spec/data-flow/12-workspace.md` §4 외부 의존 표 — BullMQ 항목이 아예 없어 신규 큐가 누락.
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts` `MONITORED_QUEUES` — `workspace-invitations-pruner` 미등재(상단 주석 "data-flow/0-overview.md §4 카탈로그를 먼저 갱신하고 본 표를 동기화").
- **상세**: `spec/data-flow/12-workspace.md` 는 `WorkspaceInvitationsPrunerService` (매일 04:00 Asia/Seoul BullMQ repeatable job) 와 큐 이름 `workspace-invitations-pruner` 를 신규 도입하는 유일한 spec 문서지만, 카탈로그 SoT(`0-overview.md §4`)는 이 큐를 포함하도록 갱신되지 않았다. 즉 큐 identifier 가 두 문서 사이에서 불일치한다 — 카탈로그는 "16개" 라고 선언하고 코드는 17개를 등록한다.
- **제안**: `spec/data-flow/0-overview.md §1.2` 큐 개수를 17개로 갱신하고, §4 카탈로그에 `workspace-invitations-pruner | workspaces.module.ts | WorkspaceInvitationsPrunerService (daily 04:00 Asia/Seoul) | 동일 service (@Processor) | 만료·미수락 workspace_invitation 행 prune` 행을 추가한다. `spec/data-flow/12-workspace.md §4 외부 의존` 에도 BullMQ 항목을 추가한다. `MONITORED_QUEUES` 에 포함 여부는 별도 운영 결정이나, 포함한다면 `system-status.constants.ts` 와 `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 함께 갱신해야 한다.

---

### [INFO] `WorkspaceInvitationsPrunerService` 와 `WorkspaceInvitationsService` 명칭 유사성

- **target 신규 식별자**: `WorkspaceInvitationsPrunerService`
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` 의 `WorkspaceInvitationsService` (invitation CRUD 담당)
- **상세**: 두 클래스는 명확히 다른 역할이며 `Pruner` 접미사로 구분된다. 혼동 위험은 낮으나, `spec/data-flow/12-workspace.md` 가 "비즈니스 로직은 `WorkspaceInvitationsService.pruneExpired(now)`" 라고 설명해 어느 쪽이 실행 주체인지는 명확하다.
- **제안**: 현재 명명으로 충분. 추가 조치 불필요.

---

### [INFO] 기타 변경 식별자 — 충돌 없음

아래 식별자는 target 에서 변경됐으나 기존 사용처와 의미 충돌이 없다.

| 식별자 | 변경 내용 | 판정 |
| --- | --- | --- |
| `WH-SC-01` (spec/5-system/12-webhook.md) | 기존 요구사항 ID 에 v4 UUID CSPRNG 보안 설명 추가 — ID 재사용·의미 변경 없음 | 충돌 없음 |
| `WH-MG-02` (spec/5-system/12-webhook.md) | 기존 요구사항 ID 에 "서버가 @IsUUID('4') 강제" 설명 추가 — ID 재사용·의미 변경 없음 | 충돌 없음 |
| `spec/data-flow/10-triggers.md` Webhook UUID enforcement 문구 | "서버는 UUID 형식을 강제하지 않는다" → "서버가 v4 UUID 형식을 강제한다" 로 수정 — 코드 사실 정정, 신규 식별자 없음 | 충돌 없음 |

---

## 요약

target(`spec/data-flow`) 이 도입하는 신규 식별자(`workspace-invitations-pruner` 큐, `WorkspaceInvitationsPrunerService`, `WORKSPACE_INVITATIONS_PRUNER_QUEUE`)는 기존 큐·서비스 이름과 의미 충돌이 없다. 그러나 `spec/data-flow/0-overview.md §4` 가 BullMQ 큐 카탈로그의 SoT 로 선언되어 있고 해당 카탈로그가 갱신되지 않아, 카탈로그 정의("16개")와 실제 등록 큐 수(17개) 사이의 identifier-level 불일치가 발생한다. 이는 downstream 소비자(`MONITORED_QUEUES` 동기화, 운영 대시보드 등)가 신규 큐를 인지하지 못할 수 있는 WARNING 수준 omission 이다.

## 위험도

LOW
