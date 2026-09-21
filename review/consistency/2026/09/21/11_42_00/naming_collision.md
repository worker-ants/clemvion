# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-done)

## 사전 확인

- **scope(`spec/2-navigation`) 델타: 0개 파일.** 이 브랜치(`integration-dup-delete-9e52a7`)는 `plan/in-progress/integration-dup-delete.md` (`spec_impact: none`)로, spec 문서를 변경하지 않는 순수 코드 수정 PR이다. 따라서 "target 문서가 새로 도입하는 식별자"는 spec 텍스트가 아니라 **구현 diff가 새로 도입한 식별자**로 검토 범위를 옮겼다 (프롬프트 경고: "델타 0 자체를 근거로 CRITICAL을 내지 말 것").
- 실제 구현 diff는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/integration-dup-delete-9e52a7`)에서 `git diff origin/main...HEAD`로 직접 재확인했다 (프롬프트 번들이 예산 초과로 diff 섹션을 절단했기 때문).

## 신규 식별자 목록 및 충돌 검토

### 1. `IntegrationsService.throwIntegrationNotFound()` (private method)

- **도입 위치**: `codebase/backend/src/modules/integrations/integrations.service.ts:613` — `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' })`를 던지는 7곳의 중복 리터럴을 통합한 헬퍼.
- **충돌 검토**: `grep -rn "throwIntegrationNotFound\|throwTriggerNotFound\|throwScheduleNotFound"` 결과, 동일 이름의 헬퍼가 다른 서비스에 이미 존재한다 — `TriggersService.throwTriggerNotFound()` (`triggers.service.ts:412`), `SchedulesService.throwScheduleNotFound()` (`schedules.service.ts:151`). 이번 신설은 그 **명명 패턴(`throw<Entity>NotFound`)을 그대로 따른 세 번째 사례**이며, 각 헬퍼는 서로 다른 클래스의 `private` 멤버라 이름공간이 겹치지 않는다. 의미도 동일(엔티티 not-found 표준화)하므로 **혼동 유발 요소 없음**.
- **판정**: 충돌 없음 — 오히려 기존 컨벤션을 정확히 준수.

### 2. `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (신규 파일)

- **충돌 검토**: `ls codebase/backend/test/ | grep delete-concurrency` 결과 이미 `workflow-delete-concurrency.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` · `trigger-delete-concurrency.e2e-spec.ts` · `schedule-delete-concurrency.e2e-spec.ts` 4개가 존재하며, 신규 파일은 그 형제 4건과 동일한 `<entity>-delete-concurrency.e2e-spec.ts` 명명 컨벤션을 따르는 다섯 번째 파일이다. 기존 파일과 경로가 겹치지 않고 컨벤션도 준수한다.
- **판정**: 충돌 없음.

### 3. 재사용된 기존 식별자 (신규 아님, 확인 목적으로 점검)

- 에러 코드 `RESOURCE_NOT_FOUND` — 신규 부여가 아니라 기존 코드를 그대로 재사용(`throwIntegrationNotFound` 도입 전부터 이 서비스에 있던 리터럴).
- 감사 액션 `AUDIT_ACTIONS.INTEGRATION_DELETED` / `integration.deleted` — 기존 액션 재사용. 새 이벤트/메시지명 아님.
- `IntegrationRepository.delete({ id, workspaceId })` — TypeORM 표준 API 호출로, 새 엔티티/DTO/인터페이스 도입 아님.

### 요구사항 ID · API endpoint · 이벤트명 · 환경변수 · 설정키

- 신규 요구사항 ID 없음 (spec 변경 없음, `spec_impact: none`).
- 신규 API endpoint 없음 — `DELETE /api/integrations/:id`는 기존 endpoint, 동작(원자적 delete 판정)만 내부 구현이 바뀌었다.
- 신규 webhook/queue/SSE 이벤트명 없음.
- 신규 ENV var·config key 없음.
- 신규 spec 파일 경로 없음 (spec 델타 0).

## 요약

이 PR은 spec 변경이 없는 순수 코드 수정(`spec_impact: none`)으로, 신규 식별자로 볼 수 있는 것은 private 헬퍼 메서드 `throwIntegrationNotFound()`와 e2e 테스트 파일 `integration-delete-concurrency.e2e-spec.ts` 두 가지뿐이다. 둘 다 grep으로 실측한 결과 각각 `triggers.service.ts`/`schedules.service.ts`의 `throw<Entity>NotFound()` 패턴과 `test/` 디렉터리의 `<entity>-delete-concurrency.e2e-spec.ts` 패턴을 정확히 따르는 형제 사례이며, 기존 사용처와 의미가 다르게 겹치는 경우는 발견되지 않았다. 재사용된 에러 코드·감사 액션도 기존 정의와 동일한 의미로만 쓰였다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
