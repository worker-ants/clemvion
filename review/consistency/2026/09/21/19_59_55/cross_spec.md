# Cross-Spec 일관성 검토 — `spec/5-system` (--impl-prep)

## 컨텍스트

이번 검토 트리거는 `plan/in-progress/e2e-race-helper.md`(동시성 e2e 아홉 파일의 공용 헬퍼 `raceUnderHeldLock()` 추출) 착수 게이트다. 해당 plan 은 `spec_impact: none`, `codebase/backend/src/**` 변경 0(테스트 전용 리팩터)을 명시한다. 즉 target 문서(`spec/5-system`) 자체에는 이번 작업으로 인한 **변경이 없다** — 본 검토는 그 착수 근거가 되는 spec/5-system 현재 상태가 다른 영역과 이미 어긋나 있지 않은지를 확인하는 게이트 성격이다.

검토는 assembled 프롬프트(컨텍스트 예산 초과로 `4-execution-engine.md` 등 15개 파일 본문 생략)에 더해 실제 `spec/**` 파일을 직접 `Read`/`grep` 하여 보강했다.

## 점검 범위

plan 이 건드리는 e2e 시나리오(동시 삭제 감사 중복 방지: WebAuthn credential, model-config, auth-configs, workspace member, integration, schedule, trigger, workflow)와 직결되는 다음 축을 우선 점검했다:

1. **감사 로그 액션명** — `spec/5-system/1-auth.md` §4.1 카탈로그 vs `spec/data-flow/1-audit.md`, `spec/conventions/audit-actions.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/12-workspace.md`
2. **RBAC 매트릭스** — `1-auth.md` §3.2 (Model Config/Auth Config/멤버 관리 CRUD 권한)
3. **에러 코드** — `1-auth.md` §1.1.B 에서 참조하는 `REAUTH_NOT_AVAILABLE`/`VALIDATION_ERROR`/`RESOURCE_CONFLICT` vs `3-error-handling.md` 카탈로그

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 컨텍스트 예산 초과로 `spec/5-system` 15개 파일(`4-execution-engine.md`, `6-websocket-protocol.md`, `14-external-interaction-api.md` 등) 본문이 assembled 프롬프트에서 생략됨
  - target 위치: 프롬프트 조립 결과 §"컨텍스트 예산 초과로 생략된 파일 15개"
  - 상세: 조립 실패가 아닌 의도된 절단이나, 이번 작업(테스트 헬퍼 추출)이 건드리는 도메인은 auth/audit-log/RBAC/error-handling 범위(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`, 전문 포함됨)에 한정되어 실질 영향은 낮다고 판단. 생략된 15개 파일 자체를 변경하는 후속 작업이 있다면 별도로 직접 `Read` 확인 필요
  - 제안: 조치 불요 (참고용 기록)

## 상세 확인 결과 (충돌 없음 확인)

- 감사 액션명 일치: `member.removed`(workspace 도메인), `integration.deleted`, `auth_config.delete`, `model_config.delete`, `user.2fa_disabled`, `trigger.deleted`, `schedule.deleted`, `workflow.deleted` 모두 `1-auth.md` §4.1 카탈로그와 `data-flow/1-audit.md`·`conventions/audit-actions.md`·해당 도메인 spec(`2-navigation/4-integration.md`, `2-navigation/2-trigger-list.md`, `data-flow/12-workspace.md`) 간 표기가 동일했다. SoT 포인터(구현 SoT=`audit-action.const.ts`, 문서 SoT=`conventions/audit-actions.md` + `data-flow/1-audit.md`)도 상호 참조로 명확했다.
- RBAC: Model Config(Editor CRUD)·Auth Config(Editor/Viewer=R, Owner/Admin=CRUD, Reveal 별도 Admin+)·멤버 관리(Admin/Owner CRUD, `CANNOT_REMOVE_OWNER` 각주)가 §3.2 매트릭스와 §3.3 각주 간 자체 모순 없이 기술되어 있고, 이번 e2e 대상(webauthn/model-config/auth-configs/workspace-member 동시 삭제)의 권한 전제와 배치되지 않는다.
- 에러 코드: `REAUTH_NOT_AVAILABLE`(403)·`VALIDATION_ERROR`(400)·`RESOURCE_CONFLICT`(409)가 `3-error-handling.md` 카탈로그와 `1-auth.md` 본문의 인용이 코드·상태값·발행 지점 모두 일치했다.
- lock 관련 규약(`pg_advisory_xact_lock` 등)은 spec 문서가 아닌 구현/테스트 세부사항(plan §B)이라 spec 층위 충돌 대상이 아님을 확인.

## 요약

이번 target(`spec/5-system`)은 트리거 plan(`e2e-race-helper`)이 `spec_impact: none`·프로덕션 코드 변경 0 을 명시한 테스트 전용 작업이라, 실질적으로 spec 변경이 수반되지 않는다. 이번 e2e 헬퍼 추출이 다루는 도메인(감사 로그 액션·RBAC·에러 코드)에 한해 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문 확보)를 `spec/data-flow/**`·`spec/conventions/**`·`spec/2-navigation/**`의 동일 개념 정의와 대조한 결과 모순을 찾지 못했다. 컨텍스트 예산으로 생략된 `spec/5-system` 15개 파일은 이번 작업 범위 밖(실행 엔진·웹소켓·EIA 등)이라 추가 조치가 필요하지 않다고 판단한다.

## 위험도

NONE
