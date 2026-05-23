# 신규 식별자 충돌 Check — 결과

검토 모드: `--impl-prep`
검토 대상: `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

### [CRITICAL] `output.result.presentations` — spec 간 존재 여부 모순

- **target 신규 식별자**: `output.result.presentations` 경로
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/conventions/data-hydration-surfaces.md` 행 20
  - "spec §7.10 echo — single-turn `out` / multi-turn final / condition route (`buildMultiTurnFinalOutput` / `buildConditionOutput` 의 `metadata.allPresentations`)"
  - frontend hydration 함수 4종의 입력 경로로 등재 (`parseHistoryMessages`, `threadTurnsToConversationItems`, `AssistantPresentationsBlock`, `applyExecutionSnapshot`)
- **상세**:
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.10` (line 900)은 명시적으로 "payload 본문은 ConversationTurn 의 top-level `presentations[]` 에만 저장하고, **`output.result.*` 에는 echo 하지 않는다**"라고 선언한다.
  - 반면 `data-hydration-surfaces.md §1.1`은 `output.result.presentations`가 backend echo 위치로 존재하고 frontend 4개 함수가 이 경로를 읽는다고 기술한다.
  - 두 spec이 같은 식별자(`output.result.presentations`)에 대해 "존재하지 않는다(ai-agent §7.10)" 와 "존재한다(data-hydration-surfaces §1.1)" 로 정반대로 기술하고 있다. 구현자가 어느 쪽을 따르느냐에 따라 frontend hydration 경로가 달라지며, 실행 내역 페이지의 presentations 렌더 유무가 결정되는 고위험 충돌이다.
- **제안**:
  - 두 스펙 중 권위 있는 쪽을 확정해야 한다. §7.10 의 "Principle 1.1 직교성" 논리(같은 데이터를 두 위치에 두지 않음)가 설계 원칙이라면, `data-hydration-surfaces.md` 의 `output.result.presentations` 행을 제거하고 "thread snapshot 경로(`ConversationTurn.presentations[]`) 만이 backend echo SoT" 로 수정해야 한다. 반대로 실행 내역 REST 복원 경로를 위해 `output.result.*` echo가 실제로 필요하다면, §7.10 의 "echo 하지 않는다" 진술을 정정하고 `meta.allPresentations` (또는 `output.result.presentations`) 필드를 공식화해야 한다.

---

### [WARNING] `ND-AG-25` — `spec/4-nodes/3-ai/_product-overview.md` 에서 누락

- **target 신규 식별자**: `ND-AG-26` (`Presentation Tool Family`)
- **기존 사용처**: `spec/4-nodes/_product-overview.md` (line 216): ND-AG-25가 "사용자 조건 포트 색상 구분·점선 구분자" 요구사항으로 등재됨
- **상세**:
  - `spec/4-nodes/_product-overview.md`는 ND-AG-23, ND-AG-24, ND-AG-25, ND-AG-26을 연속으로 정의한다.
  - `spec/4-nodes/3-ai/_product-overview.md`는 ND-AG-20 ~ ND-AG-24, ND-AG-26을 포함하지만 **ND-AG-25**가 없다. 번호 사이에 공백이 있어 다른 파일을 읽는 독자가 ND-AG-25가 AI 영역 `_product-overview`에서 정의됐는지, 아니면 누락인지 혼동할 수 있다.
  - ND-AG-25는 "조건 포트 색상 구분" — 새로 도입된 `render_*` / ND-AG-26과 직접 연관은 없지만, 두 overview 파일의 ID 범위가 불일치하면 유지보수 중 혼선 가능.
- **제안**: `spec/4-nodes/3-ai/_product-overview.md`에 ND-AG-25 행을 추가하거나, 두 overview 파일 간 ID 커버리지를 동기화한다. 또는 ND-AG-25가 UI 전용 요구사항임을 명시해 의도적 누락임을 표기한다.

---

### [INFO] `meta.presentationCalls[]` — 새 `meta` 필드 이름이 기존 `meta.toolCalls` 와 의미 중첩 가능

- **target 신규 식별자**: `meta.presentationCalls[]` (`spec/4-nodes/3-ai/1-ai-agent.md §7.10`)
- **기존 사용처**: `meta.toolCalls` (동일 파일 §7.1 표, line 468) — "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"
- **상세**:
  - `meta.toolCalls`는 숫자 scalar로 KB·MCP·일반 도구 호출 횟수 합산을 뜻하고, `meta.presentationCalls[]`는 `render_*` 호출 별 trace 배열이다. 의미가 달라 충돌은 아니지만, `meta.toolCalls` 카운터에 `render_*` 호출이 포함되는지 여부가 spec에서 모호하다. §6.1 단계 3.g에서 "`maxToolCalls` 초과 전까지 반복 (KB·MCP·표현·일반 호출 모두 합산)"이라고 하여 `render_*`가 합산에 포함되지만, §7.1의 `meta.toolCalls` 설명에는 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"으로만 기술되어 있어 `render_*`가 포함되는지 명시되지 않았다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1`의 `meta.toolCalls` 설명에 "표현 도구(`render_*`) 포함" 여부를 명시한다.

---

### [INFO] `PresentationPayload.truncation` — `output.{itemsTruncated|rowsTruncated}` 와 유사 이름 혼동 가능

- **target 신규 식별자**: `PresentationPayload.truncation.{itemsTruncated, rowsTruncated, itemsTotalCount, rowsTotalCount}` (`1-ai-agent.md §7.10`)
- **기존 사용처**: `spec/4-nodes/6-presentation/0-common.md §4` — presentation 노드의 `output.itemsTruncated: boolean`, `output.itemsTotalCount: number`, `output.rowsTruncated: boolean`, `output.rowsTotalCount: number`
- **상세**:
  - 기존 presentation 노드 output에서는 truncation 메타가 `output.*` 최상위 평탄 필드로 표현된다. 신규 `PresentationPayload.truncation`은 같은 의미의 값을 중첩 객체로 담는다. 이름이 같고 의미도 같지만 위치·구조가 다르다. 이름 충돌은 아니지만, 구현자가 "두 경로가 모두 정규화되어 있는가, 아니면 하나의 SoT에서 복사되는가"를 혼동할 수 있다.
  - `spec/4-nodes/6-presentation/0-common.md` line 301은 "잘린 결과는 `output.{itemsTruncated|rowsTruncated}: true` + `output.{itemsTotalCount|rowsTotalCount}` 와 동등한 메타가 ConversationTurn 의 top-level `presentations[i].truncation`에 surface 한다"고 명시해 두 경로의 동등성을 선언하고 있다.
- **제안**: 별도 조치는 불필요하나, `1-ai-agent.md §7.10`의 `truncation` 블록 설명에 "presentation 노드 output의 `itemsTruncated` / `rowsTruncated` 와 동등한 값 — 다른 경로로의 echo 아님"이라는 한 줄 주석을 추가하면 혼동 방지에 도움이 된다.

---

## 요약

target 3개 문서(`conversation-thread.md`, `node-output.md`, `1-ai-agent.md`)가 도입하는 신규 식별자 중 대부분은 기존 사용처와 충돌 없이 정의되어 있다. `render_*` 접두사는 기존 4개 도구 접두사(`cond_*`, `kb_*`, `mcp_*`, `tool_*`)와 겹치지 않고, `ND-AG-26`은 기존 ID 시퀀스에 신규 번호를 추가하는 형태다. `ai_form_render` 인터랙션 타입과 `PresentationPayload`, `presentationTools`, `pendingFormToolCall` 필드는 기존에 같은 이름으로 다른 의미가 사용된 경우가 없다. 다만 **CRITICAL** 하나가 존재한다: `output.result.presentations` 경로에 대해 `data-hydration-surfaces.md`가 "backend echo 경로로 존재한다"고 기술하는 반면, `1-ai-agent.md §7.10`은 "존재하지 않는다"고 명시해 두 권위 문서가 정면 충돌한다. 이 충돌은 실행 내역 페이지의 presentations 렌더 여부를 결정하는 실질 구현 분기점이므로 구현 착수 전 반드시 해소되어야 한다.

## 위험도

**HIGH**

STATUS: SUCCESS
