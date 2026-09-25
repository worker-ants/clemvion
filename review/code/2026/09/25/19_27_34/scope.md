# 변경 범위(Scope) 리뷰 — `097411779` (경로 워크스페이스 가드 후속)

## 방법

리뷰 대상 8개 파일의 diff를 `git show 097411779 -- <path>`로 직접 재조회해 프롬프트의 게이트 줄 번호와 대조했다. 병행해서
`plan/in-progress/workspace-guard-followups.md`의 "요구 1~5" 목록과 diff hunk를 1:1 매핑했다.

## 발견사항

- **[INFO]** `transferOwnership` docstring에 계획서에 명시되지 않은 문장이 한 줄 추가됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership` 함수 docstring (파일 내 708행 부근, "인가는 트랜잭션 **밖**에서 무락으로 먼저 판정한다(존재 · 유형 오라클 제거). 아래 락 재검사는 동시 owner 변경과의 경합 대비로 남는다." 문장)
  - 상세: plan의 요구 4는 "두 멤버를 단일 IN 쿼리로 동시 락" 문장의 사실 정정만 명시한다. 이 커밋은 그 정정과 함께, 같은 docstring 블록에 사전 무락 인가 판정에 대한 설명 문장을 새로 끼워 넣었다. 코드 자체(`transferOwnership` 본문의 `getMemberRole` 사전 체크)는 이 diff에서 손대지 않은 기존 로직이라 — 문서가 서술하는 동작은 실재하고 사실과 부합한다. 기능 변경은 아니고 순수 문서 확장이라 위험도는 낮지만, plan에 명시되지 않은 서술 추가라는 점에서 "요구 이상의 변경"에 해당한다.
  - 제안: 별도 조치는 불필요. 다음에 plan에 없는 문서 확장을 넣을 때는 plan 요구 목록에 한 줄 추가해 두면 추적이 쉬워진다.

## 교차 검증 — 각 파일별 변경이 plan 요구와 일치하는지

- `common/constants/workspace-roles.ts` (요구 5의 부수 효과, plan INFO 3 처리): docstring만 갱신, 세 번째 소비처(`integrations.service.ts`) 언급 추가 — plan에 명시된 처리와 일치.
- `common/decorators/workspace.decorator.ts` (요구 1): `routeArgEntriesMatching` 공용 헬퍼 추출. 두 export 함수(`handlerConsumesWorkspaceId` · `workspaceParamNamesOf`) 시그니처·이름은 유지 — plan이 W1 경고 처리로 명시한 제약("부트 캐너리의 import·호출 대상은 바뀌지 않는다")과 정확히 일치. 순수 리팩터, 동작 분기(빈 배열 반환 등) 변경 없음.
- `modules/auth/auth.controller.ts`, `modules/executions/executions.controller.ts`, `modules/workspaces/workspaces.controller.ts` (요구 2): 403 설명 문자열의 하드코딩 코드명을 `NOT_A_MEMBER.code` / `ROLE_REQUIRED.*.code` 보간으로 교체. 보간 결과 문자열은 원래 리터럴과 바이트 단위로 동일(plan에 명시된 전제) — 실제로 대조해도 코드명이 그대로("NOT_A_MEMBER", "EDITOR_REQUIRED", "ADMIN_REQUIRED", "OWNER_REQUIRED")라 OpenAPI 출력 변화 없음. 각 파일에서 정확히 plan이 지목한 라우트(전환/재실행/chain/workspaces 각 라우트)만 건드림 — 다른 라우트의 `@ApiForbiddenResponse` 설명은 무변경.
- `modules/workspaces/workspaces.service.ts` (요구 3·4): `throwOwnerTransferRequired`를 `{ ...ROLE_REQUIRED.owner, message }`로 교체(요구 3) + `transferOwnership` docstring 정정(요구 4, 위 INFO 항목 제외하면 요구와 일치).
- `modules/workspaces/workspaces.service.spec.ts` (요구 3 동반): `transferOwnership` owner 이양 거부 유닛 테스트에 서비스 고유 문구(`message`) 단언 추가 — 요구 3이 "서비스 고유 문구를 unit에서 고정"이라 명시한 것과 정확히 대응.
- `modules/integrations/integrations.service.ts` (요구 5): 모듈 로컬 `const ADMIN_ROLES = new Set(['owner', 'admin'])` 제거하고 공용 `ADMIN_ROLES` import로 교체 — 값이 같음을 plan·commit 메시지 모두 명시, diff도 정확히 그 치환만.

## 스코프 외 변경 여부

- 무관한 파일 수정: 없음. `git show --stat`의 8개 파일이 프롬프트의 리뷰 대상 8개 파일과 정확히 일치.
- 불필요한 리팩토링/기능 확장: 없음. `routeArgEntriesMatching` 추출은 plan 요구 1이 명시적으로 지시한 범위이며, 새 기능이 아니라 기존 두 판별 함수의 중복 골격 통합.
- 포맷팅/주석/임포트 잡음: 각 파일의 import 추가(`NOT_A_MEMBER`, `ROLE_REQUIRED`, `ADMIN_ROLES`)는 실제 사용처가 있고, 그 외 임포트 순서·불필요한 정리는 관찰되지 않음.
- 설정 변경: 없음.

## 요약

리뷰 대상 8개 파일의 diff는 `plan/in-progress/workspace-guard-followups.md`가 명시한 5개 요구(reflection 골격 통합·403 설명 코드 보간·서비스 거부 스프레드·docstring 정정·`ADMIN_ROLES` 통합) 및 그 부수 처리(INFO 3 docstring 갱신, 서비스 유닛 테스트 갱신)와 1:1로 대응하며, 무관한 파일·기능 확장·포맷팅 잡음은 발견되지 않았다. 유일한 관찰 사항은 `transferOwnership` docstring에 plan에 명시되지 않은 한 문장(사전 무락 인가 판정 설명)이 함께 추가된 것인데, 이는 기존 코드 동작을 정확히 서술하는 순수 문서 확장이라 위험은 낮다.

## 위험도

LOW
