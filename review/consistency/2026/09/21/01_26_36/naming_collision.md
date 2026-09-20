# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-done, schedule-dup-delete)

## 전제 확인

- `spec/2-navigation` 델타: **0개 파일**. 이 PR 은 spec 문서를 바꾸지 않았고 (`plan/in-progress/schedule-dup-delete.md` frontmatter `spec_impact: none`), 따라서 target 문서가 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV 키·spec 파일 경로는 **없다**. 아래는 구현 diff(`codebase/backend/src/modules/schedules/schedules.service.ts` 등 3파일/433줄)가 실제로 도입하는 식별자를 워킹트리 절대경로로 확인한 결과다.

## 발견사항

없음. 도입된 신규 식별자를 전수 확인했으나 기존 사용처와 다른 의미로 충돌하는 사례를 찾지 못했다.

### 확인한 신규 식별자와 근거

- **`SchedulesService.throwScheduleNotFound()`** (신규 private 메서드, `schedules.service.ts:151`) — `git -C <worktree> grep` 결과 이 이름은 저장소 전체에서 이 파일에만 존재한다. 형제 서비스 `triggers.service.ts` 의 기존 `throwTriggerNotFound()` 패턴(`triggers.service.ts:412`)을 그대로 따른 명명이며, 두 메서드 모두 각자 클래스의 `private` 스코프라 이름이 같아도 실제로는 충돌하지 않는다 — `throwScheduleNotFound` 는 그것과도 다른 이름이라 애초에 동명이 아니다.
- **에러 코드 `RESOURCE_NOT_FOUND`** — 새로 도입된 코드가 아니라 `http-exception.filter.ts` / `error-response.dto.ts` 에 이미 정의된 전역 404 코드를 그대로 재사용한다.
- **감사 액션 `AUDIT_ACTIONS.SCHEDULE_DELETED`** — 기존 enum 값을 그대로 사용(신규 액션명 아님). `schedules.service.ts:385`.
- **신규 e2e 파일 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`** — 파일 경로 컨벤션을 확인한 결과 동일 패턴의 형제 파일(`workflow-delete-concurrency.e2e-spec.ts`, `trigger-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)이 이미 존재해, 새 파일은 그 명명 컨벤션(`<entity>-delete-concurrency.e2e-spec.ts`)을 정확히 따른다. 기존 파일과 경로가 겹치지도 않는다.
- **plan 파일 `plan/in-progress/schedule-dup-delete.md`** — `plan/` 전체에서 유일한 경로, 기존 문서와 겹치지 않는다.
- API endpoint·환경변수·webhook/queue/sse 이벤트명은 이 diff 에서 신규로 추가된 것이 없다(기존 `DELETE /api/schedules/:id` 내부 판정 로직만 변경).

## 요약

이번 변경은 `spec/2-navigation` 에 어떤 신규 식별자도 도입하지 않는 코드 전용 버그 수정(spec_impact: none)이며, 구현 diff 가 실제로 추가한 유일한 신규 식별자(`throwScheduleNotFound` 사설 메서드, 신규 e2e 파일 경로)는 모두 이미 확립된 형제 패턴(`throwTriggerNotFound`, `<entity>-delete-concurrency.e2e-spec.ts`)을 그대로 따르고 있어 기존 사용처와 의미 충돌이나 명명 혼동을 일으키지 않는다. 신규 식별자 충돌 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
