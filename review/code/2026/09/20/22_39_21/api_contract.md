# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 패자의 응답이 `204`→`404`로 바뀌는 것은 기존에 문서화된 계약을 뒤늦게 충족시키는 것이며 신규 breaking change 가 아니다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1094` (게이트 기준, `const fresh = await m.findOne(...)` ~ `if (!fresh) this.throwTriggerNotFound();`)
  - 상세: `spec/2-navigation/2-trigger-list.md:318` 이 "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 를 이미 정의하고 있었다. 이번 diff 이전에는 advisory lock 이 행 존재를 재확인하지 않아 실제로는 두 요청 모두 `204`를 반환하는 버그가 있었고(plan 파일들이 e2e 로 `[204, 204]`를 실측), 이번 변경은 코드를 spec 서술에 맞춘 것이다. 정상적인 단일 요청(경쟁이 없는 경우) 클라이언트에는 아무 영향이 없고, 오직 동시에 같은 자원을 지우는 레이스 상황에서 패자만 영향을 받는다.
  - 제안: 조치 불요. 다만 API 클라이언트 문서/가이드에 "동시 DELETE 시 한쪽은 404 를 받을 수 있다"는 안내가 프런트엔드/외부 연동 문서에 없다면 documentation reviewer 영역에서 별도 확인 권장(이미 `1-workflow-list.md`/`data-flow/12-workspace.md` 쪽 대칭 서술 누락이 별도 트래커 항목으로 등재되어 있음 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 참조).

- **[INFO]** 재확인(refetch) 및 404 응답이 기존 에러 스키마·인가 스코프를 그대로 재사용해 신규 계약 표면이 생기지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:412-416`(`throwTriggerNotFound()`, diff 밖 기존 코드) 및 `:1090-1093`(재조회 where 절)
  - 상세: `throwTriggerNotFound()`는 기존에 `findById` 등 다른 4개 지점에서 이미 쓰이던 `{ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }` 포맷을 그대로 재사용한다 — 신규 에러 코드나 응답 필드가 추가되지 않았다. 재조회 조건도 `where: { id, workspaceId }`로 최초 `findById`와 동일한 워크스페이스 스코프를 유지해, 락 안 재조회가 다른 워크스페이스 소속 행의 존재 여부를 유출하는 통로가 되지 않는다. 컨트롤러(`triggers.controller.ts:175-190`)의 `@Roles('editor')`, `@HttpCode(HttpStatus.NO_CONTENT)`, `@ApiNotFoundResponse`, `@ApiNoContentResponse` Swagger 문서도 이번 diff 로 변경되지 않았고 실제 동작과 계속 일치한다(404 경로가 이미 문서화돼 있었으므로 신규 Swagger 애노테이션 불요).
  - 제안: 조치 불요.

- **[INFO]** `.catch` 블록의 `NotFoundException` 분기가 해당 트랜잭션 내에서 발생 가능한 유일한 `NotFoundException` 발생원(재조회 실패)만을 정확히 겨냥한다 — 다른 예외 유형과 혼동해 에러 응답 형식이 바뀔 위험이 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1097-1101`(`.catch((err: unknown) => { if (err instanceof NotFoundException) throw err; ... })`)
  - 상세: 소스를 직접 열어 확인한 결과 해당 `manager.transaction(...)` 콜백 안에는 `acquireTriggerConfigLock` → `m.findOne` → (없으면) `throwTriggerNotFound()` → `m.remove(trigger)` 만 있어, `NotFoundException`은 오직 새로 추가된 재조회 가드에서만 던져진다. 따라서 이 분기는 "genuine 삭제 실패"(로그 필요)와 "동시 삭제로 이미 사라짐"(로그 불요, 404 그대로 전파)을 정확히 구분하며, 두 경우 모두 HTTP 응답 형식은 최종적으로 동일한 예외가 그대로 재던져져 컨트롤러까지 전달되므로 클라이언트가 보는 응답 계약은 변하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 이 diff 는 URL/경로, 페이지네이션, 인증 가드, DTO 검증 로직을 전혀 건드리지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 전체(`:1060-1121` 부근), `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 전체
  - 상세: 새 e2e 스펙은 기존 `/api/triggers` POST/DELETE 엔드포인트를 그대로 호출해 레이스를 재현할 뿐 신규 라우트를 추가하지 않는다. `plan/in-progress/spec-draft-nullable-notation-followups.md`·`plan/in-progress/trigger-dup-delete.md`는 `SchedulesService.remove()`가 같은 결함(advisory lock/재조회 부재)을 아직 갖고 있음을 스스로 명시하고 별도 developer 백로그 항목으로 등재했다 — 이번 diff 범위(`codebase/backend/src/modules/schedules/**`는 변경되지 않음) 밖이므로 이 리뷰에서 별도 결함으로 잡지 않는다.
  - 제안: 조치 불요(추적은 이미 plan 에 등재됨).

## 요약

이번 diff 는 `TriggersService.remove()`의 동시 DELETE 레이스에서 advisory lock 획득 후 행 존재를 재확인하지 않던 버그를 고쳐, 이미 `spec/2-navigation/2-trigger-list.md §4.4`에 문서화돼 있던 "동시 삭제 시 패자는 404"라는 계약을 실제 코드 동작으로 일치시킨다. 신규 엔드포인트·요청/응답 스키마·에러 코드·인증/인가 규칙 변경이 전혀 없으며, 재조회는 기존 워크스페이스 스코프와 기존 `RESOURCE_NOT_FOUND` 에러 포맷을 그대로 재사용해 계약 표면이 늘지 않았다. 정상 단일 요청 클라이언트에는 영향이 없고, 유일한 동작 변화(레이스에서 패자가 204 대신 404를 받는 것)는 이미 spec 에 명시된 대로 버그가 고쳐진 것이라 breaking change 로 보지 않는다. `SchedulesService.remove()`의 동종 잔여 결함은 이번 diff 범위 밖이며 이미 별도 backlog 항목으로 추적되고 있다.

## 위험도

NONE
