# 요구사항(Requirement) 리뷰 — `authconfig-dup-delete`

## 검증 방법

`Read`/`Bash(grep, diff)` 로 저장소 원본을 직접 열어 다음을 실측 대조했다 (저장소에 쓰기 없음, `git status --short` 로 clean 확인):

- `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts` — `workspaceId` 컬럼·cascade·lifecycle hook 부재
- `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `@HttpCode(HttpStatus.NO_CONTENT)`, `@WorkspaceId()` 사용
- `codebase/backend/src/common/filters/http-exception.filter.ts` — `res.body.error.code` 봉투 형태
- `codebase/backend/src/modules/triggers/triggers.service.ts:965-978` + `spec/5-system/3-error-handling.md` §1.11 — 400 `AUTH_CONFIG_NOT_FOUND` 와의 구분 서술 정확성
- `codebase/backend/migrations/V001__initial_schema.sql:208-210` — `fk_trigger_auth_config ... ON DELETE SET NULL`
- `spec/5-system/2-api-convention.md:195` — 404 기본 코드 `RESOURCE_NOT_FOUND`
- `codebase/backend/src/app.module.ts:205-214` — `RolesGuard` 전역 `APP_GUARD` 등록 (plan 정정 커밋 정확성)
- sibling e2e (`integration-delete-concurrency.e2e-spec.ts`, `schedule-delete-concurrency.e2e-spec.ts`) 와 신규 `auth-config-delete-concurrency.e2e-spec.ts` diff 대조

## 발견사항

- **[INFO]** `remove()` 진입부의 `await this.findById(id, workspaceId);` 호출이 이제 기능적으로는 중복이다 — 뒤이은 `delete()`의 `affected === 0` 판정이 "존재하지 않음"을 이미 완전히 커버한다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:299` (`await this.findById(id, workspaceId);`)
  - 상세: 함수적으로는 안전하다(추가 SELECT 왕복 1회일 뿐, 정확성 문제 없음). 다만 이는 신규 단위 테스트 `'대상이 없으면 DELETE 를 시도하지 않는다'`(`auth-configs.service.spec.ts:346`)가 지키려는 **의도적** 설계다 — 존재하지 않는 대상에 불필요한 `DELETE` 문 발행을 막는 트레이드오프(추가 SELECT 대신 낭비 DELETE 회피)로 읽힌다. 버그로 보지 않는다.
  - 제안: 조치 불요. 의도가 불명확하면 plan/PR 설명에 "레이스에는 관여하지 않는 사전 존재 확인" 이라는 한 줄을 남기면 다음 리뷰어가 재조사하지 않는다.

- **[INFO]** 신규 e2e 감사 로그 카운트 쿼리가 `resource_type = 'auth_config'` 필터를 생략했다 — 형제 `integration-delete-concurrency.e2e-spec.ts` 는 `resource_type` 을 함께 건다.
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts:107-111` (`SELECT COUNT(*) ... WHERE resource_id = $1 AND action = 'auth_config.delete'`)
  - 상세: `resource_id` 가 UUID(`create.body.data.id`)이고 `action` 이 `'auth_config.delete'` 로 스코프돼 있어 실질적 충돌 가능성은 사실상 없다 — 판별력에 영향을 주는 결함은 아니다. 다만 형제 테스트와의 스타일 비대칭이라 이 결함 클래스 감사 시 재조사 비용을 유발할 수 있다.
  - 제안: 조치 불요(선택적으로 `resource_type = 'auth_config'` 추가해 형제 패턴과 맞추면 좋음).

- **[INFO / spec fidelity]** `spec/2-navigation/6-config.md` §3 API 표에 "동시 삭제 → 두 번째 404" 서술이 없다 — 형제 `2-trigger-list.md` §4.4 는 이를 명시한다.
  - 위치: `spec/2-navigation/6-config.md:267` (`DELETE | /api/auth-configs/:id | 삭제 **(Admin+)**`)
  - 상세: 회색지대(spec 본문 침묵)이며, 이미 `plan/in-progress/authconfig-dup-delete.md` 가 `spec_impact: none` 을 선언했고 consistency-check(`review/consistency/2026/09/21/14_41_01/convention_compliance.md` INFO #3, `cross_spec.md`)가 같은 관찰을 이미 INFO 로 기록·처분했다. `spec-draft-nullable-notation-followups.md` 후속 항목이 2026-09-21 기준 스냅샷에 `6-config.md §A` 를 이미 포함해 재열거해 뒀다. 신규 결함이 아니라 기존에 인지·추적 중인 문서 밀도 비대칭이므로 SPEC-DRIFT 로 별도 등재하지 않는다.
  - 제안: 조치 불요 — 후속 followups plan 이 이미 커버.

## Spec fidelity 상세 확인 결과 (문제 없음)

- 404 코드 `RESOURCE_NOT_FOUND` = `spec/5-system/2-api-convention.md:195` 의 상태코드 기본값과 일치, `findById()` 기존 코드와 동일 — 진 쪽 코드가 "없어서 404" 와 갈라지지 않는다는 plan/e2e 주석의 주장이 실측과 일치.
- 신규 `throwAuthConfigNotFound()` 헬퍼의 JSDoc이 인용한 `triggers.service.ts` 의 400 `AUTH_CONFIG_NOT_FOUND` 및 `spec/5-system/3-error-handling.md` §1.11 "이 저장소의 유일한 `_NOT_FOUND`≠404 예외" 문구는 spec 원문과 정확히 일치(재확인 완료) — 두 자리를 혼동하면 안 된다는 주석의 근거가 실재한다.
- `delete({ id, workspaceId })` 는 `AuthConfig.workspaceId` 가 일반 `@Column`(관계 아님)이라 TypeORM criteria 로 유효 — 형제 통합/스케줄 경로와 같은 형태.
- `remove(entity)` → `delete(criteria)` 전환이 동작을 바꾸지 않는다는 주석의 "실측" 주장(`cascade`/`@OneToMany`/lifecycle hook 0건, FK는 `ON DELETE SET NULL` DB 레벨) — entity 파일과 `V001__initial_schema.sql:208-210` 대조로 확인됨.
- 컨트롤러가 실제로 `@HttpCode(HttpStatus.NO_CONTENT)`(204) 이고 `{ok:true}` 를 쓰지 않는다는 e2e 주석의 실측 — 컨트롤러 원본과 일치.
- `AUDIT_ACTIONS.AUTH_CONFIG_DELETE = 'auth_config.delete'` — 서비스·테스트·e2e 전부 동일 문자열 사용, `spec/conventions/audit-actions.md` 레지스트리와 일치(consistency-check 확인済).
- plan 의 "부수 발견" (`RolesGuard` 는 전역 `APP_GUARD`) 정정 — `app.module.ts:213` 원본과 정확히 일치, 정정이 정확하다.

## 기능/엣지케이스/비즈니스로직 검토

- `affected === 0` **명시 비교**로 진 쪽 404 판정 — `!affected` 로 되돌리면 `null`/`undefined`(드라이버 미보고)도 404로 오판하는 회귀를 만드므로 명시 비교가 옳다. 대조군 테스트(`it.each([[undefined],[null]])`)가 이 규율을 정확히 검증한다.
- 동시성 원자성의 근거(단일 `DELETE ... WHERE id=$1 AND workspace_id=$2` 문장이 원자적)는 타당하고, e2e 는 `SELECT ... FOR UPDATE` 로 두 요청을 실제로 겹치게 만든 뒤 공허성 가드(`Promise.race` + 1.5s)로 겹침 자체를 검증한다 — 판별력 있는 테스트다.
- `remove()` 의 모든 코드 경로(정상/404)가 적절한 값(void 또는 throw)을 반환/던진다. 반환 누락 경로 없음.
- TODO/FIXME/HACK/XXX 계열 미완성 주석 없음.
- 함수명(`throwAuthConfigNotFound`)과 실제 동작(404 `RESOURCE_NOT_FOUND` throw) 일치, 형제 4패턴(`throwTriggerNotFound` 등)과 형태 일치 확인.
- mock 저장소의 `delete` 구현이 `workspaceId` 를 검사하지 않지만, 별도 단언(`toHaveBeenCalledWith({ id, workspaceId: WS })`)으로 호출 인자를 검증하므로 cross-tenant 스코프 누락을 놓치지 않는다. 실제 워크스페이스 격리 자체의 최종 보증은 e2e/DB 레벨이 담당(적절한 계층 분리).

## 요약

`AuthConfigsService.remove()` 의 동시 삭제 이중 감사 결함 수정은 형제 4건(#1370~#1373)과 동일한 처방(원자적 `DELETE`의 `affected===0` 명시 비교)을 정확히 재사용했고, 컨트롤러 204/에러 코드/FK cascade/워크스페이스 스코프 등 실측 근거 전부가 원본 코드·spec 원문과 일치했다. 신규 `throwAuthConfigNotFound()` 헬퍼는 형제 패턴과 동형이며, 근접한 400 `AUTH_CONFIG_NOT_FOUND`(트리거 도메인, §1.11)와의 구분을 JSDoc 으로 정확히 명시해 이미 consistency-check WARNING을 해소했다. 단위 테스트(정상/진 쪽/대조군/사전확인)와 신규 e2e(공허성 가드 포함 실제 동시성 재현)가 요구 동작을 빠짐없이 커버한다. spec 은 `6-config.md` 에 "동시 삭제→404" 를 명시하지 않지만 `spec_impact: none` 선언과 후속 트래커 등재로 이미 처분된 회색지대이며 신규 SPEC-DRIFT 나 CRITICAL 은 발견되지 않았다. 발견된 항목은 전부 비차단 INFO(중복 SELECT 설계 선택, e2e 쿼리의 형제 대비 필터 생략, spec 문서 밀도 비대칭) 수준이다.

## 위험도

NONE
