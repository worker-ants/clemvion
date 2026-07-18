STATUS=success ISSUES=0

### 발견사항

없음 — 해당 없음.

검토 대상 변경 set (`git diff origin/main...HEAD --name-only` 로 확인, HEAD 는 로컬 커밋 2건 `2765ed767`/`ef1227b76` 포함):

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`
- `plan/in-progress/interaction-type-guard-comment-false-negative.md`
- `review/code/2026/07/18/11_39_42/**` (이전 리뷰 산출물)

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 21개 trigger 를 전수 대조했다.

- **glob 매칭 trigger** (`new-node`, `node-schema-change` — `codebase/backend/src/nodes/**`; `new-ui-string` — `codebase/frontend/src/**/*.tsx`; `new-widget-chrome-string` — `channel-web-chat/**/*.tsx`; `new-userguide-section-dir` — `content/docs/*/`; `new-error-code` — `error-codes.ts`; `new-bullmq-queue`; `spec-major-change` — `spec/{2,3,4,5}-*/**`, `spec/conventions/**`): 변경 파일 중 어느 것도 이 glob 에 매치되지 않음. 두 변경 파일은 `codebase/frontend/src/lib/**/*.ts` (테스트 파일 + 순수 소스 상수 모듈)로, `.tsx` 도 `backend/src/nodes/**` 도 `content/docs/**` 도 `spec/**` 도 아님.
- **semantic trigger 중 유일하게 근접한 후보 — `new-cross-cutting-enum`** ("신규 cross-cutting enum 값 추가", targets: (a) `spec/conventions/interaction-type-registry.md` 매트릭스에 행 추가 (b) 매트릭스가 가리키는 모든 코드 분기 위치 동시 갱신 (c) AST 가드(`interaction-type-exhaustiveness.test.ts`) 통과, PROJECT.md 표 134행). `interaction-type-registry.ts` 의 diff 를 직접 확인 — `INTERACTION_TYPE_VALUES` (`form`/`buttons`/`ai_conversation`/`ai_form_render`, 4값) 와 `CONVERSATION_SOURCE_VALUES` (7값) 는 **글자 하나 안 바뀌었다**. 변경은 JSDoc 코멘트의 "grep 가드" → "AST 가드" 용어 정정뿐(PR #972/#977 후속 정합). `interaction-type-exhaustiveness.test.ts` 의 diff 도 신규 enum 값 추가가 아니라 그 **가드 자신의 파싱 메커니즘 강화**(regex 잔재 제거 이후 남은 `ScriptKind` 단일 chokepoint화 `parseGuardSource` 도입 + `.tsx`/`.ts` cast 역방향 self-test 4건 신설, PR #972 review WARNING #1·#2 대응). 즉 이 trigger 가 요구하는 "새 enum 값이 생겼다" 는 전제 자체가 성립하지 않는다 — 오히려 이 changeset 은 trigger #11 의 **guard_test 자체를 하드닝**하는 메타 작업. Row 는 매치되지 않음.
- 나머지 semantic trigger(`integration-provider-change`, `backend-api-change`, `new-warning-code`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `userguide-gui-flow-section`, `spec-defect-found`): 대상 파일이 backend nodes/controller/DTO/auth/expression-engine/zod schema/BullMQ 어디에도 속하지 않아 전부 무관.

두 파일 안의 문자열도 확인 — `.test.ts` 내부의 fixture 문자열(`"ghost_backtick"`, `"union_member_a"`, `"kept_literal"`, `"cast_kept_literal"` 등)은 TS AST 파서 self-test 용 인조 토큰이며 `.tsx` 렌더 문자열도 사용자 노출 UI 텍스트도 아니라 i18n dict parity(trigger #3) 대상이 아니다.

### 요약

이번 변경은 `interaction-type-exhaustiveness.test.ts` 가드의 파싱 메커니즘을 강화(정본 TS parser 의 `ScriptKind` 단일 chokepoint화 + self-test 보강)하고 `interaction-type-registry.ts` 의 코멘트 용어를 정정한 것으로, 실제 `WaitingInteractionType`/`ConversationTurnSource` 값 목록은 변경되지 않았다. `doc-sync-matrix.json` 의 21개 trigger 를 전수 대조한 결과 glob 매칭 0건, semantic 매칭 후보였던 "신규 cross-cutting enum 값 추가"(row `new-cross-cutting-enum`)도 전제(신규 값 추가) 미충족으로 매치되지 않아 유저 가이드·i18n dict·backend-labels·docs MDX 동반 갱신 대상이 아니다. 누락 0건.

### 위험도

NONE
