# 신규 식별자 충돌 검토 — spec/5-system/ (impl-prep)

## 검토 범위 및 방법

`prompt_file` 의 target(`spec/5-system/1-auth.md` · `10-graph-rag.md` · `11-mcp-client.md` 전문, 나머지
spec/5-system/* 18개 파일은 예산 초과로 생략)과 코퍼스(`spec/0-overview.md` 전문,
`plan/in-progress/ai-agent-tool-connection-rewrite.md` 전문, `spec/conventions/audit-actions.md`
전문, 나머지 대부분 생략)를 전량 읽었다. 프롬프트 자체 커버리지가 좁아, 실제 리포지토리
(`spec/**`, `codebase/**`)를 직접 `grep`/`Read` 로 광범위 교차검증했다: migrations 버전 번호 전수
대조, `.env.example` + `webauthn.config.ts`/`mcp.config.ts`, 요구사항 ID 접두어(`KB-GR-*`/`NF-GR-*`)
전역 유일성, entity/tool-provider 클래스명 실존 확인, `KbEventType` WS 유니온, `service_type` 레지스트리,
에러 코드 상수 파일(`mcp-error-codes.ts`, `error-codes.md`), `reextract_status`/`graph_extraction_status`
컬럼 분리, 그리고 아래 WARNING 의 근거인 프런트엔드 `@xyflow/react` import 전수 확인.

같은 scope 로 2026-07-28 17:21:27 에 수행된 선행 naming_collision 리뷰(`review/consistency/2026/07/28/17_21_27/naming_collision.md`)가 이미 존재해 대조했다 — 그 리뷰의 **CRITICAL**(Graph RAG `Entity`/`Relation`/`ChunkEntity` 가 TypeORM `@Entity` 심볼과 충돌하는데 스펙이 이를 반영하지 않음)은 이번 검토 시점 기준 `spec/5-system/10-graph-rag.md` §2.3~2.5 Rationale("구현 식별자 주의" 각주, `Graph` 접두 명시)과 `spec/1-data-model.md` §2.12.2~2.12.4 (제목에 "구현: `GraphEntity`" 등 병기) **양쪽 모두에 반영되어 해소를 확인**했다(commit `71ce6c12b`). 회귀 없음.

## 발견사항

- **[WARNING] Graph RAG 시각화의 `Node`/`Edge` 개념이 워크플로우 캔버스의 실제 타입 식별자(`Node`/`Edge`)와 같은 이름 — 코드에서는 매번 별도 접두로 회피했으나 spec 은 그 회피를 규칙으로 명문화하지 않음**
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` KB-GR-UI-07("그래프 시각화(react-flow 또는 동등) — 노드/엣지 렌더")과 §5.2 `GET /api/knowledge-bases/:id/graph/visualization` 이 도입하는 시각화용 "노드/엣지" 개념. `spec/0-overview.md` §7 도 "Entity/Relation" 정의 인근에서 이 그래프를 함께 서술한다.
  - 기존 사용처: (1) 워크플로우 캔버스 프런트엔드가 `@xyflow/react`(react-flow) 의 **bare `Node`/`Edge` 타입을 리터럴로 import** 해 전역적으로 사용 중이다 — 예: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx:8` `import type { Node, Edge } from "@xyflow/react"`, `codebase/frontend/src/components/editor/canvas/custom-node.tsx:5`, `custom-edge.tsx:5`, `use-edge-execution-state.ts:2` 등 최소 6개 파일. (2) 백엔드에는 이미 워크플로우 도메인의 `NodeDto`(`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:5`)·`EdgeDto`(`codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:5`)가 존재한다. (3) `spec/0-overview.md` §7 "용어 정의" 가 "Node"("워크플로우 내에서 하나의 작업 단위")·"Edge"("두 노드 간의 연결")를 이미 제품 canonical 용어로 선언했다.
  - 상세: 실제 구현은 이 충돌을 이미 두 곳에서 **암묵적으로** 회피했다 — 백엔드 DTO 는 `GraphVizNodeDto`/`GraphVizEdgeDto`(`knowledge-base-response.dto.ts:326,341`)로, 프런트 3D 렌더러는 `Graph3DNode`/`Graph3DLink`(`graph-3d-renderer.tsx:25,32`)로 명명해 bare `Node`/`Edge` 를 피했다. `graph-visualization.tsx`(2D 래퍼) 는 아예 `@xyflow/react` 를 import 하지 않고 `ForceGraph3D` 기반으로 우회했다 — 이는 KB-GR-UI-07 상태란의 "react-flow 대신 3D/2D 렌더러 채택" 결정과도 맞물린다. 문제는 이 회피가 **두 곳에서 개별적으로, 문서화 없이** 재발명됐다는 점이다: 이제 막 CRITICAL 로 확정·수정된 `Entity`/`Relation`(TypeORM `@Entity` 충돌 → `Graph` 접두)과 정확히 같은 패턴이 같은 문서(`10-graph-rag.md`) 안에서 한 번 더 일어났는데, 이번엔 spec 어디에도 "왜 `GraphViz`/`Graph3D` 접두를 쓰는지" 각주가 없다. §8 "미결/후속 검토"(그래프 시각화 P2+, community detection 클러스터 요약)를 이어 구현하거나, KB-GR-UI-07 표기대로 실제 react-flow 를 채택하는 후속 작업자가 이 문서만 보고 `type Node = {...}` 또는 `import type { Node, Edge }` 를 워크플로우 캔버스 코드와 같은 파일 트리(`components/editor/` 인근 또는 KB 컴포넌트가 향후 canvas 유틸을 재사용하는 경우)에서 재사용하면, 이미 `@xyflow/react` 의 `Node`/`Edge` 를 import 중인 파일과 실제 TypeScript 이름 충돌이 발생할 수 있다. CRITICAL 로 분류하지 않는 이유는 (a) 현재 코드에는 활성 충돌이 없고, (b) target 문서가 특정 클래스명을 직접 지시하지는 않아 Entity 케이스처럼 "스펙 표기를 그대로 베끼면 즉시 깨짐" 수준의 기계적 필연성은 없기 때문이다.
  - 제안: `10-graph-rag.md` §3.6/KB-GR-UI-07 인근(또는 방금 추가된 §2.3~2.5 Rationale "구현 식별자 주의" 각주 옆)에 "시각화의 노드/엣지는 워크플로우 캔버스의 Node/Edge(`@xyflow/react`, `NodeDto`/`EdgeDto`)와 별개이며 구현은 `GraphViz*`/`Graph3D*` 접두를 쓴다" 는 한 줄을 병기한다. 재발 방지 차원에서는, 이미 이번에 Entity 건으로 논의된 "프레임워크/도메인 예약어와 겹치는 bare 타입명은 접두어로 구분한다" 명명 규약을 만들 때 이 Node/Edge 사례도 두 번째 실례로 함께 등재하면 같은 실수의 세 번째 재발(예: 향후 다른 그래프형 UI 도입 시)을 막을 수 있다.

## 요약

target 세 문서(`1-auth.md`·`10-graph-rag.md`·`11-mcp-client.md`)가 도입하는 요구사항 ID(`KB-GR-*`/`NF-GR-*`), API endpoint, WebSocket 이벤트(`document:graph_*`, 코드의 `KbEventType` 유니온과 정확히 일치 확인), 환경변수(`WEBAUTHN_*`, `MCP_*`, 코드의 `webauthn.config.ts`/`mcp.config.ts` 와 정확히 일치 확인), 감사 액션(`user.*`/`model_config.*`, `audit-actions.md` 3분류 taxonomy 와 정합), 마이그레이션 버전(V025/V026/V027/V037/V058, 전수 대조 결과 중복 없음 — 겹쳐 보이던 버전은 전부 `.sql`+`.conf` 동반 파일), 에러 코드(`MCP_*`, `KB_REEXTRACT_IN_PROGRESS`, `INVALID_TOOL_ARGUMENTS` — 후자는 `error-codes.md` 가 "AI Agent 모든 tool provider 공유 category" 로 이미 의도적 prefix-less 등재)는 실제 코드와 교차검증한 결과 기존 사용처와의 충돌이 없었다. 선행 리뷰(17:21:27)가 발견한 CRITICAL(`Entity`/`Relation`/`ChunkEntity` vs TypeORM `@Entity`)은 이번 시점 기준 `10-graph-rag.md` 와 `1-data-model.md` 양쪽에 `Graph` 접두 매핑이 명문화되어 **해소를 재확인**했다. 다만 같은 문서 안에서 구조적으로 동일한 패턴(제품 도메인이 범용 그래프 용어를 재사용하다 프레임워크/타 도메인 예약어와 부딪힘)이 한 번 더 있다 — 그래프 시각화의 "노드/엣지" 가 워크플로우 캔버스의 `@xyflow/react` `Node`/`Edge` 및 백엔드 `NodeDto`/`EdgeDto` 와 이름이 겹치며, 코드는 이미 `GraphViz*`/`Graph3D*` 접두로 회피했으나 spec 은 그 사실을 문서화하지 않았다(WARNING). 현재 활성 충돌은 없으므로 차단 사유는 아니다.

## 위험도

LOW
