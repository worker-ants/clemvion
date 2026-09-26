# 신규 식별자 충돌 검토 — forbidden-desc-codes (`--impl-prep`)

대상: `spec/conventions/swagger.md` §5-4(403 설명의 거부 코드) 확장 + Rationale 신설, 관련 plan
(`plan/in-progress/forbidden-desc-codes.md`, `plan/in-progress/spec-draft-swagger-forbidden-codes.md`).

## 검증한 신규 식별자 목록과 결과

| 신규 식별자 | 위치(계획) | 저장소 grep 결과 | 판정 |
| --- | --- | --- | --- |
| `FORBIDDEN_NOT_A_MEMBER` (const) | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신설 예정) | 0건 (spec·plan 문서 외 코드 없음) | 충돌 없음 — 단 근접명 있음(아래 발견사항) |
| `forbiddenForRole(role)` (함수) | 同 | 0건 | 충돌 없음 |
| `forbidden-response-codes-guard.ts` / `.spec.ts` | `codebase/backend/src/repo-guards/__tests__/` | 0건, 기존 `<name>-guard.ts`/`<name>.spec.ts` 페어링 컨벤션과 일치 (`dto-class-name-collision-guard.ts` 등 선례) | 충돌 없음 |
| `lowestRequiredRole` (함수) | `codebase/backend/src/common/constants/workspace-roles.ts` (추출 예정) | 0건 — 현재 `RolesGuard.assertMember` 는 익명 `requiredRoles.reduce(...)` 로 인라인 계산, 이름 붙은 함수가 아직 없음 | 충돌 없음(신규 추출이 계획대로 진행되면 문제 없음) |
| `NOT_A_MEMBER` / `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED` | 재사용(신규 아님) | `spec/5-system/3-error-handling.md`·`common/constants/workspace-roles.ts` 에 2026-09-25 결정으로 이미 등재 | 문제 없음 — target 은 신설이 아니라 기존 코드를 설명 문구에 반영하는 소비자 |

## 발견사항

- **[WARNING]** 신규 `FORBIDDEN_NOT_A_MEMBER` 와 기존 로컬 상수 `FORBIDDEN_MEMBER` / `FORBIDDEN_MEMBER_ROUTE` 가 이름이 매우 근접
  - target 신규 식별자: `FORBIDDEN_NOT_A_MEMBER` (`common/swagger`, 신설 예정 — swagger.md §5-4 · Rationale)
  - 기존 사용처: `codebase/backend/src/modules/integrations/integrations.controller.ts:96` `const FORBIDDEN_MEMBER = ...`(및 `FORBIDDEN_MEMBER_OR_ADMIN`·`FORBIDDEN_MEMBER_OR_ORG_ADMIN`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71` `const FORBIDDEN_MEMBER_ROUTE = ...`(및 `FORBIDDEN_ADMIN_ROUTE`·`FORBIDDEN_OWNER_ROUTE`)
  - 상세: 두 로컬 상수는 지금 각 컨트롤러 파일 스코프에 이미 존재하는, 같은 의미("워크스페이스 멤버가 아님" 문장)의 module-private `const` 다. swagger.md Rationale(§5-4 확장 배경)은 이 상수들을 "이 헬퍼로 흡수한다" 고 명시해 충돌을 인지하고 있고, 이름 자체는 `FORBIDDEN_MEMBER` vs `FORBIDDEN_NOT_A_MEMBER` 로 겹치지 않는다(같은 `import` 스코프에서 동시 존재해도 컴파일 충돌은 없음). 다만 두 이름이 육안으로 매우 비슷해(`FORBIDDEN_MEMBER` 가 `FORBIDDEN_NOT_A_MEMBER` 의 부분 표현처럼 읽힘), 구현 단계에서 "흡수"가 완전히 끝나기 전(즉 새 헬퍼를 도입했지만 옛 로컬 상수를 아직 지우지 않은 중간 상태)에 두 이름이 같은 파일에 동시 존재하면 어느 것이 최신 SoT 인지 혼동하기 쉽다.
  - 제안: 구현 plan(`forbidden-desc-codes.md`) 5단계("129곳 설명 교체 · 워크스페이스 · integrations 상수를 헬퍼로")를 마칠 때, `workspaces.controller.ts`/`integrations.controller.ts` 의 `FORBIDDEN_MEMBER*`/`FORBIDDEN_*_ROUTE` 로컬 상수를 **삭제**(재-export 로 남기지 않음)했는지 저장소 전수 grep(`FORBIDDEN_MEMBER`)으로 확인한 뒤 plan 체크리스트에 반영할 것 — 두 이름이 최종 상태에 함께 남지 않게.

## 요약

target(swagger.md §5-4 확장)이 새로 도입하는 식별자는 헬퍼 `FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole(role)`, 저장소 가드 파일
`forbidden-response-codes{-guard.ts,.spec.ts}`, 추출 함수 `lowestRequiredRole` 넷이며, 전 저장소 grep 결과 넷 다 기존에 다른 의미로
쓰이는 동명 식별자가 없다(파일 경로도 기존 `<name>-guard.ts`/`<name>.spec.ts` 컨벤션과 일치). `NOT_A_MEMBER`·`ROLE_REQUIRED` 계열
코드는 신규가 아니라 2026-09-25 에 이미 등재된 기존 SoT 를 재사용하는 것으로 확인됐다. 유일한 주의점은 새 `FORBIDDEN_NOT_A_MEMBER`
가 흡수할 예정인 기존 로컬 상수 `FORBIDDEN_MEMBER`(integrations)·`FORBIDDEN_MEMBER_ROUTE`(workspaces) 와 이름이 근접하다는 것인데,
spec 이 이미 "흡수" 방향을 명시했고 plan 체크리스트도 상수 이관을 포함하므로 구현 완료 시점에 옛 이름이 남지 않는지만 확인하면 된다.
그 외 API endpoint·이벤트/메시지명·환경변수·요구사항 ID 축에서는 target 이 새로 도입하는 식별자가 없다(문서·설명 문구 강화이며 신규
엔드포인트나 신규 wire 코드를 만들지 않음).

## 위험도

LOW
