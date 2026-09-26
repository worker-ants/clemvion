# 신규 식별자 충돌 검토 — `forbidden-desc-codes` / `spec-draft-swagger-forbidden-codes`

## 대상 신규 식별자 목록

target 문서(`plan/in-progress/forbidden-desc-codes.md` + `plan/in-progress/spec-draft-swagger-forbidden-codes.md`, `spec/conventions/swagger.md` §5-4 개정)가 새로 도입하는 식별자:

| 종류 | 식별자 | 위치(예정) |
| --- | --- | --- |
| 상수 | `FORBIDDEN_NOT_A_MEMBER` | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신규 파일) |
| 함수 | `forbiddenForRole(role)` | 위 동일 파일 |
| 함수(추출) | `lowestRequiredRole` | `codebase/backend/src/common/constants/workspace-roles.ts` |
| 저장소 가드 | `forbidden-response-codes` (+ `-guard.ts`, `.spec.ts`) | `codebase/backend/src/repo-guards/__tests__/` |
| spec Rationale 절 | `### §5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)` | `spec/conventions/swagger.md` §Rationale |
| plan 파일 | `plan/in-progress/forbidden-desc-codes.md`, `plan/in-progress/spec-draft-swagger-forbidden-codes.md` | — |

## 발견사항

이번 grep 전수 조사(`codebase/backend`, `codebase/frontend`, `codebase/packages`, `codebase/channel-web-chat`, `spec/`, `plan/`)에서 CRITICAL·WARNING 등급 충돌은 발견되지 않았다.

- **[INFO]** `FORBIDDEN_NOT_A_MEMBER` 상수명과 `NOT_A_MEMBER` 코드 상수의 표기 근접
  - target 신규 식별자: `FORBIDDEN_NOT_A_MEMBER` (`common/swagger/forbidden-descriptions.ts`, 사람이 읽는 Swagger 설명 문자열)
  - 기존 사용처: `codebase/backend/src/common/constants/workspace-roles.ts:45` 의 `NOT_A_MEMBER` (`{ code: 'NOT_A_MEMBER', message: ... }`, `ForbiddenException` 본문 객체)
  - 상세: 두 식별자는 서로 다른 타입(문자열 설명 vs `WorkspaceRoleRejection` 객체)이고 import 경로도 다르므로 실사용 충돌은 없다. 다만 `FORBIDDEN_NOT_A_MEMBER` 가 `NOT_A_MEMBER` 코드값을 문자열 안에 보간해 만든 "완성 문장" 이라는 점에서, 향후 편집자가 `grep NOT_A_MEMBER` 결과 중 "이것도 코드 상수인가" 혼동할 여지가 있다. 두 plan 문서 모두 이 관계를 명시(§Rationale)하고 있어 실제 위험은 낮다.
  - 제안: 별도 조치 불필요. 헬퍼 파일의 JSDoc 에 "이 상수는 완성된 설명 문장이며 `NOT_A_MEMBER.code` 를 보간한 결과다"라는 한 줄을 남기면 향후 혼동을 더 줄일 수 있다(강제 아님).

- **[INFO]** 신규 로컬 상수 명명 축의 전환 (`FORBIDDEN_*_ROUTE` → `FORBIDDEN_NOT_A_MEMBER`)
  - target 신규 식별자: `FORBIDDEN_NOT_A_MEMBER`
  - 기존 사용처: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71-73` 의 로컬 상수 `FORBIDDEN_MEMBER_ROUTE` · `FORBIDDEN_ADMIN_ROUTE` · `FORBIDDEN_OWNER_ROUTE`
  - 상세: 기존 로컬 상수는 `FORBIDDEN_<권한>_ROUTE` 축을, 신규 공용 헬퍼는 `FORBIDDEN_<코드명>` 축을 쓴다 — 두 축이 같은 파일에서 공존하면 이름만으로 구분이 어려울 수 있다. 다만 구현 plan(`forbidden-desc-codes.md` §방향)이 이 로컬 상수 셋을 헬퍼로 옮기고 "같은 문장이 두 벌이 되지 않게" 명시적으로 정리하겠다고 적어 두었으므로, 구현이 계획대로 되면 신·구 축이 동시에 남지 않는다.
  - 제안: 구현 단계에서 `FORBIDDEN_MEMBER_ROUTE` 등 로컬 상수가 헬퍼 이관 후에도 잔존하지 않는지(중복 정의) `--impl-done` 리뷰에서 확인.

- **식별자 자체의 신규성 확인** — `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole` · `forbidden-response-codes` · `forbidden-descriptions.ts` · `lowestRequiredRole` 모두 grep 0건(현재 `codebase/backend/src/common/swagger/`, `src/repo-guards/__tests__/`, `src/common/constants/workspace-roles.ts` 어디에도 미존재) — 순수 신규이며 기존 항목과의 이름 재사용 없음.
- **파일 경로** — 신규 파일 `src/common/swagger/forbidden-descriptions.ts` 는 같은 디렉터리의 `api-wrapped.ts` · `error-response.dto.ts` 명명 컨벤션(kebab-case 명사구)을 따른다. 신규 가드 파일 `forbidden-response-codes{-guard.ts,.spec.ts}` 도 `src/repo-guards/__tests__/` 의 `<name>-guard.ts` + `<name>.spec.ts` 컨벤션과 일치하며, 기존 가드 파일명(`http-status-advertised*`, `param-uuid-pipe*` 등)과 겹치지 않는다.
- **plan 파일명** — `plan/in-progress/forbidden-desc-codes.md` · `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 는 `plan/complete/` 의 기존 유사 파일(`classify-forbidden-workspace.md` · `spec-fix-swagger-forbidden-response.md` · `spec-sync-stop-editor-and-forbidden-routes.md`)과 이름이 겹치지 않는다(모두 이미 종결된 별개 작업).
- **요구사항 ID / API endpoint / 이벤트명 / ENV 변수** — target 은 이 네 축에서 신규 식별자를 도입하지 않는다(가드·헬퍼·spec 문구 개정만). 충돌 대상 없음.
- **spec 앵커** — 신규 Rationale 절 제목(`### §5-4 403 설명의 거부 코드 — …`)은 `swagger.md` 내 다른 `§5-4` 관련 Rationale 절(`### §5-4 확장 배경 — …`, 2026-08-08)과 제목이 겹치지 않아 앵커 슬러그 충돌이 없다. `NOT_A_MEMBER` · `ADMIN_REQUIRED` · `EDITOR_REQUIRED` 등 코드 상수는 이번 target 전체에서 항상 `workspace-roles.ts` 정의 하나만 가리키며 재정의된 곳이 없다.

## 요약

target 이 새로 도입하는 식별자(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole` · `forbidden-response-codes` 가드 · `forbidden-descriptions.ts` · `lowestRequiredRole` · 두 plan 파일)는 backend·frontend·packages·channel-web-chat·spec·plan 전역 grep 상 현재 미사용 상태이며, 파일 경로·명명 컨벤션도 기존 `repo-guards/__tests__` 및 `common/swagger` 관례를 그대로 따른다. 유일하게 주목할 지점은 신규 `FORBIDDEN_NOT_A_MEMBER`(완성 문장 상수)와 기존 `NOT_A_MEMBER`(코드 객체) 사이의 표기적 근접, 그리고 `workspaces.controller.ts` 의 구 로컬 상수 축(`FORBIDDEN_*_ROUTE`)과 신규 헬퍼 축의 공존 가능성인데, 둘 다 target 문서가 이미 관계를 설명하고 있고 구현 plan 이 구 상수 이관을 명시했으므로 CRITICAL/WARNING 으로 격상할 근거는 없다.

## 위험도
LOW
