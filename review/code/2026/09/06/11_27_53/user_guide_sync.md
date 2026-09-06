# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 개요

`.claude/config/doc-sync-matrix.json`(rows 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 적재해 변경 파일 13개(`git diff --stat origin/main...HEAD -- . ':!review'` 로 재확인 — CHANGELOG.md 포함 13개, 나머지 41개는 `review/code/**`·`review/consistency/**` 산출물이라 매트릭스 trigger 대상 아님)를 매칭했다.

이번 변경의 실질 내용은 `User` 엔티티 민감 컬럼 노출을 잡는 **검출 인프라**(정적 AST 가드 `user-entity-exposure-guard.ts` + 런타임 이름 기반 단언 `user-secret-absence.ts`)와, 그 계기로 드러난 `WorkflowVersionsService.findOne` 의 `creator` 미투영 유출 수정, 그리고 `WorkspaceMemberDto.joinedAt` 뒤늦은 선언이다. 아래 매칭 결과를 보면 노드·i18n·docs MDX·provider·표현식 언어·실행/디버깅·인증 흐름 어느 trigger 도 실질적으로 걸리지 않는다.

## 매칭 검토

- **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 글로브에 해당하는 파일 없음. 매칭 안 됨.
- **신규 UI 문자열(TSX)** — 변경 파일 13개 중 `.tsx` 없음(전부 backend `.ts`/`.md`/`.json`). 매칭 안 됨.
- **통합/제공자 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경, 유저 가이드 신규 섹션 디렉토리** — 해당 글로브(`codebase/packages/expression-engine/**`, `codebase/frontend/src/content/docs/*/`) 에 닿는 파일 없음. 매칭 안 됨.
- **신규 warningCode/errorCode 발행** — `warningRules`, `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음. 매칭 안 됨.
- **인증·권한·세션 흐름 변경** (trigger glob: `codebase/backend/src/modules/auth/**`) — 변경 파일 중 `src/modules/auth/**` 는 하나도 없다. `workspace-rbac.e2e-spec.ts` 에 새 e2e 케이스(멤버 목록 응답에 `User` 비밀 컬럼 없음 검증)가 추가됐지만, 이는 **RBAC 권한 판정 로직이나 세션 흐름 자체를 바꾼 것이 아니라** 기존 `WorkspacesService.listMembers` 응답 형태를 처음으로 무는 e2e 를 추가한 것뿐이다(서비스 코드 자체는 이번 diff 에 없음, `WorkspaceMemberDto`/e2e만 변경). 흐름 변경이 아니므로 `07-workspace-and-team/` 갱신 의무는 발생하지 않는다고 판단.
- **백엔드 API 추가·변경** (trigger glob 포함: `codebase/backend/src/**/dto/**`) — `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` 가 이 glob 에 정확히 매칭된다(`WorkspaceMemberDto.joinedAt: string | null` 신규 필드). 이 후보를 아래에서 실측으로 판정했다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 매트릭스 "백엔드 API 추가·변경" trigger 에 매칭되지만, 실측 결과 user-guide 페이지 갱신 의무가 발생하지 않는 그레이존으로 판정
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (게이트 78-93, `joinedAt` 필드 신규 선언)
  - 매트릭스 항목: "백엔드 API 추가·변경" — targets: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 검토: (a) 는 이미 충족 — `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + 왜 nullable 인지·왜 상시 존재인지를 설명하는 JSDoc 이 함께 있다. (b) 를 판정하기 위해 실측:
    - `grep -rn joinedAt codebase/frontend/src` → 유일한 참조는 `codebase/frontend/src/lib/api/workspaces.ts:10` 의 TS 타입 선언 (`joinedAt: string | null;`) 뿐. 이 값을 실제로 렌더링하는 컴포넌트는 0건.
    - `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 에 "합류"/"가입" 언급이 있으나 전부 초대 수락 플로우 서술이고, 멤버 목록 테이블에 "합류일" 컬럼이 있다는 서술은 없음 — 즉 이 필드가 문서화해야 할 기존 UI 요소가 애초에 없다.
    - CHANGELOG·DTO JSDoc 은 "`WorkspacesService.listMembers` 가 이미 무조건 `joinedAt` 을 실었고 FE 는 이미 그 타입으로 소비 중"이라고 명시 — wire 동작 자체는 바뀌지 않았고 DTO 선언을 실제에 맞춘 것뿐이다(§5.4 준수, 신규 사용자 가시 기능 아님).
  - 결론: user-guide 페이지가 갱신해야 할 신규 사용자 가시 기능이 없다(필드가 렌더링되지 않는 dormant 필드). CRITICAL/WARNING 아님 — INFO 로 하향, 후속 작업에서 이 필드를 실제 UI에 노출시키는 시점에 `07-workspace-and-team/workspaces-and-members.mdx`(+`.en.mdx`) 동반 갱신을 다시 점검할 것.
  - 제안: 조치 불요. 다음에 이 필드를 프론트엔드 테이블에 실제로 렌더링하는 PR 이 나오면, 그 PR 이 이 매트릭스 항목의 (b) 를 다시 트리거한다는 점을 인지.

## 요약

매트릭스 21개 trigger 중 이번 변경 13개 파일(backend 서비스/DTO/가드/e2e·CHANGELOG·plan)에 실질적으로 매칭된 것은 "백엔드 API 추가·변경" 1건(`WorkspaceMemberDto.joinedAt`)뿐이며, 실측(frontend 미사용·swagger jsdoc 기 충족·wire 동작 불변) 결과 user-guide 동반 갱신 누락은 없다고 판정했다(INFO 1건, CRITICAL/WARNING 0건). 노드 추가/schema 변경, TSX 신규 문자열, provider·표현식 언어·실행-디버깅·인증 흐름·신규 섹션 디렉토리·warning/error 코드 trigger 는 모두 이번 changeset 과 무관하다 — 이번 PR 은 순수 backend 보안 방어/검출 인프라(가드·테스트)와 그 계기로 드러난 데이터 유출 수정이라 사용자 가시 기능·UI 문자열·문서 대상 변경이 없다.

## 위험도

NONE
