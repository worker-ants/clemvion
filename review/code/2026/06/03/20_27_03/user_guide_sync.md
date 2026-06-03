# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 표현식 언어 변경 — `$thread` 변수 추가, 사용자 가이드 docs 미갱신

- 변경 파일: `codebase/frontend/src/components/editor/expression/expression-constants.ts`
- 매트릭스 항목: `expression-language-change` — "표현식 언어 변경" → targets: `codebase/frontend/src/content/docs/04-expression-language/{basics,variables-and-context,cheatsheet}.mdx + .en.mdx`
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/04-expression-language/variables-and-context.mdx` (및 `.en.mdx`)
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/04-expression-language/cheatsheet.mdx` (및 `.en.mdx`)
- 상세: `ROOT_VARIABLES` 에 `$thread` (Conversation thread) 가 신규 추가됐고, `spec/5-system/5-expression-language.md` 도 "`$thread` 가 ROOT_VARIABLES 에 포함된다"로 마커가 flip 됐다. 그러나 사용자 대면 가이드(`04-expression-language/variables-and-context.mdx`, `cheatsheet.mdx`)에 `$thread` 변수 설명이 동반 추가되지 않았다. 사용자는 가이드에서 `$thread` 의 존재·사용법을 알 수 없다.
- 제안: `variables-and-context.mdx` 및 `.en.mdx` 의 루트 변수 목록에 `$thread` 항목(detail: "Conversation thread", expandable) 추가. `cheatsheet.mdx` 및 `.en.mdx` 에도 `$thread` 예시 행 추가.

---

### [INFO] 워크스페이스 설정 API/UI (`interactionAllowedOrigins`) — user-guide 동반 갱신 상태 불명

- 변경 파일: `plan/complete/spec-draft-workspace-settings-api.md`
- 매트릭스 항목: `backend-api-change` (semantic) — "백엔드 API 추가·변경" → targets: "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 상세: plan 문서에 "user-guide 동반(web-chat.mdx '허용 도메인' → 실제 UI 경로 — `user-guide-writer` 위임)" 항목이 `[x]` 체크됐으나, 실제 `codebase/frontend/src/content/docs/` 하위 MDX 파일 변경이 이 changeset 에 포함되어 있지 않다. `user-guide-writer` 에 위임되어 별도 커밋/PR 로 처리됐을 가능성이 있으나, 현 changeset 내에서 확인 불가.
- 제안: `codebase/frontend/src/content/docs/` 에서 web-chat 또는 workspace-settings 관련 MDX 변경이 동일 PR 에 포함됐는지 확인. 별도 PR 로 분리됐다면 해당 PR 링크를 plan 에 명시할 것.

---

### [INFO] `$thread` 표현식 관련 spec 갱신 — user-guide 연동 확인

- 변경 파일: `spec/5-system/5-expression-language.md`
- 매트릭스 항목: `spec-major-change` (glob `spec/5-*/**`) — targets: frontmatter/code/status 정합. 해당 spec targets 는 직접 user-guide MDX 를 요구하지 않으나, `expression-language-change` semantic row 와 교차.
- 상세: spec 에서 `$thread` 에 대해 "자동완성 Planned" → "포함된다"로 상태가 flip 됐다. 이는 `expression-constants.ts` 변경과 함께 user-guide 갱신 의무를 발생시키는 신호다(위 WARNING 항목과 동일).
- 제안: 위 WARNING 항목의 제안과 동일 — docs 갱신 포함.

---

### [INFO] `spec/4-nodes/0-overview.md` §1.4.1 summaryTemplate filter DSL 신설 — user-guide 잠재 동반

- 변경 파일: `spec/4-nodes/0-overview.md`
- 매트릭스 항목: `spec-major-change` (glob `spec/4-*/**`). 그 자체로 user-guide MDX 갱신을 강제하지 않으나, summaryTemplate DSL 의 `fallback:` 필터가 신규 documented surface 로 추가됨.
- 상세: `fallback:<path>` 필터가 spec §1.4.1 에 정식 기술됐다. 이 DSL 은 사용자 가이드 워크플로우 노드 설정 설명 등에서 참조될 수 있으나, 현재 `04-expression-language/` 나 `02-nodes/` MDX 에 해당 DSL 문법 설명이 없다. 현 가이드 수준에서 end-user 영향은 낮다.
- 제안: summaryTemplate DSL 이 사용자-facing 가이드에서 참조되는 경우 `02-nodes/` 관련 MDX 보강 고려.

---

### 비해당 항목 (trigger 매칭 없음 또는 user-guide 무관 판정)

아래 변경들은 매트릭스 trigger 와 매칭되지 않거나, targets 가 spec frontmatter/plan 파일에 한정되어 user-guide 동반 갱신 의무 없음으로 판정:

- `plan/complete/spec-draft-eia-strip-llmcalls.md` — spec 변경 draft (plan 문서). llmCalls strip 정책은 외부 수신자 처리 내부 로직으로 user-guide 직접 impact 없음.
- `plan/complete/spec-draft-node-execution-cancelled.md` — `NodeExecutionStatus.CANCELLED` spec 변경 draft. 실행·디버깅 흐름 변경(`run-debug-flow-change`) 의 semantic 대상이 될 수 있으나, 이 changeset 에는 backend 실행 엔진 코드 변경 파일 자체가 없다 (spec draft + plan 파일만). backend 엔진 코드가 별 PR 로 구현될 때 `05-run-and-debug/` MDX 갱신 의무 발생.
- `plan/complete/spec-draft-workspace-settings-api.md` — INFO 항목에서 별도 처리.
- `plan/complete/spec-fix-impl-marker-flips.md` 및 `spec-sync-*-gaps.md` 파일들 — plan 완료 이동 문서. user-guide 갱신 trigger 없음.
- `plan/in-progress/*.md` (carousel/data-common/embedding-pipeline/expression-language/foreach/integration-common/node-common/template gaps) — in-progress plan 재분류. user-guide 갱신 trigger 없음.
- `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/11-error-empty-states.md`, `spec/2-navigation/14-execution-history.md`, `spec/2-navigation/7-statistics.md` — spec 미구현 marker flip. auth-flow spec 변경은 `auth-session-flow-change` semantic 대상이지만, 이 변경은 spec 서술의 현실 반영(미구현 → 구현됨 표기)이며 인증 흐름 자체의 신규 변경이 아니다. `07-workspace-and-team/` user-guide 에 영향 줄 신규 행동 변경 없음으로 INFO 이하.
- `spec/4-nodes/2-flow/1-workflow.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md` — spec marker flip. 노드 schema 변경(`node-schema-change`) glob 은 `codebase/backend/src/nodes/**` 가 트리거인데, 이 changeset 에 backend nodes 코드 파일 변경이 없다. spec 문서 marker flip 만으로 MDX user-guide 갱신 의무 발생 안 함.
- `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/5-system/12-webhook.md`, `spec/5-system/15-chat-channel.md` — spec 현실 반영 정정 (비활성 트리거 202 응답 구현됨). backend 코드 변경 없음, user-guide trigger 해당 없음.
- `spec/5-system/8-embedding-pipeline.md` — CSV 청킹 미구현 marker flip. backend embedding 코드 변경 없음, user-guide trigger 해당 없음.
- `spec/conventions/user-guide-evidence.md` — convention spec 정합 갱신. user-guide MDX 변경 아님.

---

## 요약

매트릭스 19개 row 중 이 changeset 에서 user-guide 동반 갱신 관련 trigger 로 매칭된 행은 2개(`expression-language-change`, `backend-api-change`)이며, `expression-constants.ts` 의 `$thread` 추가에 대해 `04-expression-language/` MDX 갱신이 누락(WARNING 1건)되었다. `workspace-settings` API/UI user-guide 동반은 plan 에서 `[x]` 체크됐으나 실제 MDX 변경이 changeset 에 없어 INFO 1건으로 처리했다. 나머지 37개 파일(plan 문서·spec marker flip)은 user-guide 직접 동반 갱신 의무 없음으로 판정.

## 위험도

LOW

STATUS=success ISSUES=1
