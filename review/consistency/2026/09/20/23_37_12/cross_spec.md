# Cross-Spec 일관성 검토 — `spec/2-navigation` (--impl-prep, schedule-dup-delete)

## 컨텍스트

대상 plan(`plan/in-progress/schedule-dup-delete.md`, `spec_impact: none`)은 `SchedulesService.remove()`
가 동시 DELETE 두 건에서 `schedule.deleted` 감사 행을 두 번 남기는 결함을 고치는 **코드 전용** 수정이다.
같은 결함 클래스를 워크플로(#1369)·트리거(#1370)에서 이미 고쳤고, 두 PR 모두 `spec_impact: none` 이었다
— spec 문구를 바꾸지 않고 기존에 문서화된 동작(동시 삭제 시 패자는 404)을 코드가 실제로 지키게 만드는
정정이었다. 이번 검토는 그 선례가 이번 자리에서도 다른 spec 영역과 모순 없이 성립하는지를 확인한다.

## 확인한 사실 (spec 파일 직접 대조)

- **감사 액션 명명**: `schedule.deleted` 는 [`spec/data-flow/1-audit.md`](/Volumes/project/private/clemvion/.claude/worktrees/schedule-dup-delete-6c81d4/spec/data-flow/1-audit.md) 의 SoT 표(L100)에 `schedules/schedules.service.ts` 소유로 이미 등재돼 있다. plan 은 새 액션 ID 를 만들지 않고 기존 명명을 그대로 쓴다 — 요구사항/액션 ID 충돌 없음.
- **FK CASCADE 방향**: [`spec/1-data-model.md` §2.9](.../spec/1-data-model.md#L303-L304) 는 `Schedule.trigger_id → Trigger (CASCADE)` 를 명시하고, §2.9.1(L323-L324)은 "Trigger(type=schedule) 삭제 → 연결된 Schedule cascade 삭제"를 명시한다. plan §B 의 핵심 통찰("트리거를 지우면 스케줄 행도 DB 가 함께 지운다")과 정확히 일치 — 데이터 모델 충돌 없음.
- **책임 분할**: `spec/2-navigation/2-trigger-list.md` frontmatter 는 `trigger-config-lock.ts` 를 "소비자가 chat-channel·notification·EIA·schedules 에 걸쳐 있어 트리거 문서가 SoT로 문다"는 주석과 함께 **트리거 문서에만** 등재하고, `3-schedule.md` 에는 중복 등재하지 않는다. `SchedulesService.remove()` 가 동일 advisory key(`trigger-config:<id>`)를 락 안에서 재사용하는 것은 이 기존 계층 분할과 부합한다 — 계층 책임 충돌 없음.
- **RBAC**: 스케줄 행 액션(토글/수정/삭제)의 `editor` 이상 게이트는 트리거 삭제 권한 매트릭스([`2-trigger-list.md` §4.1](#))와 동일한 역할 체계를 쓴다. plan 은 권한 로직을 건드리지 않는다 — RBAC 모델 충돌 없음.

## 발견사항

- **[INFO]** `3-schedule.md` 에는 트리거 문서와 대칭되는 "동시 삭제" 결과 문구가 없다
  - target 위치: `spec/2-navigation/3-schedule.md` §4 API (`DELETE /api/schedules/:id` 행, 부가 설명 없음)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §4.4 결과·에러 ("동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")
  - 상세: 이번 PR 이 완료되면 스케줄 삭제도 트리거와 동일한 `[204, 404]` + 감사 1건 보장을 갖게 되는데, `3-schedule.md` 는 이 보장을 텍스트로 서술하지 않는다. 모순은 아니다 — 침묵일 뿐이고, 직전 두 PR(#1369, #1370)도 이미 문서화된 동작을 코드가 사후에 따라잡는 형태였지, 스케줄 쪽은 애초에 그 문장이 없었다. `spec_impact: none` 결정과 상충하지 않으며 이 PR 의 범위를 넓히라는 뜻은 아니다.
  - 제안: 차단 사유 아님. 후속 spec 정비 PR(예: 이미 존재하는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커, `2-trigger-list.md` frontmatter `pending_plans` 참조)에서 두 화면의 삭제 결과·에러 서술을 대칭으로 맞추는 것을 권장.

## 요약

`spec/2-navigation` 번들(워크플로 목록·트리거 목록·스케줄) 과 참조되는 `spec/1-data-model.md`(§2.9/§2.9.1 Schedule↔Trigger CASCADE) · `spec/data-flow/1-audit.md`(액션 명명 SoT) · `spec/data-flow/10-triggers.md`(Schedule↔Trigger 동기화 데이터 흐름) 를 직접 대조한 결과, 이번 `schedule-dup-delete` 작업 범위에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 CRITICAL/WARNING 급 모순을 찾지 못했다. plan 이 코드 전용(`spec_impact: none`)이며 감사 액션 명명·FK CASCADE 방향·advisory lock 소유 문서 모두 기존 spec 과 정합하고, 동일 결함 클래스를 이미 두 번(#1369 워크플로, #1370 트리거) 같은 방식(spec 불변)으로 닫은 선례가 이 세 번째 자리에도 그대로 적용된다. 유일한 발견은 트리거 문서와 스케줄 문서 사이의 "동시 삭제 결과" 서술 비대칭(INFO)으로, 차단 사유가 아니라 향후 동기화 권장 사항이다.

## 위험도

NONE
