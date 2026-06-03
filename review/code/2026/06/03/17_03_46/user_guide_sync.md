# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] 실행·디버깅 흐름 변경 — `05-run-and-debug/run-results.mdx` + `.en.mdx` 갱신 누락

- **변경 파일**: 아래 파일들이 실행 디버깅 타임라인의 표시 방식을 변경함
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - `codebase/backend/src/modules/websocket/websocket.service.ts`
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `codebase/frontend/src/components/editor/run-results/result-timeline.tsx`
  - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`
  - `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx`
  - `codebase/frontend/src/components/editor/run-results/result-detail.tsx`
  - `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`

- **매트릭스 항목**: `run-debug-flow-change` (semantic trigger) — "실행·디버깅 흐름 변경"
  - targets: `codebase/frontend/src/content/docs/05-run-and-debug/`

- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx`

- **상세**: 이번 변경으로 타임라인의 모든 노드 행과 AI 멀티턴 대화 요소(assistant turn, tool call, user message)에 절대 발생 시각(ISO8601)과 소요시간이 새로 표시된다. `run-results.mdx` §타임라인 읽기의 `FieldTable`은 현재 "실행 시간(Duration)" 열만 기재하고 있으며, 신규 "발생 시각" 열 항목이 없다. 사용자 가이드가 stale 상태가 된다.

  `spec/conventions/conversation-thread.md §9.12`가 이번 커밋으로 신설됐고 (`"요소별 발생 시각·소요시간 표시 (강제)"`) 세 surface(SummaryView, ResultTimeline, 실행 내역 페이지)에 동시 적용 의무가 명시됐지만, 그에 대응하는 user-guide docs 갱신은 없다.

- **제안**:
  - `run-results.mdx` §타임라인 읽기 FieldTable에 발생 시각(절대) 항목 추가: `{ name: "발생 시각", type: "DateTime", description: "노드(또는 AI 대화 요소)가 시작된 절대 시각이에요. 실행 내역(영속)과 라이브 실행 중 동일한 값을 표시해요." }`
  - AI 대화 요소별 발생 시각 노출도 §멀티턴 AI 에이전트 소절에 1~2문장 추가
  - `run-results.en.mdx`에 동일 내용 영문으로 동반 갱신

---

### [INFO] `ai-agent.handler.ts` 내부 타이밍 필드 추가 — 노드 schema 변경 여부 회색지대

- **변경 파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `ToolCallTrace` 인터페이스에 `startedAt?: string`, `finishedAt?: string` 추가
  - LLM 호출 내부 집계 배열에도 동일 필드 추가

- **매트릭스 항목**: `node-schema-change` (glob: `codebase/backend/src/nodes/**`) 잠재 매칭

- **판단**: 이 변경은 사용자에게 직접 노출되는 노드 입력/출력 필드(config schema)가 아니라 내부 debug trace 레코드(`ToolCallTrace`)에 타이밍 메타데이터를 추가한 것이다. 노드의 FieldTable(`02-nodes/<cat>.mdx`)이나 i18n dict 갱신 대상이 되는 사용자 가시 필드가 아니므로 `node-schema-change` trigger 의 정식 갱신 의무는 발생하지 않는다.

  단, `ToolCallStartedPayload` / `ToolCallCompletedPayload` (WS wire payload)에 `startedAt`/`finishedAt`이 추가돼 WebSocket 프로토콜 spec이 갱신됐고(`spec/5-system/6-websocket-protocol.md`도 이번 커밋에 포함), 해당 spec 갱신은 동반됐음을 확인했다.

---

## 추가 확인 사항 (이상 없음)

- **i18n parity**: 신규 TSX 변경에서 추가된 한국어 문자열은 코드 주석뿐이며, 사용자에게 노출되는 새 한국어 UI 리터럴이 dict에 미등록된 경우는 확인되지 않았다. `{n}개 도구 호출` 문자열은 이번 diff에서 새로 추가된 것이 아니라 기존 코드에 이미 존재하는 문자열이다 (diff 확인).
- **신규 warningCode/errorCode**: 이번 변경 set에 `warningRules` 또는 `error-codes.ts` 변경 없음 — `backend-labels.ts` ko 매핑 갱신 의무 없음.
- **신규 섹션 디렉토리**: `docs/<NN>-<name>/` 신규 디렉토리 생성 없음 — `locale.ts` 등록 의무 없음.
- **통합/제공자 변경**: 이번 변경에 신규 provider 추가 없음 — 통합 docs 갱신 의무 없음.
- **spec 갱신**: `spec/5-system/6-websocket-protocol.md`, `spec/conventions/conversation-thread.md` 양쪽 동반 갱신됨 — `spec-major-change` trigger 충족.

---

## 요약

매트릭스 전체 19개 trigger 중 이번 변경 set에 매칭되는 trigger는 `run-debug-flow-change`(semantic, 실행·디버깅 흐름 변경) 1개, 잠재 회색지대 `node-schema-change` 1개다. `run-debug-flow-change`에 대해 `05-run-and-debug/run-results.mdx` + `.en.mdx`의 타임라인 FieldTable 갱신이 누락됐다(WARNING 1건). i18n parity, error/warning code ko 매핑, 신규 섹션 locale 등록은 모두 이상 없음.

## 위험도

LOW
