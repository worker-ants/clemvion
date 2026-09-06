# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 개요

`.claude/config/doc-sync-matrix.json`(rows 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표를 적재했다. `git diff --name-only origin/main...HEAD` 로 변경 파일을 재확인하니 총 77개 경로가 잡히지만, 그중 64개는 `review/code/**` · `review/consistency/**` 산출물(직전 라운드들의 리뷰 리포트·meta.json·RESOLUTION.md 등)로 매트릭스 trigger 대상이 아니다. 매트릭스 판단 대상은 나머지 13개뿐이다:

- `CHANGELOG.md`
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}`
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`
- `codebase/backend/src/shared/testing/user-secret-absence.{ts,spec.ts}`
- `codebase/backend/test/audit-logs.e2e-spec.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `codebase/backend/test/workspace-rbac.e2e-spec.ts`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

이번 변경의 실질 내용은 `User` 엔티티 민감 컬럼 노출을 잡는 **검출 인프라**(정적 AST 가드 `user-entity-exposure-guard.ts` + 런타임 이름 기반 단언 `user-secret-absence.ts`, 그 fixture/spec), 그 계기로 드러난 `WorkflowVersionsService.findOne` 의 `creator` 미투영 유출 수정(+ 후속 라운드의 `CREATOR_PROJECTION` 상수화·가드 강화), 그리고 `WorkspaceMemberDto.joinedAt` 뒤늦은 선언 및 그 둘을 무는 e2e 3건이다. 노드·i18n·docs MDX·provider·표현식 언어·실행/디버깅·인증 흐름 어느 trigger 도 이 파일 집합에는 실질적으로 걸리지 않는다.

이 changeset(13개 파일)은 같은 세션 직전 라운드(`review/code/2026/09/06/11_27_53/user_guide_sync.md`)가 이미 검토한 파일 목록과 **동일**하다 — 그 사이 3개 fix 커밋(`96d3856a9`→`4d49aa575`→`9a186fa31`→`01b078379`)이 가드 로직·투영 리터럴을 더 다듬었을 뿐, 매트릭스 trigger 매칭에 영향을 주는 신규 파일(신규 노드·신규 `.tsx`·신규 docs 섹션·`modules/auth/**`·`expression-engine/**` 등)은 추가되지 않았다. 아래는 그 결론을 이번 라운드 파일 목록으로 독립 재확인한 결과다.

## 매칭 검토

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 파일 없음.
- **신규 UI 문자열(TSX)** (`codebase/frontend/src/**/*.tsx`) — 변경 파일 13개 중 `.tsx` 없음(전부 backend `.ts` / 최상위 `.md` / `plan/*.md`). 매칭 안 됨.
- **통합/제공자 변경, 표현식 언어 변경(`codebase/packages/expression-engine/**`), 실행·디버깅 흐름 변경, 유저 가이드 신규 섹션 디렉토리(`codebase/frontend/src/content/docs/*/`)** — 해당 글로브에 닿는 파일 없음. 매칭 안 됨.
- **신규 warningCode/errorCode 발행** — `warningRules`, `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음. 매칭 안 됨.
- **인증·권한·세션 흐름 변경** (trigger glob: `codebase/backend/src/modules/auth/**`) — 변경 파일 중 `src/modules/auth/**` 는 하나도 없다. `workspace-rbac.e2e-spec.ts` 에 새 e2e(`J. GET /:id/members — 멤버 목록에 User 비밀 컬럼이 실리지 않는다`)가 추가됐지만, RBAC 판정 로직·세션 흐름 자체를 바꾼 것이 아니라 기존 `WorkspacesService.listMembers`(diff 밖, 무변경) 응답 형태를 처음으로 무는 회귀 테스트일 뿐이다. `07-workspace-and-team/` 갱신 의무는 발생하지 않는다.
- **백엔드 API 추가·변경** (trigger glob: `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**`) — `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` 가 `dto/**` 에 정확히 매칭된다(`WorkspaceMemberDto.joinedAt: string | null` 신규 필드, 게이트 78-93). 아래 발견사항에서 실측으로 판정.
  - `workflow-versions.service.ts` 의 `creator` 투영 축소(전체 `User` → 참조 3필드)는 **컨트롤러/DTO 파일 자체의 diff 가 아니라 서비스 내부**라 이 glob 에 직접 걸리지 않는다. 내용상으로도 노출 컬럼을 **줄이는** 보안 수정이라 사용자에게 새로 안내할 기능이 아니다(응답 형태는 항상 `WorkflowVersionCreatorDto` 광고 집합과 일치해야 했던 계약을 사후에 맞춘 것).

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 매트릭스 "백엔드 API 추가·변경" trigger 에 매칭되지만, 실측 결과 user-guide 페이지 갱신 의무가 발생하지 않는 그레이존
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (게이트 78-93, `joinedAt` 필드 신규 선언)
  - 매트릭스 항목: "백엔드 API 추가·변경" — targets: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 실측:
    - `grep -rn joinedAt codebase/frontend/src` → 유일한 참조는 `codebase/frontend/src/lib/api/workspaces.ts:10` 의 TS 타입 선언(`joinedAt: string | null;`) 뿐. 이 값을 실제로 렌더링하는 컴포넌트는 0건.
    - `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 에 "합류"/"가입" 언급이 있으나 전부 초대 수락 플로우 서술이고, 멤버 목록 테이블에 "합류일" 컬럼이 있다는 서술은 없음 — 문서화해야 할 기존 UI 요소가 애초에 없다.
    - DTO 의 JSDoc 이 이미 "`WorkspacesService.listMembers` 가 무조건 `joinedAt` 을 실었고 FE 는 이미 그 타입으로 소비 중"이라고 명시 — wire 동작 자체는 바뀌지 않았고 §5.4 준수를 위해 DTO 선언을 실제에 맞춘 것뿐이다.
  - 상세: (a) swagger jsdoc 은 이미 충족 — `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + 왜 nullable 인지·왜 상시 존재하는지 설명하는 JSDoc 동반. (b) 는 판정 결과 신규 사용자 가시 기능이 없다(필드가 렌더링되지 않는 dormant 필드) — CRITICAL/WARNING 사유 아님.
  - 제안: 조치 불요. 다음에 이 필드를 프런트엔드 멤버 테이블에 실제로 렌더링하는 PR 이 나오면, 그 PR 이 이 매트릭스 항목의 (b)를 다시 트리거한다는 점만 인지해 두면 된다.

## 요약

매트릭스 21개 trigger 중 이번 변경 13개 파일(backend 서비스/DTO/가드/e2e·CHANGELOG·plan)에 실질적으로 매칭된 것은 "백엔드 API 추가·변경" 1건(`WorkspaceMemberDto.joinedAt`)뿐이며, 실측(frontend 미사용·swagger jsdoc 기 충족·wire 동작 불변) 결과 user-guide 동반 갱신 누락은 없다(INFO 1건, CRITICAL/WARNING 0건). 이 결론은 같은 세션 직전 라운드(`11_27_53`)의 동일 파일 집합 판정과 일치하며, 그 사이의 fix 커밋들은 가드 내부 로직만 다듬었을 뿐 매트릭스 매칭에 영향을 주는 신규 표면(노드·TSX·docs 섹션·auth 모듈·표현식 엔진)을 추가하지 않았다. 노드 추가/schema 변경, TSX 신규 문자열, provider·표현식 언어·실행-디버깅·인증 흐름·신규 섹션 디렉토리·warning/error 코드 trigger 는 모두 이번 changeset 과 무관하다 — 순수 backend 보안 방어/검출 인프라(가드·테스트)와 그 계기로 드러난 데이터 유출 수정이라 사용자 가시 기능·UI 문자열·문서 대상 변경이 없다.

## 위험도

NONE
