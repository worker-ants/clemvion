# 요구사항(Requirement) 리뷰 — Personal 통합 소유자 강제 (4라운드)

## 발견사항

없음.

## 요약

이번 changeset(백엔드 `integrations` 모듈의 가시성·인가 판정, `integration-visibility.ts` 순수 함수 도입, OAuth 콜백 커밋 직전 재판정, 워크플로우 어시스턴트의 통합 후보 필터링, e2e·유닛 테스트, 사용자 가이드 문서)을 `spec/2-navigation/4-integration.md` §8 판정 규칙·§9 API·Rationale "Personal 통합 소유자 강제"와 line-level로 대조했다. `isIntegrationVisibleTo`(scope !== 'personal' || createdBy === userId), `integrationVisibilityClause`, `assertOrgScopeModifiable`/`adminRequiredError`(ADMIN_REQUIRED + 동작별 한국어 문구), `requireVisible`/`assertCanModify`/`requireModifiable`(404→403 순서), `judgedRow` 기반 compare-and-set(update/remove/updateScope/reauthorize), rotate의 락 안 재판정(Organization일 때만 같은 트랜잭션 커넥션으로 역할 재조회), OAuth 콜백의 `assertRequesterStillAllowed`(pending_install 예외 포함), precheck의 `pickPrecheckConflict`(식별자 마스킹), 컨트롤러의 `:id` 라우트 전수 캐너리, `findAll`/`explore-tools`/`candidate-lookup`/`assistant-finish-guard`의 SQL 가시성 필터까지 모두 spec 문구·표(§8 표, §9.2 precheck, RBAC §3.2, error-handling §1.2 ADMIN_REQUIRED)와 일치한다. 이미 3라운드에 걸쳐 Critical 1건씩(2·3라운드) 발견·수정됐고, plan의 뮤턴트 표(P1~P20, R1~R14)가 각 판정 지점을 KILLED로 확인했으며, 이번 diff에서 그 회귀나 새로운 갭을 찾지 못했다. TODO/FIXME/HACK 주석도 없고, `getForExecution`(노드 실행 엔진)은 spec이 명시적으로 후속(follow-up)으로 미룬 대로 이번 PR에서 손대지 않았다 — 의도된 스코프 경계다. 컨트롤러의 오류 순서(예: `updateScope`가 가시성보다 Admin 체크를 먼저 하는 것)도 그 자체가 리소스 존재 여부를 흘리지 않는 무조건부 검사라 설계상 안전하다.

## 위험도

NONE
