# 요구사항(Requirement) 리뷰 — `authconfig-dup-delete` (재검토, 15_45_04)

## 검증 방법

`Read`/`Bash(grep)` 로 저장소 원본을 직접 열어 diff·주석·CHANGELOG·plan 의 실측 주장을 대조했다(저장소에 쓰기 없음, 뮤테이션 없음):

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 전체 — `remove()`/`findById()`/`throwAuthConfigNotFound()` 실구현
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — 신규 `describe('remove — 동시 삭제')` 4개 테스트, mock `delete` 팩토리
- `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` 전문
- `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `@HttpCode(HttpStatus.NO_CONTENT)` 실측
- `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts` — `@OneToMany`/`cascade` 부재
- `codebase/backend/migrations/V001__initial_schema.sql:208-210` — `fk_trigger_auth_config ... ON DELETE SET NULL`
- `spec/5-system/3-error-handling.md` §1.11 (`AUTH_CONFIG_NOT_FOUND` 400, "유일한 `_NOT_FOUND`≠404 예외")
- `spec/2-navigation/6-config.md` §3(DELETE 엔드포인트), `spec/5-system/1-auth.md`·`spec/5-system/12-webhook.md`(대상 아님 확인)
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()`(#1373) 기존 처방, CHANGELOG backfill 항목 정합성
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `{ok:true}` 5곳/`HttpCode(200)` 1곳 실측
- `codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `AUTH_CONFIG_DELETE: 'auth_config.delete'`
- 저장소 전체 `@BeforeRemove`/`@AfterRemove`/`@EventSubscriber`/`@BeforeInsert` grep — ORM lifecycle hook 실측
- `review/code/2026/09/21/15_18_16/*` (직전 라운드 SUMMARY/RESOLUTION/requirement.md) — 이번 라운드가 그 WARNING/INFO 를 실제로 반영했는지 대조

## 발견사항

- **[INFO]** `remove()` 진입부 주석·CHANGELOG 항목이 "저장소 전체에 ORM 라이프사이클 훅이 0건이다" 라고 쓰는데, 문자 그대로는 부정확하다 — `codebase/backend/src/modules/users/entities/user.entity.ts:201` 에 `@BeforeInsert()` 가 실재한다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:319-320` (`remove()` 내부 주석), 동일 문장이 `CHANGELOG.md` 신규 항목("고친 것" 두 번째 불릿)에도 그대로 복제됨
  - 상세: 다만 `remove(entity)`→`delete(criteria)` 전환이 실제로 우회하는 것은 `@BeforeRemove`/`@AfterRemove`/`@BeforeSoftRemove`/`@AfterSoftRemove`/`EntitySubscriberInterface` 류 **remove 계열 훅**이고, 이 저장소 전체에 그 계열은 0건임을 직접 grep 으로 확인했다(`@BeforeInsert` 는 `User` 엔티티의 insert 훅이라 `AuthConfig.delete()` 경로와 무관). 즉 **주장의 핵심 결론(이 전환이 안전하다)은 맞지만, 그 근거로 든 "저장소 전체 0건" 이라는 표현의 스코프가 실제 검증 범위보다 넓게 쓰였다** — 다음 사람이 이 문장만 보고 "훅이 전혀 없는 저장소" 로 오해할 수 있다.
  - 제안: 코드 fix 대상 아님(기능 영향 없음). 여유가 있으면 주석을 "AuthConfig 관련 remove/soft-remove 훅·subscriber 0건"으로 좁혀 정확히 하면 향후 재확인 비용을 줄인다.

## Spec fidelity 확인 결과 (일치)

- 404 코드 `RESOURCE_NOT_FOUND` — `findById()`·`remove()` 양쪽 동일, 기존 계약과 일치. `spec/5-system/3-error-handling.md:83`(`RESOURCE_NOT_FOUND | 404`)과 일치.
- `throwAuthConfigNotFound()` JSDoc 이 인용한 `spec/5-system/3-error-handling.md` §1.11(`AUTH_CONFIG_NOT_FOUND` = 400, "이 저장소의 유일한 `_NOT_FOUND`≠404 예외") — 실제 절 번호(`### 1.11 트리거 AuthConfig binding 에러 코드`, line 242)와 문구 모두 spec 원문과 정확히 일치.
- 컨트롤러 `@HttpCode(HttpStatus.NO_CONTENT)`(204) 실측 일치 — e2e/CHANGELOG 의 "이 라우트는 204" 주장과 정확히 부합.
- `AuthConfig` 엔티티 `@OneToMany`/`cascade:true` 부재, `trigger.auth_config_id` FK `ON DELETE SET NULL`(`V001__initial_schema.sql:210`, 문자 그대로 일치) — `remove(entity)`→`delete(criteria)` 전환이 캐스케이드 동작을 바꾸지 않는다는 주석 주장이 실측과 일치.
- `AUDIT_ACTIONS.AUTH_CONFIG_DELETE = 'auth_config.delete'` — 서비스·유닛 테스트·e2e 전부 동일 문자열.
- `findById()` JSDoc 의 재작성된 호출자 목록(`findByIdForResponse`/`update`/`regenerate`/`remove`/`reveal`/`getUsage`) — `findById(` 전수 grep 결과와 정확히 일치(과거 stale 리스트가 이번에 바로잡힘, INFO5 fix 확인).
- `spec/2-navigation/6-config.md` §3, `spec/5-system/1-auth.md`, `spec/5-system/12-webhook.md` — 삭제 엔드포인트 계약을 서술하는 자리는 `6-config.md` §3 뿐이고 "동시 삭제→두 번째 404" 서술이 없는 것은 회색지대(spec 침묵)로, `plan/in-progress/authconfig-dup-delete.md` 의 `spec_impact: none` 및 `spec-draft-nullable-notation-followups.md` 의 재열거형 후속 항목(2026-09-21 일반화)이 이미 커버한다. 신규 SPEC-DRIFT 아님(기존에 인지·처분된 문서 밀도 비대칭의 7번째 인스턴스).
- CHANGELOG 의 "member.removed" backfill 항목 실측 주장(`workspaces` 컨트롤러 `{ok:true}` 5곳·`HttpCode` 0곳, 성공 코드가 라우트가 아니라 **컨트롤러 단위**로 갈린다는 주장) — `workspaces.controller.ts` 직접 확인 결과 `{data:{ok:true}}` 5곳, 명시적 `HttpCode` 데코레이터 0곳(200 은 NestJS 기본값)으로 정확히 일치.

## 기능/엣지케이스/비즈니스로직 검토

- `affected === 0` 명시 비교 — `null`/`undefined`(드라이버 미보고)를 정상 삭제로 유지하고 `0`(진짜 0행)만 404 로 판정. `it.each([[undefined],[null]])` 대조군이 `!affected` 회귀를 정확히 겨냥.
- 워크스페이스 스코프 — `delete({ id, workspaceId })` 로 cross-tenant 삭제 차단(종전 `remove(entity)`(PK만)보다 강화), 단위 테스트가 `toHaveBeenCalledWith({id, workspaceId: WS})` 로 조건 전체를 단언.
- fail-fast 계약 — 대상이 원래 없으면 `findById` 가 먼저 404 를 던져 `delete()` 자체를 시도하지 않음(`repo.delete`/`audit.record` 모두 미호출 단언).
- 반환값 — `remove()` 의 모든 경로(정상 완료/404 throw)가 적절히 반환·예외 처리됨, 누락 경로 없음.
- TODO/FIXME/HACK/XXX 없음.
- 함수명(`throwAuthConfigNotFound`)과 실제 동작(404 `RESOURCE_NOT_FOUND`) 일치, 형제 4패턴과 형태 일치.
- 직전 라운드(`review/code/2026/09/21/15_18_16`) SUMMARY 의 WARNING1(CHANGELOG 누락)·INFO1(주석)·INFO3(죽은 mock 필드)·INFO5(JSDoc stale)·INFO7(e2e 필터 누락)·INFO9(no-op mockClear) 이 이번 커밋들(`197425f51`·`69539209f`·`5502d1dee`·`caa9bae66`)로 실제 코드에 반영됐음을 직접 대조로 확인 — RESOLUTION.md 의 서술이 사실과 일치.

## 요약

`AuthConfigsService.remove()` 의 동시 삭제 이중 감사 결함 수정(원자적 `DELETE`+`affected===0` 명시 비교)은 형제 6건(#1369~#1373)과 동일한 처방을 정확히 재사용했고, 이번 라운드는 직전 리뷰(`15_18_16`)가 지적한 WARNING 1건과 INFO 5건을 모두 실제 커밋으로 반영했음이 직접 대조로 확인된다. 컨트롤러 204/에러 코드/FK cascade/워크스페이스 스코프/에러 코드 자리 구분(§1.11) 등 코드·주석·CHANGELOG·plan 의 실측 주장은 spec 원문·소스와 line-level 로 일치했다. 유일하게 새로 발견한 것은 `remove()` 주석과 CHANGELOG 가 "저장소 전체 ORM 라이프사이클 훅 0건"이라고 쓴 표현이 문자 그대로는 부정확하다는 점(실제로는 무관한 엔티티에 `@BeforeInsert` 가 존재)인데, 이 전환의 안전성 근거로 실제로 필요한 remove 계열 훅은 검증대로 0건이라 결론에는 영향이 없는 INFO 수준 문서 정밀도 문제다. 기능 완전성·엣지 케이스(null/undefined/0 판별)·에러 시나리오·반환값 모두 테스트(유닛 4종 + e2e 1종)로 커버되며 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
