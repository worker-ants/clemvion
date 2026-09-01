# Cross-Spec 일관성 검토 — `spec/5-system/` (audit-record-factory, impl-done)

## 검토 범위 및 방법

프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션이 예산 절단으로 생략되어 있어,
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/audit-record-factory`)에서
`git diff origin/main...HEAD` 를 직접 실행해 실제 델타를 확인했다.

**실제 spec 델타 3개 파일**(`spec/5-system/` 스코프 1개 + 인접 data-flow 2개):
- `spec/5-system/_product-overview.md` — NF-OB-07 카탈로그에 `clemvion.audit.write_failed` 등재
- `spec/data-flow/1-audit.md` — `audit_log`/`login_history` swallow 후 관측 비대칭 명문화
- `spec/data-flow/9-observability.md` — "닫힌 유니온 vs 클램핑" 라벨 방어 원칙 일반화

**실제 코드 델타(핵심)**:
- `audit-logs.service.ts` — `BusinessMetricsService` `@Optional()` 주입, catch 블록에서 카운터 기록 + 로그에 유실 대상(`action`/`resourceType`/`resourceId`/`workspaceId`) 추가
- `business-metrics.service.ts` — `recordAuditWriteFailed(resourceType)` 신설, `clampLabel` 공용 헬퍼로 리팩터
- `auth-configs.service.ts` — `recordAudit` 의 `action` 파라미터를 맨 `AuditAction` → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힘
- `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` + `.spec.ts` 신설 — `AuditActionFor` 리소스 바인딩이 전 서비스에 균일하게 적용되는지 형태 기반으로 검사하는 정적 가드
- `audit-logs.spec.ts`, `business-metrics.service.spec.ts` — 회귀 테스트

## 발견사항

관점 1~6(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에 대해 다음을 실측 대조했고, CRITICAL/WARNING 수준의 모순은 발견되지 않았다.

- **데이터 모델(§1)**: `clemvion.audit.write_failed` 의 `resource_type` 라벨이 "코드가 정하는 값, 실측 12종"이라는 spec 문구를, `codebase/backend/src/modules/**/*.service.ts` 전수의 `resourceType:` 리터럴을 grep 해 대조 — `alert_rule`·`auth_config`·`user`·`workflow`·`execution`·`integration`·`model_config`·`schedule`·`trigger`·`workspace`·`member`·`workspace_invitation` = 정확히 12종으로 일치. `spec/data-flow/1-audit.md`·`spec/data-flow/9-observability.md`·`spec/5-system/_product-overview.md` 3곳의 서술(클램핑 64자, 카운터 이름, 알람 예시)도 상호 정합.
- **요구사항 ID(§3)**: `NF-OB-07` 은 기존 ID 재사용이며 새 의미 충돌 없음 — `spec/` 전역 grep 결과 `spec/5-system/4-execution-engine.md`·`spec/2-navigation/4-integration.md`·`spec/data-flow/9-observability.md` 의 참조가 모두 동일 카탈로그를 가리킨다.
- **RBAC/권한(§5)**: `auth-configs.service.ts` 의 `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 좁힘은 컴파일 타임 타입 정제일 뿐 런타임 인가 로직·엔드포인트 권한을 변경하지 않는다. `spec/5-system/1-auth.md §3.2`(리소스별 권한 매트릭스)·§4.1(auth_config 액션 카탈로그: create/update/delete/regenerate/reveal)과 대조했으나 액션 목록·권한 분리 서술에 변경이 필요한 지점 없음.
- **계층 책임(§6)**: 신설 가드 3파일은 `codebase/backend/src/repo-guards/__tests__/`에 위치 — 기존 `redis-fail-open-catalog-guard.ts`·`engine-error-code-anchor-guard.ts` 등과 동일한 `*-guard.ts`/`*-fixture.ts`/`*.spec.ts` 3분할 패턴을 그대로 따른다. 새 레이어·새 책임 분할 결정 없음.
- **상태 전이·API 계약(§2, §4)**: 신규/변경 엔드포인트 없음, 상태 머신 대상 아님(append-only 감사 적재의 실패 관측 추가일 뿐) — 해당 사항 없음.

## 참고(비-충돌, INFO 수준 관찰)

- `plan/in-progress/spec-sync-auth-gaps.md` 는 "17개 감사 producer" 라는 표현을 쓰고, spec 은 "resource_type 실측 12종"을 쓴다. 전자는 `record()` 호출 지점 수, 후자는 그 호출에 실리는 distinct `resourceType` 값 수로 **서로 다른 단위**이며 실제로 모순은 아니다(다건의 producer 가 같은 resourceType 을 공유할 수 있음). 다만 이 숫자 쌍이 spec 이 아닌 plan(비-SoT)에만 있어 cross-spec 충돌 대상은 아니다 — 기록만 남긴다.
- `spec/data-flow/1-audit.md` 는 `login_history` 축의 관측 갭(카운터 없음)을 의도적으로 미결로 남기고 `plan/in-progress/spec-sync-auth-gaps.md` 로 추적을 명시한다. 이는 "숨겨진 갭"이 아니라 spec 본문이 스스로 비대칭을 선언한 것이라 CRITICAL 근거가 되지 않는다.

## 요약

이번 변경은 `spec/5-system/_product-overview.md`(NF-OB-07 카탈로그 확장)와 그에 연동된 `spec/data-flow/1-audit.md`·`spec/data-flow/9-observability.md` 2개 인접 문서를 함께 갱신했고, 실제 구현(`audit-logs.service.ts`·`business-metrics.service.ts`·`auth-configs.service.ts`·신설 `repo-guards` 가드)과 문서 서술(라벨 12종, 클램핑 64자, 카운터 이름, 알람 예시)이 grep 실측으로 전부 일치했다. 새 엔드포인트·상태 머신·RBAC 규칙·요구사항 ID 재사용이 없고, 신설 정적 가드는 기존 `repo-guards/__tests__/*-guard.ts` 계층 패턴을 그대로 따라 계층 책임 분할과도 충돌하지 않는다. 다른 spec 영역(1-auth.md §3.2/§4.1, conventions/audit-actions.md)과 대조했을 때 모순되는 서술은 발견되지 않았다.

## 위험도

NONE
