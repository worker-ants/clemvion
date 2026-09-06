# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]` 22건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 적재했다.

## 변경 파일 분류

`_prompts/user_guide_sync.md` 에 나열된 222개 파일 중, 실제 review 대상 changeset 은 파일 1~22 (`.claude/hooks/**`, `codebase/backend/src/modules/{triggers,workflow-versions,workspaces}/**`, `codebase/backend/src/repo-guards/**`, `codebase/backend/src/shared/testing/**`, `codebase/backend/test/*.e2e-spec.ts`, `plan/in-progress/*.md`) 뿐이다. 파일 23~222 는 전부 과거 라운드의 `review/code/**`·`review/consistency/**` 산출물(자기 자신의 리뷰 히스토리)과 `spec/conventions/{review-citations,spec-impl-evidence}.md` — 매트릭스 어떤 trigger 의 대상도 아닌 리뷰 프로세스 메타데이터다. 이하 매칭은 파일 1~22 대상.

## trigger 매칭 결과

- **노드 신규/schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 파일 없음.
- **신규 UI 문자열 (TSX)** — 변경 파일 중 `.tsx` 없음 (전부 backend/test/plan). 매칭 없음.
- **통합/제공자 변경** — 매칭 없음.
- **유저 가이드 신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/**` 변경 없음. 매칭 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — glob 미매칭. `workspace-rbac.e2e-spec.ts` 는 `src/modules/workspaces` 아래 e2e 이고, 변경 내용도 **RBAC 흐름 자체가 아니라** 응답 body 에 `User` 비밀 컬럼이 새는지를 추가로 검증하는 신규 테스트 1건과 spec 절 인용 정정(`§1.3` → `§3(인가)`, 코멘트만) 뿐이다. 인가 판정 로직·미들웨어 변경 없음 — semantic 매칭도 기각.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **실행·디버깅 흐름 변경** — 매칭 없음 (`triggers.service.ts`/`workflow-versions.service.ts` 변경은 아래 참조).
- **신규 warningCode/errorCode** (`nodes/core/error-codes.ts`, `warningRules`) — 매칭 없음. `triggers.service.ts` 가 신설한 `details.subCode: 'TRIGGER_ENDPOINT_PATH_CONFLICT'` 는 전역 HTTP 에러 봉투(`code: 'RESOURCE_CONFLICT'`, 이미 `main.ts`/`http-exception.filter.ts`/`auth.service.ts` 등에 기존 발행되던 값)의 `details` 안 세부 필드이지, `nodes/core/error-codes.ts` 의 `ErrorCode` enum 이나 `warningRules` 와는 별개 코드 공간이다 — `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 대상이 아니다. 확인: `grep -rn TRIGGER_ENDPOINT_PATH_CONFLICT codebase/frontend/src/` 0건 — frontend 가 이 subCode 를 소비하지 않으므로 사용자에게 영문이 그대로 노출될 표면 자체가 없다 (RESOURCE_CONFLICT 는 이미 generic 409 처리 경로를 탄다). 커밋 메시지 확인 결과 이 구현은 **신규 계약이 아니라 기존 spec 문서(`spec/2-navigation/2-trigger-list.md §3`)가 이미 약속했던 형태의 구현 갭을 메운 것**이다 — 문서→구현 방향이라 문서 동반 갱신 대상 자체가 아니다.
- **백엔드 API 변경** (`dto/**` glob) — `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` 에 `WorkspaceMemberDto.joinedAt: string | null` 필드가 신설돼 매칭. 아래 상세 참조.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신설 — DTO 계약 완성이지 신규 사용자 가시 기능이 아니라 유저 가이드 갱신 불요로 판단
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (81-93)
  - 매트릭스 항목: `backend-api-change` — targets: "controller·DTO 의 swagger jsdoc", "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: (1) swagger jsdoc 은 이미 충족 — 필드에 `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + 상세 JSDoc 부착. (2) "사용자 안내 영향" 은 조건부인데, 실측 결과 이 필드는 **이미 프런트엔드 타입에 존재**했다(`codebase/frontend/src/lib/api/workspaces.ts:10` `joinedAt: string | null;` — 과거 커밋부터 선언). 이번 DTO 변경은 실제 런타임 응답(`WorkspacesService.listMembers` 가 이미 `joinedAt: m.joinedAt` 을 실어 보내던 것)을 뒤늦게 OpenAPI 계약에 반영한 **선언 카탐업**이다. 실제 멤버 목록 UI(`codebase/frontend/src/app/(main)/w/[slug]/workspace/settings/page.tsx`, `membersQuery` 사용처)를 확인했으나 `joinedAt` 을 렌더링하는 곳은 0건 — 즉 사용자에게 "합류일" 이 노출되는 UI 표면 자체가 없다. `07-workspace-and-team/workspaces-and-members.mdx` 에도 join-date 관련 서술 없음(정합).
  - 제안: 조치 불요. 이미 scope.md 리뷰어가 이 필드를 "곁가지(방어 작업 밖 파생 발견)" 로 disclose 했고 CHANGELOG·DTO 주석·plan 완료 노트 세 군데에 명시돼 투명하다. 향후 UI 가 이 필드를 실제로 렌더링하게 되면 그 시점에 `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 갱신을 트리거로 재검토할 것.

## 요약

매트릭스 22개 행 중 이 changeset(실질 변경 파일 22개, 나머지 200개는 리뷰 산출물 메타데이터)에 매칭되는 trigger 는 `backend-api-change` 1건뿐이었고, 그 target(swagger jsdoc)은 이미 충족돼 있으며 나머지 target(user-guide 페이지)은 실측상 해당 UI 표면이 없어 불요로 판정했다. 나머지 변경(User 엔티티 컬럼 노출 방어 가드 2종, 그 spec/fixture, e2e 배선, trigger 엔드포인트 충돌 에러 구현, harness 리뷰 게이트 정비, plan/CHANGELOG 문서)은 전부 내부 방어·테스트·프로세스 코드이거나 이미 spec 에 문서화된 계약의 구현 갭 보완이라 유저 가이드 동반 갱신 trigger 자체에 해당하지 않는다. CRITICAL/WARNING 급 누락 없음.

## 위험도

NONE
