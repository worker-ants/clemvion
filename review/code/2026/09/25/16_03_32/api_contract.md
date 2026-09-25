# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `@Roles()` 가 붙은 **전 라우트(≈87곳: editor 66·admin 9·owner 7·viewer 5, 커밋 로그 실측치)** 의 403 응답 `error.code`/`error.message` 가 이번 변경으로 일괄 바뀐다 — 종전 `RolesGuard.canActivate` 는 거부를 `return false` 로만 표현해 전역 필터가 기본값 `FORBIDDEN` 을 채웠지만, 이제 `ForbiddenException({code,message})` 를 던져 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 를 싣는다. HTTP 상태(403)와 응답 envelope 구조(`{error:{code,message,requestId}}`, `common/filters/http-exception.filter.ts`)는 그대로라 파싱 자체는 안 깨지지만, `error.code === 'FORBIDDEN'` 로 분기하던 기존 클라이언트(내부·외부 불문)는 조용히 동작이 바뀐다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember`, 약 227~244행 부근 — `if (!role) throw new ForbiddenException(NOT_A_MEMBER)` / `throw new ForbiddenException(ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER)`)
  - 상세: 이 변경은 `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" 에 대안 비교(코드를 라우트 요구 기준으로 줄지, 비멤버는 항상 `NOT_A_MEMBER` 로 줄지)까지 포함해 상세히 근거가 남아 있고, `CHANGELOG.md` Unreleased 항목·`roles.guard.spec.ts`·`workspace-path-guard.e2e-spec.ts` 로 고정돼 있어 **의도치 않은 회귀는 아니다.** FE 코드(`grep` 결과)도 `'FORBIDDEN'` 코드에 의존하지 않아 즉각적 파손 위험은 낮다. 다만 이 저장소에는 API 버전 관리 체계(`/v1/` prefix·버전 헤더 등)가 없어, 이 정도 규모의 응답 계약 변경이 같은 버전 문자열 안에서 한 배포로 나간다 — 외부(서드파티) API 소비자가 존재한다면 사전 공지·이행 기간 없이 계약이 바뀌는 셈이라는 점은 짚어 둘 필요가 있다.
  - 제안: 현재 수준(spec Rationale + CHANGELOG + e2e)의 문서화는 이미 이 프로젝트 관례상 적절하다고 판단됨. 외부 API 소비자가 있다면 배포 노트에 `error.code` 변경을 명시적으로 announce 할 것을 권장.

- **[WARNING]** `workspace-invitations.service.ts` 의 `assertAdmin()` 이 던지는 `code:'admin_required'`(소문자) 가 HTTP 경로에서 **도달 불가능한 죽은 코드**가 됐다. `listInvitations`/`createInvitation`/`resendInvitation`/`revokeInvitation` 컨트롤러 메서드에 `@Roles('admin')` 이 새로 붙어 `RolesGuard` 가 서비스 호출 전에 먼저 `ADMIN_REQUIRED`(대문자) 로 막기 때문이다. 이 case 변경(`admin_required`→`ADMIN_REQUIRED`) 자체는 `CHANGELOG.md` 에 명시돼 있어 놀랄 일은 아니지만, 서비스 쪽 예외 정의·메시지가 이제 실질적으로 죽은 코드로 남아 다음 사람이 "이 API 가 여전히 `admin_required` 를 낼 수 있다"고 오인할 소지가 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:541` (`assertAdmin`) / 호출부 `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:83,242,395,408` (`invite`/`resend`/`listPending`/`revoke`) / 컨트롤러 쪽 `@Roles('admin')` 추가: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:317,350,441,486,536`
  - 제안: `assertAdmin` 사설 메서드·`admin_required` 예외를 제거하거나(가드가 이미 100% 선점), 최소한 "가드가 먼저 막아 이 분기에는 HTTP 로 도달하지 않는다"는 주석을 남겨 다음 사람의 오독을 막을 것.

- **[WARNING]** 이번 diff의 Swagger(`@ApiForbiddenResponse`) 문서 갱신이 **부분적**이라 같은 파일 안에서도 일관성이 깨진다. `executions.controller.ts` 는 `reRun`(279행)·`getChain`(309행) 만 새 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`)를 명시하도록 갱신됐고, 같은 컨트롤러의 `stop`(137행, `'editor 이상 권한 필요'` 로만 표기 — 실제로는 비멤버 시 `NOT_A_MEMBER` 도 나가는데 언급이 없다)·`findOne`(74행)·`findByWorkflow`(106행)·`continueExecution`(160행, 모두 `'워크스페이스 멤버가 아님'` 만 표기)는 코드 문자열 언급 없이 그대로다. 더 넓게 보면 `RolesGuard` 변경은 전역 적용(`@Roles()` 87곳)인데 이 diff 밖의 다른 컨트롤러(예: `codebase/backend/src/modules/workflows/workflows.controller.ts` 의 다수 `@Roles('editor')` 라우트, 136·162·184·206·234·262행 등)의 `@ApiForbiddenResponse` 설명도 실제 코드(`EDITOR_REQUIRED`)를 반영하지 못한 채 남아 있다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:74,106,137,160` (미갱신) vs `:279,309`(갱신) / `codebase/backend/src/modules/workflows/workflows.controller.ts:136` 등(diff 범위 밖, 전역 영향은 받음)
  - 상세: 오류는 아니고 응답이 문서와 모순되지도 않지만("editor 권한 필요"라는 설명 자체는 여전히 맞음), OpenAPI 스펙으로 클라이언트를 생성하는 소비자 입장에서 머신 판독 가능한 `code` enum 정보가 라우트마다 있다 없다 하는 것은 "API 응답 형식의 일관성" 관점에서 개선 여지다.
  - 제안: 코드 문자열을 명시하는 쪽으로 스타일을 통일하되, 전체 라우트를 한 PR 에서 갱신하기 부담스러우면 후속 트래커 항목으로 남길 것(이미 CHANGELOG 에 유사한 "OpenAPI 가 광고하는 계약" 트래커 관례가 있다).

- **[INFO]** 형식은 맞지만 존재하지 않는 워크스페이스 경로 값(예: nil UUID `00000000-…`)의 상태 코드가 `400`(종전 `ParseUUIDPipe` 도달 전 가드 부재) → `403 NOT_A_MEMBER` 로 바뀐다. `@WorkspaceParam` 은 가드가 파이프보다 먼저 돌아 `isUuidShaped`(형식만 검사)로 판정하는데, 이 정규식이 `ParseUUIDPipe()` 기본(`version` 미지정 → `'all'`) 정규식과 정확히 동일함을 코드 대조로 확인했다(`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) — 두 판별이 발산하지 않으므로 "형식 통과 판정과 실제 400 을 내는 파이프의 기준이 다르다"는 걱정은 기각됨. 상태 코드 변화 자체는 `spec/data-flow/12-workspace.md`·`CHANGELOG.md`·`workspace-path-guard.e2e-spec.ts` 에 명시돼 있어 의도된 계약 변경이다. 참고로만 기록.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:174-181` (path-param 루프) / `codebase/backend/src/common/decorators/workspace.decorator.ts:114-115` (`WorkspaceParam` 의 `ParseUUIDPipe` 내장)

- **[INFO]** 인가 판정 순서 재배치(`workspaces.service.ts`) 는 계약을 깨지 않는 것으로 판단됨. `renameWorkspace`(구 `assertWorkspaceType` → `assertAdmin`) 의 호출 순서를 `assertAdmin` 먼저로, `leaveWorkspace` 에 `assertMembership` 을 조회보다 먼저 추가했다 — 비멤버가 "없음(404)·개인·팀" 을 구분하던 오라클을 서비스 계층에서도 닫는 변경이라 `RolesGuard` 의 신규 가드와 방향이 같다. 정상 사용자 기준 최종 코드·상태는 보존된다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`renameWorkspace` 약 253~262행, `leaveWorkspace` 약 647~653행)

## 설계상 확인된 양호 사항 (참고)

- `@WorkspaceParam` 도입으로 `transferOwnership` 등 경로 워크스페이스 라우트의 `@Roles()` 판정이 **헤더/토큰 워크스페이스가 아니라 경로 워크스페이스**를 보게 고쳐졌다 — 종전에는 자기 워크스페이스의 owner 가 다른 워크스페이스 헤더를 실으면 정당한 이양이 오탐 403 이 되거나(또는 반대로 헤더 조작으로 가드를 우회할 수 있는) cross-tenant 성격의 결함이었다. e2e(`workspace-path-guard.e2e-spec.ts`)가 양방향을 모두 검증한다.
- 신설 CI 정적 가드 `workspace-param-binding` 이 워크스페이스 경로 파라미터를 평범한 `@Param` 으로 받는 회귀를 구조적으로 막는다 — 데코레이터 규약(요청 검증·URL 설계)의 일관성을 강제하는 좋은 장치.
- `ROUTE_ARGS_METADATA` reflection 기반 부트 캐너리(`workspace-reflection-canary.ts`)가 두 팩토리(`@WorkspaceId`/`@WorkspaceParam`) 인식을 함께 세어 fail-closed 로 부팅을 멈추는 설계는 인가 우회를 조기에 잡는 유효한 방어선이다.
- 단위(`roles.guard.spec.ts`)·e2e(`workspace-path-guard.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`) 테스트가 다중 경로 파라미터, 헤더+경로 혼합 핸들러, 동시성 경합 등 엣지 케이스까지 촘촘히 고정하고 있다.

## 요약

이번 변경은 워크스페이스를 경로 파라미터로 받는 15개 엔드포인트(`workspaces.controller.ts` 14 · `auth.controller.ts` 전환 1)에 대해 `RolesGuard` 가 경로 값을 직접 인가 대상으로 판정하도록 확장하고, 가드의 멤버십·역할 거부에 머신 판독 가능한 오류 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 부여한다. 핵심 보안 목적(`transferOwnership` 등에서 헤더/토큰 워크스페이스가 아닌 경로 워크스페이스를 판정하게 함, 비멤버의 존재·유형 오라클 제거)은 타당하고 spec Rationale·CHANGELOG·풍부한 단위/e2e 테스트로 뒷받침된다. API 계약 관점의 핵심 리스크는 **`@Roles()` 가 붙은 약 87개 라우트 전체의 403 응답 코드가 `FORBIDDEN` 에서 구체 코드로 일괄 바뀐다**는 점인데, 이는 의도된 것으로 잘 문서화·테스트돼 있어 CRITICAL 로 볼 결함은 아니다. 다만 (1) `workspace-invitations.service.ts` 에 이제 도달 불가능해진 소문자 `admin_required` 정의가 죽은 코드로 남아 있고, (2) 이번 diff에서 갱신된 Swagger `@ApiForbiddenResponse` 설명이 같은 파일 안에서도 라우트마다 들쭉날쭉해 OpenAPI 문서와 실제 응답 코드 표기 수준이 일관되지 않는다 — 두 지점 모두 정리하면 계약 문서의 신뢰도가 높아진다.

## 위험도

MEDIUM
