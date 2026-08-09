# API 계약(API Contract) 리뷰

## 검토 범위 확인

이번 diff(19개 파일)를 API 계약 8개 관점(하위 호환성·버전 관리·응답 형식·에러 응답·요청
검증·URL/경로 설계·페이지네이션·인증/인가)으로 점검했다. 결과: **실제 API 표면(컨트롤러·DTO·
라우트·응답 스키마)을 변경하는 프로덕션 코드가 diff 안에 하나도 없다.**

파일 구성:

- `codebase/backend/README.md` — 문서(부팅 캐너리 설명 절 재구조화). 동작 변경 아님.
- `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` — 신규 테스트 픽스처
  공용 모듈(3개 spec 파일에 흩어져 있던 UUID 상수를 통합). 런타임 코드 아님.
- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — **JSDoc 주석만**
  변경(부팅 로그 실측치 73→142 정정 + 두 수치의 포함관계 명시). `assertWorkspaceIdReflectionWorks`
  함수 본문·시그니처·throw 조건은 무변경.
- `workspace.decorator.spec.ts` / `roles.guard.spec.ts` / `workspace-context.util.spec.ts` —
  전부 **테스트 전용** 변경. 로컬 상수(`WS1`/`OWN_WS`/`DECOY_WS` 등)를 공용 픽스처 import 로
  치환한 리네이밍이며, 테스트가 검증하는 대상 코드(`WorkspaceId` 데코레이터·`RolesGuard`·
  `resolveRequestWorkspaceContext`)나 기대값(에러 코드·상태 전이)은 그대로다. 이 로직들이
  구현하는 실제 API 계약 변경(비-UUID 워크스페이스 헤더 → `400 VALIDATION_ERROR`, header-first
  우선순위)은 이미 머지된 PR #1108(`e97d0d3a6`)에서 이뤄졌고 이번 diff 범위 밖이다.
- `secret-resolver.service.spec.ts` / `test/secret-store-like-prefix.e2e-spec.ts` — 내부 서비스
  (`SecretResolverService.deleteByPrefix`)의 SQL `LIKE` 와일드카드 의미론을 고정하는 테스트
  보강. `secret-store`는 외부 노출 HTTP API 가 아니라 내부 자격증명 저장소라 API 계약 표면
  밖이다.
- `http-request.handler.spec.ts` — HTTP Request 노드 핸들러의 abort 시뮬레이션 테스트에서 죽은
  스캐폴딩(`fetchPromise`, 미사용 `_reject` 콜백) 제거. 핸들러의 요청/응답 처리 로직 자체는
  무변경.
- `plan/in-progress/*.md`, `review/consistency/**` — plan 체크리스트 갱신 및 consistency-check
  산출물(read-only 리포트). 코드 아님.

## 참고 (비차단, 새 발견 아님)

diff 에 포함된 `plan/in-progress/auth-guard-reflection-hardening.md` 와
`review/consistency/2026/08/09/20_02_21/plan_coherence.md` 자체가, 이미 머지된 PR #1108 의
동작(비-UUID `X-Workspace-Id` 헤더 → `400 VALIDATION_ERROR`, 헤더(loose)/경로 파라미터(strict)
UUID 검증 강도 비대칭)이 `spec/5-system/3-error-handling.md §1.3` 에러 코드 카탈로그와
`1-auth.md §3.3`에 아직 반영되지 않은 spec-lags-code 상태를 WARNING 으로 이미 적출·기록해
두었다(planner 턴 필요로 명시). 이는 **이번 diff 가 만든 새 결함이 아니라 이미 추적 중인
항목**이므로 이 리뷰에서 별도 등급으로 재등재하지 않는다 — API 계약 관점에서도 동일한 갭(에러
코드 카탈로그 완결성)이므로 후속 planner 턴에서 반영될 때 함께 확인하면 된다.

## 요약

diff 전체가 테스트 픽스처 통합·주석 정정·문서 재구조화·죽은 테스트 코드 제거·plan 체크리스트
갱신·consistency-check 산출물로 구성되어 있고, 컨트롤러·DTO·라우트·에러 필터 등 실제 API 계약
표면을 건드리는 프로덕션 코드 변경이 없다. 테스트가 검증하는 하위 로직(RolesGuard, 워크스페이스
헤더 검증)의 동작 자체는 이전 PR(#1108)에서 이미 확정·머지된 것을 그대로 재확인할 뿐이다.
따라서 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가
어느 관점에서도 이번 diff 로 인한 신규 위험은 없다.

## 위험도

NONE
