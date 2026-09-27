# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

1. SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(161~183행) 및 "자주 누락되는 항목"(196~212행) 을 보조로 Read.
2. 변경 파일 식별: prompt 에 포함된 목록 + `git diff --name-only origin/main...HEAD` 로 대조·보강. 두 목록이 일치함을 확인.
3. 매트릭스 21개 trigger 전부에 대해 glob/semantic 매칭 시도.

## 변경 파일 전수 (origin/main...HEAD)

```
CHANGELOG.md
codebase/backend/src/common/utils/reference-in-scope.{ts,spec.ts}   (신규)
codebase/backend/src/modules/alerts/alerts.service.{ts,spec.ts}
codebase/backend/src/modules/edges/edges.module.ts
codebase/backend/src/modules/edges/edges.service.{ts,spec.ts}
codebase/backend/src/modules/folders/folders.service.{ts,spec.ts}
codebase/backend/src/modules/knowledge-base/knowledge-base.service.{ts,spec.ts}
codebase/backend/src/modules/nodes/nodes.service.{ts,spec.ts}
codebase/backend/src/modules/schedules/schedules.service.{ts,spec.ts}
codebase/backend/src/modules/triggers/triggers.module.ts
codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}
codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts
codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.{ts,spec.ts}
codebase/backend/src/modules/workflows/workflows.module.ts
codebase/backend/src/modules/workflows/workflows.service.{ts,spec.ts}
codebase/backend/test/cross-workspace-references.e2e-spec.ts
plan/**, review/**, spec/1-data-model.md, spec/2-navigation/1-workflow-list.md,
spec/3-workflow-editor/0-canvas.md, spec/data-flow/{11-workflow,12-workspace}.md
```

변경 성격: 쓰기 요청 본문의 참조 id(`workflowId` · `containerId` · `toolOwnerId` · 엣지 끝점 · `folderId`/`parentId` · `llmConfigId` 계열)가 **다른 워크스페이스/워크플로**를 가리키면 저장 전 400 `VALIDATION_ERROR` 로 거부하는 서버측 참조 무결성(IDOR류) 가드. `codebase/backend/src/modules/*/**.service.ts` 계층에 국한된 순수 백엔드 검증 로직 추가이며, 신규 API 엔드포인트·신규 DTO 필드·신규 에러 코드·신규 warning 코드는 없다(기존 `ErrorCode.INVALID_FIELD` 재사용, `error-codes.ts` 자체는 diff 에 없음 — `git show origin/main:...error-codes.ts` 로 사전 존재 확인).

## 매트릭스 21개 trigger 대조 결과

`git diff --name-only origin/main...HEAD | grep -E "controller\.ts|dto/|error-codes|warningRules|auth/|src/nodes/|content/docs|i18n|locale\.ts|expression-engine"` → **0건**. 이 결과로 아래 trigger 전부가 매칭되지 않음을 확인:

| trigger id | 매칭 여부 | 근거 |
| --- | --- | --- |
| new-node | 미매칭 | `codebase/backend/src/nodes/**` 변경 없음 (변경은 `src/modules/nodes/` — 노드 *API 모듈*이지 노드 *타입 정의*가 아님) |
| node-schema-change | 미매칭 | 동일 |
| new-ui-string | 미매칭 | `*.tsx` 변경 없음 |
| new-widget-chrome-string | 미매칭 | `channel-web-chat` 변경 없음 |
| integration-provider-change | 미매칭 | `triggers.web-chat.spec.ts` 는 기존 web-chat 트리거의 fixture(`Workflow` repo mock 추가)일 뿐, 신규 provider/adapter 등록 없음 |
| new-userguide-section-dir | 미매칭 | `content/docs/*/` 변경 없음 |
| backend-api-change | 회색지대(무시 가능) | `*.controller.ts`/`dto/**` 변경 없음. 응답 모양도 기존 `CustomValidationPipe` 의 `VALIDATION_ERROR` 형태 재사용(코드 주석에 명시) — 신규 API 표면·계약 변경 아님 |
| new-bullmq-queue | 미매칭 | `system-status.constants.ts` 변경 없음 |
| new-warning-code | 미매칭 | `warningRules` 변경 없음 |
| new-error-code | 미매칭 | `error-codes.ts` 변경 없음, 기존 `INVALID_FIELD` 재사용 확인(`git show origin/main:codebase/backend/src/nodes/core/error-codes.ts`) |
| new-cross-cutting-enum | 미매칭 | 해당 enum 계열(`WaitingInteractionType` 등) 변경 없음 |
| new-backend-ui-zod-value | 미매칭 | zod `ui.*` 값 변경 없음 |
| new-handler-output-field | 미매칭 | `output.result.*` 관련 변경 없음 |
| auth-session-flow-change | 미매칭 | `codebase/backend/src/modules/auth/**` 변경 0건. 변경은 로그인·세션·토큰·RBAC 이 아니라 **리소스 참조의 워크스페이스/워크플로 소속 검증**(FK 스코프 가드) — PROJECT.md 196~212행 "자주 누락" 항목 중 "인증·권한·세션 흐름 변경" 은 로그인/세션 흐름을 지칭하며 본 변경과 개념적으로 다름 |
| auth-config-type-enum-change | 미매칭 | `AuthConfig.type` enum 변경 없음 |
| expression-language-change | 미매칭 | `codebase/packages/expression-engine/**` 변경 없음 |
| run-debug-flow-change | 미매칭 | 실행 엔진·디버그 로깅 변경 없음 — 저장 **이전** 단계의 입력 검증만 추가 |
| env-runtime-change | 미매칭 | 환경 변수·런타임 변경 없음 |
| spec-major-change | 매칭되나 본 리뷰어 영역 밖 | `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/0-canvas.md` 가 glob 매칭되지만, 이 행의 target(frontmatter `code:`/`status:`/`pending_plans:` 정합)은 spec-impl-evidence/consistency-checker 영역이며 본 reviewer 점검 관점(1~9) 밖 — 참고로만 기재, 판정에 포함하지 않음 |
| userguide-gui-flow-section | 미매칭 | `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음 |
| spec-defect-found | 해당 없음 | — |

## 발견사항

없음.

## 요약

매트릭스 21개 trigger 전량을 변경 파일 목록(`git diff --name-only origin/main...HEAD`, prompt 목록과 일치 확인)과 대조했다. 변경은 `codebase/backend/src/modules/{alerts,edges,folders,knowledge-base,nodes,schedules,triggers,workflow-assistant,workflows}` 서비스 계층에 국한된 순수 백엔드 참조 스코프 검증(다른 워크스페이스/워크플로 id 를 가리키는 요청을 400 으로 거부) 추가이며, 노드 타입 정의(`src/nodes/**`)·프론트엔드 TSX·i18n dict·`backend-labels.ts`·docs MDX·`locale.ts`·`auth/**`·`expression-engine`·신규 error/warning 코드·신규 BullMQ 큐 중 어느 것도 건드리지 않는다. 매칭된 trigger 0건, 누락 0건.

## 위험도

NONE
