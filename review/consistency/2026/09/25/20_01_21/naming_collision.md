# 신규 식별자 충돌 검토 — target: 경로 파라미터 워크스페이스 가드 확장 (PR #1399/#1400)

대상 문서: `spec/2-navigation/9-user-profile.md`, `spec/5-system/1-auth.md`, `spec/data-flow/12-workspace.md`
(및 교차 참조되는 `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/13-replay-rerun.md`, `spec/2-navigation/6-config.md`, `spec/conventions/swagger.md`,
`spec/conventions/error-codes.md`)

## 발견사항

- **[INFO]** `ADMIN_REQUIRED`(UPPER, `RolesGuard`/`WorkspacesService.assertAdmin`) vs `admin_required`(lower, 초대 모듈 전용 historical-artifact) 공존
  - target 신규 식별자: 이번 변경으로 `RolesGuard` 의 가드 거부 코드로 `ADMIN_REQUIRED` 가 명시적으로 문서화됨(`spec/5-system/1-auth.md:284`, `spec/data-flow/12-workspace.md:400-410`)
  - 기존 사용처: `spec/conventions/error-codes.md:78` (초대 모듈 `workspace-invitations.service.ts` 의 `admin_required`, lowercase historical-artifact 로 등재)
  - 상세: 같은 "워크스페이스 admin 권한 필요" 의미를 대소문자만 다른 두 코드가 서로 다른 계층(가드 vs 서비스)·모듈에서 발행한다. 다만 이는 target 이 새로 만든 충돌이 아니라, target 이 정확히 이 지점을 실측·정정해 "2026-09-25 이후 `admin_required` 는 HTTP 로 나가지 않는다"·"의도적 분리"라고 명시적으로 문서화한 것이다(`error-codes.md:78`, `1-auth.md:287`). 즉 target 은 기존에 암묵적이던 근접 명명을 오히려 명확화했다.
  - 제안: 현 상태(문서화된 의도적 예외)로 충분. 추가 조치 불요 — 향후 새 코드가 이 lowercase 선례를 따르지 않도록 하는 가드는 이미 `error-codes.md §3`에 존재.

- **[INFO]** `FORBIDDEN` 코드의 범용 재사용
  - target 신규 식별자: 가드가 코드 미지정 시 필터 기본값으로 `FORBIDDEN` 을 명시(`spec/data-flow/12-workspace.md:397, 404`)
  - 기존 사용처: `codebase/backend/src/common/filters/http-exception.filter.ts:139`(전역 기본값), `integrations.service.ts`·`workflow-test-datasets.service.ts` 등 여러 모듈이 동일 `'FORBIDDEN'` 코드를 이미 범용으로 사용
  - 상세: 여러 모듈이 같은 문자열 코드를 쓰지만 전부 "일반 권한 거부" 라는 같은 의미로 쓰이는 전역 기본값이라 의미 충돌은 없음(신규 도입도 아님, 기존 필터 기본값을 문서가 인용한 것)
  - 제안: 조치 불요

## 점검 결과 상세 (충돌 없음 확인)

1. **요구사항 ID** — 이번 변경은 신규 요구사항 ID를 부여하지 않는다(기존 auth/workspace 스펙의 rationale 절 신설·기존 API 표 갱신).
2. **엔티티/타입명** — 신규 데코레이터 `@WorkspaceParam(name)` 은 기존 `@WorkspaceId()` 를 정의하던 동일 파일(`codebase/backend/src/common/decorators/workspace.decorator.ts`, #848 이래 존재)에 추가된 것으로, 사전 동명 사용 없음을 `git log --follow` 로 확인. 새 헬퍼 `routeArgEntriesMatching` 도 파일 내 신규 유일 식별자로 grep 0건(중복 없음) 확인.
3. **API endpoint** — 신규 엔드포인트를 추가하지 않는다. 기존 `/api/workspaces/:id/...` 15개 경로에 인가 계층만 강화(가드가 서비스 계층 검사를 보완). endpoint 충돌 해당 없음.
4. **이벤트/메시지명** — 해당 변경 범위에 webhook/queue/sse 이벤트 신설 없음.
5. **환경변수·설정키** — 신규 ENV/설정 키 없음(WebAuthn 환경변수 등은 기존 §1.4.3, 본 변경과 무관).
6. **파일 경로** — 신규 파일(`repo-guards/__tests__/workspace-param-binding-guard.ts`·`.spec.ts`, `workspace-roles-attachment.spec.ts`, `workspace.decorator.spec.ts`)은 `repo-guards/__tests__/` 기존 명명 컨벤션(`<주제>-guard.ts` + `<주제>.spec.ts`)을 그대로 따르며, `git log --follow` 로 사전 동일 경로 파일 없음을 확인. `plan/complete/spec-draft-workspace-path-guard*.md` 계열도 기존 관례(`spec-draft-<topic>[-followup|-role-census|-oracle-census]`)와 일치하고 상호 충돌 없음.

또한 이번 target 자체가 직전 `naming_collision` 리뷰(`review/consistency/.../18_42_32`)가 지적한 `integrations.service.ts` 의 로컬 중복 `ADMIN_ROLES` 를 공용 상수(`common/constants/workspace-roles.ts`)로 통합해 실제로 해소한 커밋(#1400)을 포함하고 있음을 확인했다 — 재발(re-flag) 대상 아님.

## 요약

target 이 도입하는 유일한 신규 식별자는 데코레이터 `@WorkspaceParam(name)`, 가드 거부 코드 표(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)의 명문화, 저장소 가드 `workspace-param-binding`, 그리고 두 개의 신설 Rationale 섹션(앵커 중복 없음 확인)이다. 이 중 `ADMIN_REQUIRED`/`OWNER_REQUIRED`/`EDITOR_REQUIRED`/`NOT_A_MEMBER` 는 모두 기존 코드베이스(`workspace-roles.ts`, `RolesGuard`, `WorkspacesService`)에 이미 존재하던 상수를 가드 계층까지 일관되게 넓혀 쓴 것이며, 유일한 근접-명명 잔존 사례(`ADMIN_REQUIRED` UPPER vs `admin_required` lower, 초대 모듈 한정)는 target 문서 자신이 명시적으로 "의도적 분리"로 문서화해 혼선 소지를 이미 닫았다. 신규 엔드포인트·ENV·이벤트명·요구사항 ID 도입은 없고, 신규 파일 경로는 기존 컨벤션을 그대로 따른다. 직전 리뷰 라운드가 지적한 `ADMIN_ROLES` 중복도 이번 target 커밋에서 해소됐다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
