# Cross-Spec 일관성 검토 — `forbidden-desc-codes` (impl-prep)

## 대상

- `plan/in-progress/spec-draft-swagger-forbidden-codes.md` (spec draft — `spec/conventions/swagger.md` §5-4 에 적용 예정인 패치 지시)
- `plan/in-progress/forbidden-desc-codes.md` (구현 plan — 129곳 교체 · 공용 헬퍼 `forbidden-descriptions.ts` · 저장소 가드 `forbidden-response-codes`)
- 함께 번들된 현재 spec 스냅샷: `spec/conventions/swagger.md`(§5-4) · `spec/data-flow/12-workspace.md`(§Rationale "가드 거부의 오류 코드" · "멤버십 검증은 가드 1곳에서") · `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md`(§1.2)

target 은 아직 `spec/`에 적용되지 않은 **draft 패치 지시서**다(스크래치패드 사본과 저장소 현재
`spec/conventions/swagger.md` 가 diff 0 — 미적용 확인). 검토는 이 draft 가 "적용됐다고 가정한
상태"가 다른 spec 영역과 모순되는지를 본다.

## 발견사항

없음 — CRITICAL/WARNING 급 충돌을 찾지 못했다.

이 draft 는 새 개념을 도입하는 것이 아니라, 이미 다른 세 영역에 정착된 결정
(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드 체계, 비멤버는 요구
역할과 무관하게 `NOT_A_MEMBER`)을 `swagger.md` §5-4 의 "새 엔드포인트 체크리스트" 문구에
뒤늦게 맞추는 동기화 draft다. 교차 검증 결과:

- **데이터 모델/역할 계층**: `spec/1-data-model.md:124` 의 `role: owner/admin/editor/viewer` 및
  실제 `workspace-roles.ts` 의 서열(`viewer < editor < admin < owner`)과 draft 의 "요구 중
  가장 낮은 역할" 서술이 일치한다. `ROLE_REQUIRED.viewer === NOT_A_MEMBER` 주장도 코드
  (`workspace-roles.ts`)·기존 spec(`12-workspace.md` §Rationale)과 일치한다.
- **API 계약**: `spec/5-system/2-api-convention.md:195-196` 이 이미 "`RolesGuard` 의 멤버십·역할
  거부는 기본값이 아니라 전용 코드를 갖는다"고 명시하고, `spec/5-system/3-error-handling.md`
  §1.2 의 `NOT_A_MEMBER`/`ADMIN_REQUIRED`/`EDITOR_REQUIRED`/`OWNER_REQUIRED` 행이 같은 정의를
  공유한다. draft 가 참조하는 앵커(`12-workspace.md#가드-거부의-오류-코드-2026-09-25`,
  `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`)는 실제 헤딩과 slug 가 일치한다.
- **요구사항 ID / 식별자 충돌**: 새로 도입하는 식별자(`forbidden-descriptions.ts`,
  `FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole`, 저장소 가드 `forbidden-response-codes`)는
  `spec/**`·`plan/**`·`codebase/backend/src/**` 전체에서 grep 0건 — 기존 다른 의미로 쓰이는
  자리 없음.
- **계층 책임**: draft 가 전제하는 `lowestRequiredRole` 추출 대상 로직은
  `codebase/backend/src/common/guards/roles.guard.ts:219-227` 의 `assertMember` 내부 `reduce`
  와 정확히 일치하고, 이미 `workspace-roles.ts` 자체가 "가드와 서비스가 같은 표를 본다"는
  단일화 원칙을 선언해 뒀다 — 추출 방향이 기존 아키텍처 결정과 같은 방향(중복 표현 제거)이다.
  서비스 계층 403(`RERUN_PERMISSION_DENIED` 등)을 가드 뒤에 덧붙이는 패턴도
  `executions.controller.ts:282,311`(이미 반영된 28곳 중 하나)과 `spec/5-system/13-replay-rerun.md`
  가 선례로 갖고 있어, draft 가 "서비스 거부는 가드 문장 뒤에 덧붙인다"고 정한 것과 같은 결이다.
- **RBAC 모델**: draft 는 "`@Roles()` 라우트도 비멤버에게는 `NOT_A_MEMBER`"라는, 이미
  `12-workspace.md`(2026-09-25 결정)·`error-handling.md`(§1.2 `NOT_A_MEMBER` 행)·
  `1-auth.md:284`(초대 발송/재발송/취소 표)가 공유하는 모델을 그대로 따른다. 새 권한 구조를
  도입하지 않는다.

이 draft 스코프 밖으로 명시적으로 남긴 것(서비스 계층 403 코드의 전수 광고, `workflow-test-datasets`
두 곳 제외)도 구현 plan `forbidden-desc-codes.md` §남기는 것에 그대로 반영돼 있어 spec 과 구현
plan 사이의 스코프 서술이 어긋나지 않는다.

## 요약

target 은 신규 계약을 만드는 draft 가 아니라, `2026-08-08`(멤버십 가드 단일화)·`2026-09-25`(경로
파라미터 가드화 + 가드 거부 코드 부여) 두 차례 이미 결정된 RBAC/에러코드 모델을 `swagger.md`
§5-4 문구·가드 등재로 뒤늦게 맞추는 동기화 성격의 변경이다. 참조 앵커·코드 계층 서열·역할별
거부 코드·서비스 계층 위임 패턴이 `data-flow/12-workspace.md`·`5-system/2-api-convention.md`·
`5-system/3-error-handling.md`·`5-system/1-auth.md`·`5-system/13-replay-rerun.md` 전 영역과
정합하며, 새로 도입하는 식별자도 저장소 전역에서 충돌하지 않는다. Cross-spec 관점에서 이
draft 를 그대로 반영해도 다른 영역이 깨지거나 모순되는 지점은 발견되지 않았다.

## 위험도

NONE
