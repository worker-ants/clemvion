# 정식 규약 준수 검토 — convention_compliance

- 검토 대상: `spec/4-nodes/3-ai/` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md · _product-overview.md)
- 검토 모드: `--impl-done` (구현 완료 후), diff-base `origin/main`
- 실제 diff 범위 확인: `git -C <worktree> diff origin/main..HEAD` 결과 이번 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` 3라인(§10 "도구 정의 payload 예산 경고" Planned → 구현됨 전환)과, 이를 뒷받침하는 backend 코드(`tool-payload-save-warning.ts` 신설, `tool-payload-budget.ts`/`cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 리팩터, `workflows.controller/service/module.ts`, `backend-labels.ts`)로 국한됨. 대조군: `spec/conventions/cross-node-warning-rules.md`(status partial→implemented, §8 테이블 갱신), `.env.example`, `CHANGELOG.md`.
- 대조한 정식 규약: `spec/conventions/node-output.md`, `conversation-thread.md`, `cross-node-warning-rules.md`, `error-codes.md`, `interaction-type-registry.md`, `spec-impl-evidence.md`. (`spec/conventions/cafe24-api-catalog/**`·`audit-actions.md` 등은 입력 payload 의 "정식 규약 모음" 절에 포함돼 있었으나 이번 target 영역과 관련이 없어 실제 대조에서는 제외하고, 대신 repo 의 실제 `spec/conventions/` 목록에서 AI 노드와 직접 관련된 문서를 직접 Read 해 대조함 — payload 의 규약 dump 가 중간에 truncate 되어 관련 문서가 누락돼 있었음.)

## 발견사항

- **[WARNING] `1-ai-agent.md` frontmatter `code:` 가 신설 구현 모듈을 누락**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (파일 상단) + 본문 §10 "도구 정의 payload 예산 경고 (저장 시점)" 단락
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로")
  - 상세: 이번 PR 이 신설한 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 는 §10 이 새로 서술하는 config-time graph warning(`evaluateAiAgentToolPayloadWarnings`, rule id `ai_agent:tool-payload-budget`)의 **구현 그 자체**다. 그런데 같은 PR 이 `spec/conventions/cross-node-warning-rules.md` 의 frontmatter `code:` 에는 이 파일을 정확히 추가했음에도(`git diff origin/main..HEAD -- spec/conventions/cross-node-warning-rules.md` 확인), 정작 그 기능을 §4.2/§10 에서 더 상세히 서술하는 `1-ai-agent.md` 의 `code:` 목록에는 추가되지 않았다. 기존 `tool-providers/*.ts` glob 은 `ai-agent/tool-providers/` 하위만 매칭하므로 `ai-agent/tool-payload-save-warning.ts`(형제 파일, `tool-providers/` 밖)를 커버하지 않는다 — 직접 확인(`git -C <worktree> ls-files` 경로 대조).
  - 참고: `status: partial` + 다른 `code:` 항목(`tool-payload-budget.ts` 등)이 이미 매치하므로 build-time 가드(`spec-code-paths.test.ts`, ≥1 매치 의무)는 통과한다 — **hard 위반은 아니며 완전성(completeness) 누락**이다. 같은 diff 안에서 자매 문서(`cross-node-warning-rules.md`)는 정확히 갱신했다는 점에서 실수로 보인다.
  - 제안: `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 1줄 추가 (선택: `codebase/backend/src/modules/workflows/workflows.service.ts` 도 §10 서술 대상이므로 함께 고려 가능하나 이 파일은 다른 다수 기능도 구현하는 공용 서비스라 필수는 아님).

- **[INFO] AI 노드 전용 에러 코드가 중앙 에러 카탈로그에 미등재 (기존 상태, 본 diff 무관)**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §10 에러 코드 표의 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` (및 인접 `RETRY_STATE_NOT_FOUND`/`RESUME_INCOMPATIBLE_STATE` 등)
  - 위반 규약: `spec/conventions/error-codes.md` Overview — "카탈로그·분류·트리거 SoT 는 `5-system/3-error-handling.md §1`"
  - 상세: `error-codes.md` 는 명명 규율만 소유하고 카탈로그 SoT 는 `spec/5-system/3-error-handling.md §1` 이라고 명시한다. 그런데 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 등 AI Agent 전용 코드는 `3-error-handling.md` 에 등장하지 않는다(grep 확인, 결과 없음). 코드 자체는 `UPPER_SNAKE_CASE` 표기·`retryable` 필수 필드 등 명명·형식 규약은 100% 준수하므로 CRITICAL/WARNING 은 아니며, 카탈로그 완전성 관점의 INFO다. 이번 PR 의 diff 범위 밖(코드 자체는 선행 PR 에서 이미 도입)이라 본 검토의 신규 위반은 아니다.
  - 제안: 별도 spec-coverage 트랙에서 `5-system/3-error-handling.md §1` 에 노드별 에러 코드 인덱스를 보강할지 검토(본 PR 범위 아님).

- **[INFO] `0-common.md` §10 Rationale(§12.1) 의 "v1: ai_agent 만 자동 주입" 서술이 이후 확장 내용과 표면상 어긋나 보임 (기존 상태, 본 diff 무관)**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 "v1 vs v2 경계" 문단 ("v1: ... `ai_agent` 만 자동 주입 (push 는 3 AI 노드 모두)")
  - 위반 규약: 엄밀히는 규약 위반이 아니라 동일 spec 영역 내 서술 정합성 이슈. 참고 규약: `spec/conventions/conversation-thread.md` §2.3/§7 ("~~`text_classifier`/`information_extractor` 자동 주입(contextScope) 확장~~ → **채택 완료**")
  - 상세: `0-common.md` §10 은 "세 노드 (`ai_agent`/`text_classifier`/`information_extractor`) 모두 ... `contextScope` 기반 자동 주입을 구현" 이라 명시하는데, `1-ai-agent.md` §12.1 Rationale 은 "v1: `ai_agent` 만 자동 주입" 이라는 historical 서술을 그대로 남겨 최신 상태와 표면상 모순돼 보인다. Rationale 섹션은 결정 당시 배경을 보존하는 것이 정상이므로 의도적 historical 기술일 가능성이 높으나, "v1/v2 경계" 라는 현재형 프레이밍이라 독자가 현재 상태로 오인할 여지가 있다.
  - 제안: (a) 문구를 "당초 v1 결정 시점에는 ai_agent 만..." 처럼 명확히 과거형/historical 로 표시하거나, (b) "이후 §2.3 A2 로 확장 완료(0-common §10 참조)" cross-ref 를 덧붙인다. convention-compliance 라기보다 project-planner 의 일반 정합성 개선 항목으로 처리해도 무방.

## 요약

이번 검토 범위(diff-base `origin/main`)의 실질 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` §10 "도구 정의 payload 예산 경고" 단락을 Planned→구현됨으로 전환한 3라인과, 이를 뒷받침하는 backend 코드(신규 `tool-payload-save-warning.ts`, `WorkflowsService`/`WorkflowsController`/`WorkflowsModule` 배선, i18n `GRAPH_WARNING_KO` 등록)로 매우 좁다. 대조 결과 이 변경은 `node-output.md`(에러 코드 UPPER_SNAKE_CASE·`details.retryable` 필수 등)·`cross-node-warning-rules.md`(rule id 명명 `<node>:<kebab-rule>`, severity 정책, backend-only async 예외, i18n 등록 의무)와 정확히 정합하며, 자매 문서 `cross-node-warning-rules.md` 의 frontmatter(`status: partial→implemented`, `code:`, `pending_plans:` 정리)도 `spec-impl-evidence.md` 라이프사이클 규칙을 모범적으로 따른다. 유일한 흠은 같은 구현 모듈이 `cross-node-warning-rules.md` 의 `code:` 에는 등재됐으나 그 기능을 더 상세히 서술하는 `1-ai-agent.md` 의 `code:` 에는 빠진 완전성 누락(WARNING)이며, 나머지 두 건은 diff 밖의 기존 상태에 대한 참고성 INFO다. CRITICAL 급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
