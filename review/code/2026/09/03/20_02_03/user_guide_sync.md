# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 19행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (같은 19행) 을 함께 Read.
- 변경 file 목록: prompt 제공 3건. `git status --short` / `git diff --name-only HEAD` 로 보강 확인 — 이 3건은 이미 커밋된 상태(작업트리 clean, 리뷰 산출물 디렉터리만 untracked)라 diff 대상은 최근 커밋(`af1651264` 계열)의 변경분과 동일.
  - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts`
  - `plan/in-progress/entity-nullable-column-type-mismatch.md`

## trigger 매칭

1. **`backend-api-change`** (`change_type: "백엔드 API 추가·변경"`, glob `codebase/backend/src/**/dto/**`, match: semantic) — `workspace-response.dto.ts` 가 이 glob 에 매칭. `WorkspaceInvitationDto.invitedBy` 가 `@ApiProperty({ format: 'uuid' })`(required) → `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `invitedBy?: string | null` 로 변경됐다.
   - PROJECT.md 표 middle column: "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
   - **(a) 충족** — 같은 diff 안에 JSDoc(`invited_by` 는 `ON DELETE SET NULL`(V017) 이라 초대자 계정이 삭제되면 NULL 이 되고… 근거 설명)이 `@ApiPropertyOptional` 바로 위에 추가됨. Swagger 계약과 사유가 소스에 동반 문서화됨.
   - **(b) 판단 — 영향 없음, 확인함**: `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 를 grep 했으나 "초대" 관련 서술(§멤버 초대하기, §초대를 받은 사용자)에 만료 시각만 언급하고 "누가 초대했는지"(inviter) 는 어디에도 노출되지 않는다. Frontend 측 `WorkspaceInvitationSummary.invitedBy`(`codebase/frontend/src/lib/api/workspaces.ts:154`) 타입은 이미 `string | null` 이었고(이 PR 이전부터 옳았음), 어떤 `.tsx` 컴포넌트도 `.invitedBy` 를 렌더링하지 않는다(`grep -rn "\.invitedBy\b" --include="*.tsx"` 0건). 즉 이 필드는 API 계약상만 존재하고 실제 UI 서피스가 없어 user-guide 페이지가 다뤄야 할 "사용자 가시 동작"이 아니다.
   - 결론: DTO 트리거는 매칭됐고, middle column 두 항목 모두 충족(또는 조건부 미해당이 근거로 확인됨) — **동반 갱신 누락 없음**.

2. `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — 변경 파일은 `modules/workspaces/**` 이지 `modules/auth/**` 가 아니며, 인증·세션·권한 로직(로그인, 토큰 검증, RBAC 미들웨어) 자체는 건드리지 않았다(순수 nullable 타입 정정 + 통과 동작 캐너리 테스트). **매칭 아님**으로 판단.

3. 그 외 trigger(new-node/node-schema-change/new-ui-string/integration-provider-change/new-userguide-section-dir/expression-language-change/run-debug-flow-change/new-warning-code/new-error-code 등) — 변경 파일 3건 중 어느 것도 nodes/, `.tsx` 신규 문자열, provider, 신규 docs 섹션, expression-engine, warningRules/error-codes.ts 를 건드리지 않아 **매칭 없음**.

4. `plan/in-progress/entity-nullable-column-type-mismatch.md` — plan 트래커 문서. 매트릭스 어떤 trigger 의 glob/semantic 대상도 아님(plan 문서는 매트릭스 target 이 아니라 developer 작업 기록).

## 발견사항

없음 — 위 (1) `backend-api-change` 매칭 건은 middle column 요구사항이 모두 충족되거나(swagger jsdoc) 조건부 미해당이 근거로 확인됐다(user-guide 페이지 영향 없음, 필드가 어떤 UI 서피스에도 노출되지 않음을 grep 으로 실측).

## 요약

매트릭스 19개 trigger 행 중 이번 changeset(backend DTO nullable 정정 1파일 + 대응 unit spec 1파일 + plan 문서 1파일)에 매칭된 것은 `backend-api-change`(DTO glob) 1건뿐이다. 그 1건의 동반 갱신 요구(swagger jsdoc)는 diff 안에서 이미 충족됐고, 조건부 요구(user-guide 페이지)는 해당 필드가 어떤 frontend 컴포넌트에도 렌더링되지 않음을 grep 으로 확인해 "영향 없음"으로 판단했다. `auth-session-flow-change` 는 glob(`modules/auth/**`)과 의미(인증/세션 흐름) 양쪽 다 매칭되지 않는다. 누락 0건.

## 위험도

NONE
