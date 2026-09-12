# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 SSOT 로 사용. 변경 파일 17개 (`git diff --name-only origin/main...HEAD`):
CHANGELOG.md · `auth.controller.ts` · `triggers.controller.spec.ts` · `triggers.controller.ts` · repo-guards 3개(`param-uuid-pipe*`) · `02-nodes/triggers{,.en}.mdx` · `06-integrations-and-config/mcp-servers{,.en}.mdx` · `06-integrations-and-config/telegram{,.en}.mdx` · `lib/i18n/backend-labels.ts` + 그 test · plan 2개.

## 매칭된 trigger

1. **`backend-api-change`** (`codebase/backend/src/**/*.controller.ts` semantic) — `triggers.controller.ts`(`rotateBotToken` 에 `ParseUUIDPipe` + `@ApiParam({format:'uuid'})` 추가, `@ApiBadRequestResponse` 문면에 `VALIDATION_ERROR` 추가) · `auth.controller.ts`(`switchWorkspace` 의 `@ApiParam` 에 `format:'uuid'` 추가, 순수 swagger 축). Target: "controller·DTO 의 swagger jsdoc" + "관련 user-guide 페이지".
   - **충족 확인**: 같은 변경 set 안에 `02-nodes/triggers.mdx`+`.en.mdx`, `06-integrations-and-config/telegram.mdx`+`.en.mdx` 가 모두 포함되어 있고, 실제로 `rotate-bot-token` 의 신규 400 `VALIDATION_ERROR`(`:id` UUID 미형식) + 404 `RESOURCE_NOT_FOUND` 를 ko/en 양쪽에 정확히 반영했다(그레핑 결과 4개 MDX 모두 갱신 확인, `TRIGGER_NOT_FOUND` 오기 잔존 0건). `CHANGELOG.md` 에도 behavior-change 항목이 상세히 등재됨. → 이 trigger 는 **동반 갱신 완료**.

2. **`new-warning-code`/`new-error-code`** — `ErrorCode` enum(`error-codes.ts`)·`warningRules` 는 이 diff 에서 변경되지 않음 → 매칭 없음.

3. **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**` semantic) — `auth.controller.ts` 변경은 `@ApiParam` 에 `format:'uuid'` 한 줄 추가뿐으로 **실제 인증·권한·세션 흐름 변경이 아니다**(OpenAPI 문서 축 보강, 런타임 무변). `07-workspace-and-team/` 갱신·e2e 보강 대상이 아니라고 판단 — 그레이존이지만 확정적으로 "해당 없음"에 가깝다.

4. **backend-labels.ts / backend-labels.test.ts 변경** — `TRIGGER_NOT_FOUND` 의 소속 오귀속(chat-channel API 코드가 아니라 hooks webhook inbound 코드)을 정정하는 **주석 전용** 변경. 신규 코드·신규 매핑 추가가 아니라 기존 매핑 위치를 옮기지 않고 주석만 고친 것이라 매트릭스의 "신규 warningCode/errorCode 발행" trigger 에는 해당하지 않는다. i18n parity 도 무관(둘 다 하나의 파일 안 주석).

5. **`new-node`/`node-schema-change`/`integration-provider-change`/`new-userguide-section-dir`/`expression-language-change`/`run-debug-flow-change`** — 해당 glob·semantic 경로(`nodes/**`, `expression-engine/**`, 신규 `content/docs/<NN>-*/` 등) 변경 없음 → 매칭 없음.

## 검증 — ERROR_KO 갭이 사용자에게 영문 노출을 만드는지 실측

plan(`spec-draft-nullable-notation-followups.md`)이 "`ERROR_KO`에 `RESOURCE_NOT_FOUND`/`VALIDATION_ERROR` 등 일반 API 코드가 없다"는 전제를 스스로 반증했다고 적어 두어, 직접 재확인했다:
- `grep -rn "translateBackendError" codebase/frontend/src` → 정의(1) + 자기 참조 주석(1)뿐, **프로덕션 호출부 0건**.
- `chat-channel-card.tsx` `rotateMutation.onError`(라인 393-394) → 에러 객체를 완전히 버리고 고정 문자열 `t("triggers.chatChannel.rotateBotTokenFailed")` 만 표시. `saveMutation.onError`(375-381)도 동일 패턴(err 로 분기만 하고 코드 노출 없음).
- 결론: `ERROR_KO`에 `RESOURCE_NOT_FOUND`/`VALIDATION_ERROR` 매핑이 없어도 **현재는 그 경로로 영문이 화면에 뜨지 않는다** — plan 의 실측이 맞다. 이 diff 가 새로 만든 CRITICAL 은 없다.
- MDX 쪽도 "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요" → "API 를 직접 호출할 때 보이는 값" 으로 문구를 좁혀 실제 구현과 맞췄다(과다 서술 축소, 올바른 방향).

## 발견사항

- **[INFO]** `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 `rotate-bot-token` 의 신규 400 `VALIDATION_ERROR` 행이 아직 없음
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.controller.ts` (신규 400 분기 도입)
  - 매트릭스 항목: 이 파일은 `spec/**` 이라 본 reviewer(유저 가이드=frontend content/docs·dict·backend-labels) SSOT 범위 밖 — 참고용 INFO
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 "processor 항목" 으로 등재되어 있고, developer 가 자기-반증형 소정정 **조건 1**(그 문장을 자신이 쓰지 않았음)이 깨져 planner 턴으로 넘긴다고 명시함. 신규 회귀가 아니라 이미 추적 중인 정당한 backlog.
  - 제안: 조치 불요 (이미 plan 에 planner 항목으로 등재됨). 다음 project-planner 턴에서 처리 확인.

- **[INFO]** 유저 가이드에 실재하지 않는 에러 코드 5종(`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`·`INTEGRATION_ERROR`·`NODE_EXECUTION_FAILED`·`MAKESHOP_API_ERROR`)이 남아있음 — 이번 diff 의 파일 목록(models.mdx, run-results.mdx, error-handling.mdx, integrations.mdx 등)에 **포함되지 않은 기존 문서**이며, plan 에 developer 가 이미 항목화(미해결, 후속 조사 필요로 명시)했다. 이번 PR 의 신규 회귀 아님 — 정보 제공 목적으로만 기재.

- **[INFO]** `mcp-servers.mdx`/`.en.mdx` 의 `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정은 ko/en 양쪽 동시 수정되어 parity 유지됨 — drive-by 정정이나 문제 없음.

## 요약
매트릭스 20개 행 중 이번 diff 에 실질적으로 매칭되는 trigger 는 `backend-api-change`(컨트롤러 swagger 변경) 1개뿐이며, 그 동반 갱신 대상(swagger jsdoc + user-guide MDX: `02-nodes/triggers{,.en}.mdx`, `06-integrations-and-config/telegram{,.en}.mdx`, `CHANGELOG.md`)이 모두 같은 변경 set 안에 포함되어 완전히 충족됨을 확인했다. `backend-labels.ts`/`backend-labels.test.ts` 변경은 신규 코드 발행이 아니라 기존 `TRIGGER_NOT_FOUND` 오귀속 주석 정정이라 parity 이슈 없음(그레핑으로 잔존 오기 0건 확인). `auth.controller.ts` 는 순수 swagger 문서 축 보강이라 `auth-session-flow-change` trigger 의 실질 매칭 대상이 아니다. `ERROR_KO`의 일반 API 코드 미매핑 우려는 `translateBackendError` 프로덕션 호출부 0건 + UI 가 에러 코드를 폐기하고 고정 문구만 표시함을 실측으로 확인해 현재 사용자 영향이 없음을 검증했다. 나머지 발견사항은 모두 이 PR 이전부터 존재하며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정확한 근거와 함께 항목화되어 있어 신규 결함이 아니다. 누락 0건.

## 위험도
NONE
