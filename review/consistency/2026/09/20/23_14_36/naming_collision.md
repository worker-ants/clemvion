# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-done)

## 실측 근거

- `git diff origin/main --stat` — 이 브랜치는 `spec/2-navigation/**` 를 전혀 건드리지 않는다
  (spec 델타 0개 파일, `plan/in-progress/trigger-dup-delete.md` frontmatter 도
  `spec_impact: none` 으로 명시). 따라서 "target 문서가 새로 도입하는 요구사항 ID·엔티티명·
  endpoint" 자체가 없다 — 이번 검토는 **구현 diff(3파일)가 코드에 새로 심은 식별자**가
  `spec/2-navigation` 및 인접 spec 의 기존 사용처와 충돌하는지를 대신 확인했다.
- 실제 diff 확인 (워킹트리 절대경로, `git diff origin/main --`):
  - `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 안에 지역 변수
    `fresh` 추가 + advisory lock 획득 후 재조회 + `.catch` 안 `NotFoundException` 분기.
  - `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 신규 테스트 2건 +
    지역 변수 `freshFindOptions`.
  - `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` — 신규 파일.
  - 그 외 `CHANGELOG.md`, `plan/in-progress/*.md` 두 건, `review/**` 산출물(신규 식별자 대상 아님).

## 발견사항

- **[INFO]** 신규 파일명은 형제 관례를 그대로 따름 — 충돌 없음
  - target 신규 식별자: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`
  - 기존 사용처: 같은 디렉터리의 `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`,
    `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` (직전 PR, `dup-delete-audit`
    계열)
  - 상세: `<entity>-delete-concurrency.e2e-spec.ts` 명명 패턴을 `trigger` 로 그대로 확장한 것으로,
    새 컨벤션을 만들거나 기존 파일과 경로가 겹치지 않는다. `spec/2-navigation/2-trigger-list.md`
    frontmatter `code:` 목록에도 이미 이 파일이 사전 등재돼 있어(§4.3/§4.4 시행 코드) spec↔code
    참조가 일관된다.
  - 제안: 없음 — 그대로 유지.

- **[INFO]** 재사용된 식별자만 있고 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV 는 없음
  - target 신규 식별자: (해당 없음)
  - 기존 사용처: `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`trigger-config-lock.ts:128`, 사전 존재),
    `triggerConfigLockKey()`(`trigger-config-lock.ts:25`, 사전 존재),
    `throwTriggerNotFound()`(`triggers.service.ts:412`, 사전 존재 헬퍼 — 이번에 1084행에서
    한 번 더 호출), `trigger.deleted` audit action(사전 존재), `RESOURCE_NOT_FOUND` 에러 코드
    (사전 존재)
  - 상세: 이번 diff 는 advisory lock 획득 뒤 "행이 아직 있는가" 를 확인하는 재조회 한 줄과
    `NotFoundException` 분기만 추가했다. 새 API endpoint, 새 요구사항 ID, 새 DTO/엔티티명, 새
    webhook/queue/SSE 이벤트명, 새 환경변수·config key 는 도입되지 않았다 — 전부 기존에 정의된
    상수·헬퍼·에러코드를 그대로 재사용한다. 지역 변수 `fresh`(서비스 메서드 스코프) ·
    `freshFindOptions`(테스트 헬퍼 스코프)는 함수 로컬이라 전역 식별자 공간과 충돌 여지가 없다.
  - 제안: 없음 — 신규 식별자 충돌 대상 자체가 없다.

## 요약

이 PR 은 `spec/2-navigation` 문서를 전혀 변경하지 않는 코드 전용 수정(`spec_impact: none`)이며,
구현 diff 3파일(268줄) 중 신규로 도입된 것은 파일 하나(`trigger-delete-concurrency.e2e-spec.ts`,
직전 PR 들이 세운 `<entity>-delete-concurrency.e2e-spec.ts` 명명 관례를 그대로 따름)뿐이고
그 외에는 함수 스코프 지역 변수 추가와 기존 상수·헬퍼·에러코드(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`,
`triggerConfigLockKey`, `throwTriggerNotFound`, `trigger.deleted`, `RESOURCE_NOT_FOUND`)의
재사용뿐이다. 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·spec 파일 경로
중 어느 것도 신설되지 않았으므로 신규 식별자 충돌 관점에서 지적할 항목이 없다.

## 위험도

NONE
