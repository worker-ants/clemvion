# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-prep)

## 발견사항

- **[WARNING]** 노드 서브탭이 참조하는 internal 필드(`_llmCalls`/`_turnDebugHistory`)가 `node-output.md` Principle 0 의 top-level 예외 허용 목록에 미등재
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.4.2 "LLM Usage / Response / Request 탭" (노드 레벨 항목) — "백엔드 핸들러가 per-call trace(`_llmCalls` 또는 `_turnDebugHistory`)를 persist 하지 않은 실행 …"
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 — "`NodeHandlerOutput`의 5필드는 불변" 및 "internal top-level 필드 허용 예외" 목록(`_resumeState`, `_resumeCheckpoint`, `_retryState` 3개만 명시)
  - 상세: 실제 코드(`codebase/frontend/src/components/editor/run-results/llm-call-trace.ts`)를 확인한 결과 `_llmCalls`/`_turnDebugHistory` 는 실존하는 필드이며, 그중 `_turnDebugHistory` 는 "legacy AI Agent flat shape" 로 **output 바깥 top-level** 에도 존재한다는 주석이 있다(`// Legacy flat AI Agent shape has _turnDebugHistory at top level`). 그러나 `node-output.md` Principle 0 는 top-level 허용 예외로 이 두 필드를 언급하지 않는다. target 문서 자체는 실제 코드 동작을 정확히 서술하고 있어 target 의 잘못이라기보다, **`node-output.md` 가 실제 구현된 internal 필드 예외를 놓치고 있어 두 문서 사이에 갭이 있다** — 이번 항목이 impl-prep 단계에서 향후 구현자가 "이런 top-level 필드가 규약에 없는데 써도 되나" 혼란을 줄 수 있다.
  - 제안: (a) target 문서 수정은 불필요(정확한 서술) — 대신 `spec/conventions/node-output.md` Principle 0 의 예외 목록에 `_llmCalls`/`_turnDebugHistory`(및 legacy top-level 배치 사례)를 추가해 실제 구현과 규약을 동기화할 것을 `project-planner` 후속 작업으로 권고. (b) 최소한 target 문서에 "이 내부 필드들은 node-output.md Principle 0 예외 목록에 아직 미등재된 historical/legacy 필드" 라는 각주를 남겨 규약 갱신 필요성을 명시하면 혼동을 줄일 수 있다.

- **[INFO]** 목록 API 경로 `/api/executions/workflow/:workflowId` 가 `api-convention.md §2.1` 표준 패턴과 순서가 다름
  - target 위치: `spec/2-navigation/14-execution-history.md` §5 API 엔드포인트 표 — `GET /api/executions/workflow/:workflowId`
  - 위반 규약: `spec/5-system/2-api-convention.md §2.1` — `{base_url}/api/{resource}/{id}/{sub-resource}` (id 가 sub-resource 보다 먼저 옴)
  - 상세: 이 엔드포인트는 `{resource}/{sub-resource}/{id}` 순서(`executions/workflow/:workflowId`)로 되어 있어 §2.1 표준 패턴과 반대다. 다만 이는 이번 target 변경으로 신규 도입된 것이 아니라 기존 구현(`status: implemented`)에 이미 존재하는 경로이며, target 문서(--impl-prep 대상인 노드 서브탭 §3.3~3.4.2)와는 무관한 영역이다.
  - 제안: 이번 작업 범위 밖이므로 현 PR 에서 수정 불필요. 향후 API 정리 시 `GET /api/workflows/:workflowId/executions` 형태로의 전환 검토를 별도 backlog 로 남길 것을 권고(본 검토에서는 차단 사유 아님).

## 규약 준수 확인 (문제 없음, cross-check 목적 기록)

- **문서 구조 규약**: `spec/2-navigation/14-execution-history.md` 는 `## Overview (제품 정의)` / 본문(§1~§7) / `## Rationale` 3섹션 구조를 정확히 준수. frontmatter(`id: execution-history`, `status: implemented`, `code:`)도 `spec-impl-evidence.md` §2 스키마에 부합하며 `code:` 글로브 5건 모두 실제 파일에 매치함을 직접 확인.
- **명명 일관성 (cross-spec)**: 신규/변경된 §3.3~3.4.2 의 노드 상세 서브탭 명명(`Preview`/`Input`/`Output`/`LLM Usage`/`Config`/`Error`, 메시지 레벨 `Preview`/`Response`/`Request`/`LLM Usage`)과 탭 표시 조건·기본 탭 선택 우선순위(`Error → Preview → Output`)가 에디터 실행 결과 spec(`spec/3-workflow-editor/3-execution.md §10.6.1`)과 표현·순서·조건까지 정확히 일치한다. 두 화면(에디터 vs 실행 내역 페이지)이 같은 UI 패턴을 공유한다는 서술과도 부합하며, 이는 cross-spec 일관성 측면에서 바람직하다.
- **API 응답 포맷**: §5 의 목록 응답 예시(`{ data: [...], pagination: {...} }`)는 `api-convention.md §5.2` 및 `swagger.md §5-2` 의 single-wrap 규약과 정확히 일치.
- **에러 코드 표기**: `10-auth-flow.md §5.4` 의 `error=invalid_state` 등 redirect query param 표기는 `error-codes.md §3` historical-artifact 레지스트리에 이미 정식 등재되어 있어 정합.
- **frontmatter `id` 충돌 회피 패턴**: `2-navigation/16-agent-memory.md` 의 `id: nav-agent-memory` 는 `spec-impl-evidence.md §2.1` 이 규정한 "동일 basename 충돌 시 후발 문서가 영역 prefix 로 회피" 패턴을 정확히 따름(`5-system/17-agent-memory.md` 가 `agent-memory` 를 선점).
- **Swagger/DTO 패턴**: 이번 target 은 spec 문서 레벨이라 DTO 코드 자체는 검토 범위 밖이나, target 이 참조하는 응답 예시·필드명(`triggerSource`, `totalNodeCount` 등)은 기존 `swagger.md` 응답 DTO 규약과 충돌하지 않음.

## 요약

이번 --impl-prep 대상(`spec/2-navigation/`, 특히 신규/변경된 노드 상세 서브탭 §3.3~3.4.2)은 정식 규약을 전반적으로 잘 준수한다. 문서 구조(Overview/본문/Rationale), frontmatter 스키마, API 응답 포맷, 에러 코드 historical-artifact 표기가 모두 conventions 와 정합하며, 특히 에디터 실행 결과 spec 과의 cross-spec 탭 명명 일치는 모범적이다. 유일한 주목할 사항은 `_llmCalls`/`_turnDebugHistory` internal 필드가 `node-output.md` Principle 0 의 예외 등록부에 아직 반영되지 않은 gap 인데, 이는 target 문서의 오류가 아니라 convention 문서 쪽의 stale 여지이므로 구현을 차단할 사안은 아니다. `/api/executions/workflow/:workflowId` 의 URL 순서 이슈는 기존 구현이며 이번 범위 밖이다.

## 위험도

LOW
