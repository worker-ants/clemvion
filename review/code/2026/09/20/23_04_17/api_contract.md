# API 계약(API Contract) 리뷰

## 검토 방법

`DELETE /api/triggers/:id`(`codebase/backend/src/modules/triggers/triggers.controller.ts:175-193`)의
동시 삭제 이중 감사 수정을 API 계약 관점에서 재확인했다. 이번 라운드(`23_04_17`)의 실질 diff 는
①단위 테스트에 `workspaceId` 스코프 단언 추가(`triggers.service.spec.ts`), ②genuine 실패 시
`logger.error` 호출 단언 추가(같은 파일), ③`CHANGELOG.md` 항목 신설, ④plan 문서(tracker·
`trigger-dup-delete.md`) 갱신뿐이다. `triggers.service.ts` 의 실제 프로덕션 코드 변경(락 안
재조회 `m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })` → `!fresh` 시
404)과 신규 e2e(`trigger-delete-concurrency.e2e-spec.ts`)는 이전 두 라운드(`review/code/2026/09/20/22_07_23`,
`review/code/2026/09/20/22_39_21`)에서 이미 API 계약 관점 NONE 으로 결론 낸 것과 동일한 내용이라 —
새 엔드포인트·새 요청/응답 스키마·새 에러 코드는 이번 diff 어디에도 없다.

컨트롤러(`triggers.controller.ts:175-186`)를 직접 열어 다음을 재확인했다:
- `@Roles('editor')` 인가 데코레이터, `@ApiUnauthorizedResponse`/`@ApiForbiddenResponse`/`@ApiNotFoundResponse` 문서화 — 모두 기존 그대로, 이번 diff 밖.
- `throwTriggerNotFound()`(`triggers.service.ts:412-417`)는 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' })` — 이번에 새로 추가된 락 안 재조회 실패 경로도 이 기존 헬퍼를 그대로 재사용해 새 에러 스키마를 만들지 않는다.
- `spec/2-navigation/2-trigger-list.md` §4.4: "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" — 이번 수정이 만드는 동작과 정확히 일치. 즉 이 PR 은 새로운 계약을 만드는 것이 아니라 **이미 문서화된 계약을 코드가 지금까지 어기고 있던 것을 고친 것**이다.

## 발견사항

- **[INFO]** 동시 DELETE 패자 응답이 `204`→`404`로 바뀌는 것은 신규 breaking change 가 아니라 기존 spec 계약 충족
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1094, 신규 재조회 블록)
  - 상세: 일반 REST 관행상 DELETE 재호출도 `204`(멱등)로 처리하는 것이 흔하지만, 이 프로젝트는 `spec/2-navigation/2-trigger-list.md §4.4`에서 명시적으로 "두 번째 요청은 404"를 계약으로 정했다. 이전 코드는 advisory lock 이 행 재존재를 확인하지 않아 이 계약을 어기고 둘 다 `204`를 반환했다(감사 행도 중복 기록). 이번 diff 는 그 gap을 닫았을 뿐 새 계약을 도입한 것이 아니다. 형제 두 엔드포인트(워크플로/워크스페이스 삭제)도 이미 같은 패턴으로 고쳐져 있어 일관성도 확보된다.
  - 제안: 조치 불필요. (참고: 클라이언트가 "동시 삭제 시 둘 다 204"라는 관찰된—그러나 spec 에 반하는—과거 동작에 우연히 의존했다면 영향을 받을 수 있으나, 이는 버그에 의존한 것이라 정상적인 하위 호환성 이슈로 취급하지 않는다.)

- **[INFO]** 이번 라운드의 실질 diff(테스트·CHANGELOG·plan)는 API 표면에 영향 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (게이트 4035-4064, 4135-4156), `CHANGELOG.md`
  - 상세: 신규 단위 테스트 두 건은 이미 구현된 동작(`workspaceId` 스코프 재조회, genuine 실패 로그)을 사후 검증하는 것으로, 요청/응답 스키마·상태 코드·URL·인증 로직 어느 것도 바꾸지 않는다. `CHANGELOG.md` 항목도 문서 추가일 뿐이다.
  - 제안: 조치 불필요.

- **[INFO]** 스코프 밖 잔여(`SchedulesService.remove()`)는 이번 PR 의 API 계약을 훼손하지 않음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 4773-4783)
  - 상세: 이 PR 이 트리거 계약(§4.4)만 닫고 `SchedulesService.remove()` 자신의 스케줄 행 삭제 경로는 같은 결함을 여전히 갖고 있음을 트래커에 신규 developer 항목으로 정확히 등재했다 — 범위 축소를 숨기지 않았다. `DELETE /api/schedules/:id` (또는 관련 엔드포인트)의 동시 삭제 응답 계약은 이번 diff 대상이 아니므로 이 리뷰의 판정에는 포함하지 않는다.
  - 제안: 조치 불필요(추적 중, 별도 후속 PR 대상).

WARNING/CRITICAL 없음.

## 뮤테이션 검증

가설 확인을 위한 코드 뮤테이션은 수행하지 않았다 — 컨트롤러·서비스·spec 문서를 정적으로 대조하는 것으로 결론에 충분했다. 저장소 파일은 읽기만 했다(`git status --short` 변화 없음).

## 요약

이번 diff 는 `DELETE /api/triggers/:id` 의 동시 요청 경합에서 advisory lock 획득 후 행 재존재를 확인하지 않아 패자 요청도 `204`를 반환하고 `trigger.deleted` 감사를 중복 기록하던 결함을, 락 획득 뒤 명시적 재조회(`workspaceId` 스코프 유지) → 부재 시 기존 `RESOURCE_NOT_FOUND`(`404`) 에러 포맷 재사용으로 고쳤다. 이는 `spec/2-navigation/2-trigger-list.md §4.4`에 이미 문서화된 계약("두 번째 요청은 404")을 코드로 실제 충족시킨 것이며, 컨트롤러의 Swagger 문서(`@ApiNotFoundResponse`)도 변경 없이 이 케이스를 포괄해 문서-구현 drift 가 없다. 새 엔드포인트·요청/응답 스키마·에러 코드·API 버전 변경은 없고, 인가(`@Roles('editor')`, `workspaceId` 스코프)도 재조회 지점에서 그대로 유지된다. 이번 라운드(`23_04_17`)의 실질 diff(단위 테스트 2건, CHANGELOG, plan 문서)는 API 표면에 아무 영향을 주지 않는다. 스코프 밖으로 남긴 `SchedulesService.remove()` 잔여는 트래커에 정확히 등재돼 있어 은폐된 축소가 아니다. API 계약 관점에서 지적할 결함을 찾지 못했다.

## 위험도

NONE
