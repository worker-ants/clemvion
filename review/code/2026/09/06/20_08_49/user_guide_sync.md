# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 개요

`.claude/config/doc-sync-matrix.json` 의 `rows[]` (총 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 적재했다. 변경 file 목록은 `git diff --name-only origin/main...HEAD` 로 실측(프롬프트에 나열된 358개 항목 중 실제 `codebase/**` 변경은 23개뿐 — 나머지는 과거 세션들의 `review/**`·`plan/**` 산출물이라 매트릭스 판단 대상이 아니다):

```
codebase/backend/src/common/db/pg-error.spec.ts (신규)
codebase/backend/src/common/db/pg-error.ts
codebase/backend/src/modules/triggers/triggers.controller.ts
codebase/backend/src/modules/triggers/triggers.service.spec.ts
codebase/backend/src/modules/triggers/triggers.service.ts
codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts
codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts
codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts
codebase/backend/src/modules/workspaces/workspaces.service.spec.ts
codebase/backend/src/repo-guards/__tests__/... (가드·fixture 6개)
codebase/backend/src/shared/testing/pg-error-fixtures.ts (신규)
codebase/backend/src/shared/testing/user-secret-absence.ts (신규) / .spec.ts (신규)
codebase/backend/test/audit-logs.e2e-spec.ts
codebase/backend/test/workflow-crud.e2e-spec.ts
codebase/backend/test/workspace-rbac.e2e-spec.ts
codebase/frontend/src/lib/api/workflows.ts (JSDoc 주석만 추가)
```

## 매칭 결과

- `codebase/backend/src/nodes/**` (새 노드/schema 변경) — 매칭 파일 없음
- `codebase/frontend/src/**/*.tsx` (신규 UI 문자열) — 매칭 파일 없음. 유일한 frontend 변경(`lib/api/workflows.ts`)은 `.ts`(non-TSX)이고 diff 전문 확인 결과 JSDoc 주석 추가뿐, 신규 한국어 UI 리터럴 없음
- `codebase/frontend/src/content/docs/*/` (신규 섹션 디렉토리) — 매칭 없음
- `codebase/backend/src/modules/auth/**` (인증·세션 흐름) — 매칭 없음 (`workspace-rbac.e2e-spec.ts`는 RBAC e2e 이지 auth 모듈 변경 아님)
- `codebase/packages/expression-engine/**` (표현식 언어) — 매칭 없음
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (BullMQ 큐) — 매칭 없음
- `codebase/backend/src/nodes/core/error-codes.ts` (신규 errorCode) — 매칭 없음
- **`codebase/backend/src/**/*.controller.ts` + `dto/**` (백엔드 API 추가·변경, semantic)** — 2건 매칭:
  1. `triggers.controller.ts` + `triggers.service.ts` — `POST/PATCH` 트리거에 `409 RESOURCE_CONFLICT` (`details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`) 응답 추가
  2. `workspace-response.dto.ts` — `WorkspaceMemberDto.joinedAt` 필드 신설

두 매칭 모두 실측 결과 아래와 같이 **동반 갱신 갭이 확인되지 않았다** — 그레이존 INFO 로 기록한다.

## 발견사항

- **[INFO]** 트리거 409 conflict 추가 — swagger jsdoc 은 동일 diff 안에서 이미 충족, user-guide 본문 갱신은 불필요로 판정
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiConflictResponse` 추가, L98-101/L127-130), `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, L1591-1626 부근)
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 확인: (a)는 이 diff 안에서 `@ApiConflictResponse` 로 이미 충족. (b)는 `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx` 와 `codebase/frontend/src/components/triggers/cards/webhook-config-card.tsx` 의 `onError` 핸들러를 직접 열어 확인한 결과, 트리거 생성/수정 실패 시 서버가 보낸 구체 메시지·`details.code` 를 읽지 않고 항상 `t("triggers.webhookCreateFailed")`/`t("triggers.detail.saveFailed")` 같은 **기존** 범용 토스트만 띄운다 — 이 PR 로 사용자가 보는 문구는 하나도 안 바뀐다. 또한 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 의 "응답 코드" 표(L142-150)는 외부에서 웹훅을 **호출**하는 엔드포인트(`POST /api/hooks/{endpoint_path}`)의 에러 코드 표이지, 트리거 생성/수정(관리) API 의 에러 코드 표가 아니라 애초에 이 표의 대상이 아니다. 서비스 파일 주석에 따르면 이 동작은 `spec/2-trigger-list.md §3` 이 **이미 문서화**해 둔 계약을 구현이 뒤늦게 따라간 것(문서가 구현보다 넓었던 사례의 정정)이라, 신규 사용자 가시 기능이 아니다.
  - 결론: 동반 갱신 액션 불요. 다만 "엔드포인트 경로를 직접 편집하면 충돌할 수 있다"는 사실 자체는 `triggers.mdx` L95 부근("endpoint_path 는 트리거 생성 시 UUID로 자동 발급") 이 편집 가능성을 아예 언급하지 않는 기존 갭과 맞물려 있는데, 이 갭은 **이번 diff 이전부터 존재**(webhook-config-card.tsx 의 편집 UI·`endpointPathChangeWarning` dict 키는 이번 changeset 밖)하므로 이번 리뷰의 회귀로 잡지 않는다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 신설 — DTO 선언을 실제 런타임 값에 맞춘 계약 정정, 신규 UI 노출 없음
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (L81-93)
  - 매트릭스 항목: `backend-api-change` (동일 행)
  - 확인: swagger jsdoc 은 `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + 필드 JSDoc 으로 이미 충족. `grep -rn "joinedAt" codebase/frontend/src` 결과 `codebase/frontend/src/lib/api/workspaces.ts` 의 타입 선언 1곳 외 어떤 `.tsx` 컴포넌트도 이 필드를 렌더링하지 않는다 — 화면에 "가입일" 같은 신규 텍스트가 생기지 않았으므로 `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 도 대응해서 바꿀 서술이 없다(이 페이지는 필드 단위 레퍼런스 테이블이 아니라 초대/역할/이양 흐름을 설명하는 narrative 구성).
  - 결론: 동반 갱신 액션 불요.

## 요약

매트릭스 21행 중 glob 트리거(새 노드/신규 UI 문자열/신규 섹션 디렉토리/auth/expression-engine/BullMQ 큐/error-codes.ts) 어느 것도 이번 23개 codebase 변경 파일과 매칭되지 않았고, semantic 트리거인 `backend-api-change` 1행만 2개 파일 조합(트리거 409 conflict, `WorkspaceMemberDto.joinedAt`)에 매칭됐다. 두 매칭 모두 frontend 소비 지점(에러 핸들러·타입 사용처)을 직접 열어 실측한 결과 신규 사용자 가시 문구·화면 변경이 없어 문서·i18n dict·backend-labels 동반 갱신 갭은 확인되지 않았다(INFO 2건, 조치 불요). warningCode/errorCode(`ErrorCode` enum) 발행도 없었고(`RESOURCE_CONFLICT`는 기존 top-level 코드, `TRIGGER_ENDPOINT_PATH_CONFLICT`는 별도 네임스페이스인 HTTP `details.code`), i18n parity 위반도 없다(이번 changeset 에 신규 TSX 리터럴 없음).

## 위험도

LOW
