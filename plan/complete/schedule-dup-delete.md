---
title: 스케줄 동시 DELETE 도 감사 행을 두 번 남긴다 — CASCADE 때문에 판정 기준이 다르다
status: complete
owner: developer
worktree: schedule-dup-delete-6c81d4
started: 2026-09-20
completed: 2026-09-21
spec_impact: none
---

# `SchedulesService.remove()` — 같은 결함 클래스의 네 번째 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다» (2026-09-20 등재 ·
`/ai-review` `review/code/2026/09/20/22_07_23` requirement WARNING 2)를 닫는다.

직전 세 PR(#1369 워크플로·워크스페이스, #1370 트리거)이 같은 결함 클래스를 닫았고, **그 PR 들이
«마지막» 이라고 적을 때마다 리뷰가 남은 자리를 찾아냈다.** 그래서 이번엔 착수 전에 전수로 셌다 —
`grep -rn "AUDIT_ACTIONS\..*_DELETED" codebase/backend/src/modules`(spec 제외):

| 자리 | 상태 |
| --- | --- |
| `workflows.service.ts` `WORKFLOW_DELETED` | #1369 에서 닫힘 |
| `triggers.service.ts` `TRIGGER_DELETED` | #1370 에서 닫힘 |
| `schedules.service.ts` `SCHEDULE_DELETED` | **이 PR** |
| `integrations.service.ts` `INTEGRATION_DELETED` | **남는다** — 아래 |
| (워크스페이스 삭제) | 삭제 감사를 **애초에 남기지 않는다**(#1369 리뷰가 확인) |

**그래서 이 PR 도 «마지막» 이 아니다.** `IntegrationsService.remove()` 는 잠금 없는 `findOne` → 사용처 검사
→ `repository.remove(entity)`(0행이어도 안 던진다) → 감사 순서라 **같은 중복이 난다**. 락이 아예 없어 처방도
다르므로(원자적 `delete` 의 `affected` 로 판정) 이 PR 에 끼우지 않고 **트래커에 등재**한다.

## A. 결함 — 여기는 «락 안» 이 아니라 **락 밖**이 문제다

`SchedulesService.remove()` 의 순서(실측):

1. `findById(id, workspaceId)` — **잠금 없음**. 동시 두 요청이 모두 통과한다.
2. `scheduleRunnerService.removeJob(schedule.id)` — BullMQ 해제(되돌릴 수 없다).
3. `triggerId` 가 있으면 트랜잭션: advisory lock → `m.delete(Trigger, triggerId)`.
   **반환값(`affected`)을 쓰지 않는다.**
4. `deleteTriggerSecretsAfterCommit([triggerId])`.
5. **`scheduleRepository.remove(schedule)` — 트랜잭션·락 밖.**
6. `recordAudit(SCHEDULE_DELETED)`.

두 요청이 겹치면 3의 락이 줄을 세우지만, 진 쪽의 `m.delete` 는 **0행이어도 던지지 않고** 그대로 5·6 으로
간다 → `schedule.deleted` 감사가 두 번 남는다.

## B. 판정 기준을 잘못 고르면 **양쪽 다 404** 가 된다

`schedule.trigger_id → trigger` 는 `onDelete: 'CASCADE'` 다(엔티티 실측). 즉 **트리거를 지우면 스케줄 행도
DB 가 함께 지운다** — 그래서 5번 `remove(schedule)` 은 triggerId 가 있는 경로에서 이미 0행이다(이긴 쪽도).
«스케줄 행을 몇 행 지웠나» 를 판정 기준으로 삼으면 **이긴 쪽도 404** 가 된다. 이 함정이 이 항목의 핵심이다.

올바른 판별자는 **락 안에서 트리거를 실제로 지웠는가** 다:

```
[락 밖]  BullMQ job 해제 (되돌릴 수 없다)
[락 안]  advisory lock (trigger-config:<triggerId>)
         m.delete(Trigger, triggerId) 의 affected 를 **본다**
         0 이면 404 — 이미 다른 요청이 지웠다 (감사·비밀 정리 없음)
```

`triggerId` 가 없는 방어 분기(엔티티상 NOT NULL 이라 현재 도달 불가)는 스케줄 행 자체의 `affected` 로 본다 —
그 경로에는 CASCADE 가 개입하지 않으므로 판정이 유효하다.

## C. 재현을 먼저 한다

앞 세 PR 과 같다 — 고치기 전 상태를 값으로 본 뒤 고친다. 겹침은 테스트가 **트리거 advisory key** 를 쥐어
만든다(스케줄 삭제도 그 키로 잠그므로 형제 PR 의 기법이 그대로 쓰인다).

- 단언: 상태쌍 `[204, 404]` + `audit_log` 의 `schedule.deleted` **1건**.
- 락 대기 상한이 5초라 테스트가 쥐는 시간은 1.5초.

## 이 PR 이 하지 않는 것

- **BullMQ `removeJob` 중복**(2번)은 그대로 둔다 — 두 요청 모두 락 밖에서 부른다. 형제 PR 들의 «외부 해제
  중복» 과 같은 잔여이고, 고치려면 외부 호출을 락 안에 넣어야 한다(금지된 형태).
- **`IntegrationsService.remove()`** — 위 표의 남는 자리. 락이 없어 처방이 다르고(원자적 `delete` +
  `affected`), 서비스도 다르다. 트래커에 등재한다.
- **공용 헬퍼 추출**은 트래커의 «네 자리 공용 형태» 설계 항목이 받는다. 이 PR 은 이 자리를 같은 형태로
  맞추는 것까지다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/20/23_37_12` **BLOCK: NO**
  (Critical 0 · Warning 4). W1·W2 는 **산문 약속을 상태로 바꾸라**는 지적이었다 — 이 저장소가 세 번 잃은
  형태라 그 자리에서 바로 등재했다(아래 두 체크박스). W3·W4 는 기존 오픈 항목이 이미 덮는다
- [x] 트래커에 `IntegrationsService.remove()` 등재 — **grep 으로 확인**(0건 → 1건)
- [x] 트래커의 «동시 삭제 404 문서 격차» 스코프에 `3-schedule.md` §4 추가
- [x] **e2e 로 결함 재현** — `[204, 204]` 로 RED 였고, DB 를 직접 조회해 `schedule.deleted` 가 한 `resource_id` 에
  **2건**임을 확인했다
- [x] 단위 테스트 + 구현 — 락 안 `m.delete(Trigger, …)` 의 `affected` 를 판별자로, `.catch` 에서 404 분리.
  방어 분기(`triggerId` 없음)는 스케줄 행 자체의 `affected` 로 가른다. 유효 뮤턴트(184자만 제거)가 새 테스트
  하나만 죽인다. 기존 셋은 계약 변화(`delete` 가 `affected` 를 돌려준다)에 맞춰 fixture 를 고쳤다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · **e2e 371 PASS**
  - **`build` 가 spec 파일의 타입 오류를 잡았다**: 타입체크 ratchet 이 `{ affected: 0 }` 를 `DeleteResult` 로
    받지 못한다고 보고했다(baseline 0 → 1). jest 는 타입을 strip 하고 `nest build` 는 `*.spec.ts` 를 exclude 하므로
    **이 검사 말고는 아무도 못 보는 자리**다 — 이 세션에서 build 가 타입 오류를 잡은 두 번째 사례다
- [x] `/ai-review` 4라운드 — `00_06_01`(W4→4/4) · `00_37_06`(W2→2/2) · `00_56_52`(W1→1/1) ·
  `01_16_46`(W1, **`codebase/**` 수정 0** 으로 수렴). 3라운드 지적이 가장 정교했다: 코드가 맞느냐가 아니라
  «그렇게 쓴 **이유**가 테스트에 붙들려 있느냐» 를 물었고, 뮤턴트 생존(32건 전건 GREEN)으로 실증했다
- [x] `/consistency-check --impl-done spec/2-navigation` — `review/consistency/2026/09/21/01_26_36`
  **BLOCK: NO** (Critical 0 · Warning 0, 전 checker NONE). INFO 3건은 전부 «이미 추적 중» 이거나
  판정 기준 편차의 정당성 확인이다
- [x] 트래커 항목 해소 + 이 plan `plan/complete/` 로
