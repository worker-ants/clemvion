# RESOLUTION — 워크플로우 에디터 가이드 PR (review/code/2026/07/08/00_00_40)

리뷰 결과: **MEDIUM · Critical 1 · Warning 1 · Info 4**. 아래와 같이 처리했다.

## Critical #1 — Tool Area 문서 모순 → **FIXED (인라인 정합)**

**문제**: 신규 `containers-and-tools.mdx`는 "캔버스 Tool Area 없음(설정 패널로 도구 연결)"을 정확히 서술하는데, 같은 PR이 링크 수정으로 건드린 `02-nodes/ai`·`99-faq`가 여전히 "캔버스 Tool Area에 노드를 끌어다 놓으면 도구 등록"이라는 제거된 UI를 live 로 서술 → 사용자가 존재하지 않는 UI로 안내됨.

**근거 재확인**: `spec/3-workflow-editor/0-canvas.md §12` "재작성 예정(현재 제거됨)", `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — `toolNodeIds`는 스키마에서 제거되어 `.passthrough()`로만 관용(line 399 주석), 최상위 `toolOverrides`도 없음(존재하는 것은 `mcpServers[].toolOverrides` 중첩 필드뿐, line 96). 프론트엔드에 `ToolArea` 컴포넌트 없음. 정식 추적: `plan/in-progress/ai-agent-tool-connection-rewrite.md`(재설계 미결).

**조치** (모두 현재 동작 = "AI Agent 도구는 설정 패널의 Knowledge Base·MCP 연결"로 정정):
- `02-nodes/ai.mdx` — config FieldTable 의 "도구 노드 (Tool Area)" 행 + 최상위 "toolOverrides" 행 제거(스키마에 없는 필드), 팁 bullet 재작성.
- `02-nodes/ai.en.mdx` — 동일(KO parity).
- `99-faq/faq.mdx` / `faq.en.mdx` (Q18) — "내부 노드를 Tool Area에 끌어다 놓기" 서술 제거, 외부=MCP / 사내 지식=Knowledge Base 로 정정.
- `06-integrations-and-config/mcp-servers.mdx` / `.en.mdx` — MCP vs Tool Area 대비를 MCP vs Knowledge Base 로 정정(§16·§100 / §5·§89).

## Warning #1 — spec IA 트리 라벨 불일치 → **FIXED**

`spec/2-navigation/13-user-guide.md` containers 행이 "AI Agent Tool Area"를 그대로 사용 → 페이지 실제 제목("컨테이너와 AI Agent 도구")·본문(Tool Area 부재)과 불일치. 라벨을 "컨테이너와 AI Agent 도구 (그룹 · 중첩 · 설정 패널 기반 도구 연결)"로 정정.

## Info #1 — mcp-servers 인접 문서 잔여 서술 → **FIXED** (Critical #1 조치에 포함)

## Info #2 — 영문 Tips 헤딩 3갈래 → **FIXED**

`overview.en` · `connecting-nodes.en` · `containers-and-tools.en`(각 `Tips & references`) · `keyboard-shortcuts.en`(`Tips and related pages`)를 하우스 컨벤션 `## Tips & notes`(기존 docs 15회 사용)로 통일.

## Info #3 — links.ts 신규 키 미사용 → **NO CHANGE (의도)**

`workflowEditor.*` 키는 딥링크 상수 레지스트리로 사전 등록(기존 `overview` 키와 동일 패턴, MDX 내부 링크는 canonical 경로 문자열 사용). 회귀 아님, 차단 사유 아님 — 그대로 둠.

## Info #4 — plan 잔여 경로 → **FIXED**

`plan/in-progress/ai-agent-tool-connection-rewrite.md §7`의 개명 전 경로(`03-workflow-editor/walkthrough.mdx`)를 실제 에디터 도구 연결 문서(`containers-and-tools.mdx`)로 갱신 + 현재 서술 상태 주석.

## reviewer output flakiness (scope / side_effect / testing)

3개 reviewer 가 success 보고했으나 `output_file` 미생성(기존 알려진 FS write flakiness). 변경 성격이 docs 전용이라(실행 코드 = `links.ts` 정적 상수 rename 1건뿐, 신규 런타임 로직 없음) side-effect/scope/testing 관점의 추가 Critical 가능성은 무시 가능. requirement·documentation·maintainability 3개 reviewer 가 실질 발견을 모두 커버했고, 그 지적은 위와 같이 전부 처리. 재실행 생략.

## 검증

- `pnpm --filter frontend exec vitest run src/lib/docs/__tests__` — 17스위트 2472테스트 통과(정정 후 재실행, ai.mdx FieldTable 행 제거 포함).
- `pnpm --filter frontend build` — Compiled successfully, 정적 페이지 123개 생성(전 MDX 컴파일 확인).
- `pnpm --filter frontend lint` — 0 error(사전 실행, 본 diff 무관 경고 11건만).

## 잔여 (후속)

없음. Tool Area 관련 문서 정합은 본 PR에서 완결. AI Agent 도구 연결 **모델 재설계** 자체는 기존 `plan/in-progress/ai-agent-tool-connection-rewrite.md`가 계속 추적(재설계 확정 시 docs 재갱신).
