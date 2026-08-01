STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 적재했다.

## 변경 파일 컨텍스트
`git diff --stat origin/main...HEAD -- codebase/` 로 재확인 — 이번 changeset 은 **20개 파일 전부 `codebase/backend/src/modules/{audit-logs,model-config,schedules,triggers,workflows}/**` 아래의 backend-only 변경**이다. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 는 이 diff 에 단 한 줄도 없다 (workflow/trigger/schedule/model_config CRUD 액션에 대한 감사 로깅 기능 추가).

## 매트릭스 매칭 결과
21개 행을 전수 대조했다.

- `new-node` / `node-schema-change` (trigger: `codebase/backend/src/nodes/**`) — **미매칭**. 변경 파일은 전부 `src/modules/**` 아래이며 `src/nodes/**` 는 건드리지 않았다.
- `new-ui-string` / `new-widget-chrome-string` (trigger: frontend/channel-web-chat `*.tsx`) — **미매칭**. frontend·channel-web-chat 파일이 diff 에 전무.
- `integration-provider-change` — **미매칭**. 통합 provider 변경이 아니라 CRUD 액션에 대한 감사 로깅 추가다.
- `new-userguide-section-dir` — **미매칭**. `content/docs/` 디렉토리 변경 없음.
- `new-warning-code` / `new-error-code` — **미매칭**. `warningRules`·`error-codes.ts` 변경 없음.
- `auth-session-flow-change` (trigger: `codebase/backend/src/modules/auth/**`) — **미매칭**. `audit-logs`/`model-config`/`schedules`/`triggers`/`workflows` 모듈은 glob 대상인 `modules/auth/**` 밖이다. 인증·세션·권한 로직 자체는 건드리지 않았다(단순 CRUD 컨트롤러에 `@CurrentUser('sub') userId` 파라미터를 추가해 서비스로 넘기는 배선뿐).
- `expression-language-change` — **미매칭**. `packages/expression-engine/**` 변경 없음.
- `run-debug-flow-change` — **미매칭**. 실행 엔진·디버그 로깅 흐름 변경이 아니다.
- `spec-major-change` / `userguide-gui-flow-section` — **미매칭**. `spec/**`, `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` 변경 없음.
- `backend-api-change` (trigger glob: `**/*.controller.ts`, `**/dto/**`, match: semantic) — **glob 매칭됨** (4개 controller + 1개 dto 파일). 아래 상세 분석.

### `backend-api-change` 상세 판정 (glob 매칭 → semantic 재검토)

`git diff origin/main...HEAD` 로 4개 컨트롤러(`model-config.controller.ts`, `schedules.controller.ts`, `triggers.controller.ts`, `workflows.controller.ts`)의 실제 hunk 를 직접 대조했다. 공통 패턴은 다음과 같다.

```ts
async create(
  @WorkspaceId() workspaceId: string,
  @Body() dto: CreateModelConfigDto,
+ @CurrentUser('sub') userId: string,
) {
- return this.modelConfigService.create(workspaceId, dto.kind, dto);
+ return this.modelConfigService.create(workspaceId, dto.kind, dto, userId);
}
```

- `userId` 는 **기존 JWT 세션의 `sub` 클레임**에서 뽑아 서비스로 넘기는 내부 배선일 뿐이다 — 클라이언트가 새로 보내야 하는 request body/query 필드가 아니고(`@Body() dto` 스키마 불변), 응답 shape 도 불변이다. `@CurrentUser` 데코레이터 자체는 이미 다른 컨트롤러에서 널리 쓰이던 기존 패턴이라 신규 API 계약이 아니다.
- swagger jsdoc(`@ApiOperation`/`@ApiBody`/`@ApiOkWrappedResponse` 등)도 그대로다 — 실제로 바뀔 내용이 없으므로 미갱신이 곧 결함은 아니다.
- 유일하게 클라이언트가 관측 가능한 API 표면 변경은 `AuditLogDto.action` 필드의 swagger `description`(파일 2: `audit-log-response.dto.ts`) 이며, **이 changeset 안에서 이미 갱신**돼 새 리소스군(workflow/trigger/schedule/model_config)을 설명에 반영했다.
- `codebase/frontend/src/content/docs/` 전체를 grep 했으나 감사 로그(audit log)를 다루는 user-guide 페이지가 **존재하지 않는다** (`07-workspace-and-team/` 에는 password-and-sessions, security-2fa, system-status, workspaces-and-members 뿐). `GET /api/audit-logs` 는 spec 상 Admin+ 전용 API이고 대응하는 frontend UI/문서 페이지가 아직 없으므로, "관련 user-guide 페이지" 타겟 자체가 이 changeset 시점에 존재하지 않는다 — 갱신 누락이 성립하지 않는다.

**판정: 실질적 API 계약 변경 없음 + 이미 갱신된 swagger jsdoc + 대응 user-guide 페이지 부재 → 동반 갱신 누락 아님.**

## 발견사항

없음 (동반 갱신 매트릭스 CRITICAL/WARNING 트리거 없음).

- **[INFO]** (참고, 본 리뷰어의 핵심 스코프인 docs MDX/i18n dict/backend-labels 밖이지만 문맥상 기록)
  - 변경 파일: `codebase/backend/src/modules/audit-logs/audit-action.const.ts`
  - 상세: 이 파일의 주석은 "workflow/trigger/schedule/model_config CRUD 액션이 spec-sync-auth-gaps §4.1 로 구현됐다(2026-08-01)"고 밝히는데, `spec/5-system/1-auth.md §4.1` 은 여전히 이 액션들을 **"Planned (미구현)"** 표에 두고 있고 `spec/data-flow/1-audit.md §1.1` 도 "여전히 미구현"이라고 서술한다 — 코드와 spec 서술이 어긋난 상태다. 다만 이는 **이미 추적 중인 항목**이다: `plan/in-progress/spec-sync-auth-gaps.md` L18-22 가 "spec SoT 4곳 동기화 — planner 턴 필요 (`developer` 는 `spec/` read-only)"로 명시적으로 남겨뒀고, "impl-prep 09_11_58 이 예견"이라 적어 이미 한 차례 검토를 거친 의도적 분리다. spec/*.md 동기화는 이 reviewer(유저 가이드=docs MDX/i18n/backend-labels)의 매트릭스 trigger 범위 밖이므로 CRITICAL/WARNING 으로 올리지 않고 정보로만 남긴다. 후속 project-planner 턴에서 처리될 항목.

## 요약
매트릭스 21개 행 전수 대조 — glob 매칭 1건(`backend-api-change`, controller/dto 파일)뿐이었고 semantic 재검토 결과 실질 API 계약 변경 없음(내부 `userId` 배선) + swagger jsdoc 이미 diff 내 갱신 + 대응 user-guide 페이지 부재로 갱신 누락이 성립하지 않았다. 나머지 20개 행(신규 노드, UI 문자열, 통합/제공자, 신규 섹션 디렉토리, warning/error code, 인증 흐름, 표현식 언어, 실행/디버깅 흐름 등)은 이번 changeset 이 전적으로 `codebase/backend/src/modules/**` 만 건드린 backend-only 변경이라 애초에 매칭되지 않는다. docs MDX·i18n dict·backend-labels.ts 동반 갱신 누락 CRITICAL/WARNING 없음.

## 위험도
NONE
