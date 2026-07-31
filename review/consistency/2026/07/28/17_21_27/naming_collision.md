# 신규 식별자 충돌 검토 — spec/5-system/ (impl-prep)

## 검토 범위 및 방법

`prompt_file` 에 포함된 target(`spec/5-system/1-auth.md` · `10-graph-rag.md` · `11-mcp-client.md` 전문, 나머지 18개 파일은 예산 초과로 생략)과 검색 코퍼스(`spec/0-overview.md` 전문, `plan/in-progress/ai-agent-tool-connection-rewrite.md` 전문, `spec/conventions/audit-actions.md` 전문, 나머지 96+57+269개 파일은 예산 초과로 생략)를 전량 읽었다. 프롬프트 자체가 범위를 크게 벗어나 대부분 생략됐기 때문에, 프롬프트에 없는 실제 리포지토리(`spec/`, `codebase/`)를 직접 `grep`/`Read` 로 교차 검증해 신뢰도를 보강했다 (요구사항 ID 접두어 유일성, env var 정의 일관성, WS 이벤트·컨트롤러 라우트 실존 여부, 그리고 아래 CRITICAL 항목의 실제 코드 근거).

## 발견사항

- **[CRITICAL] Graph RAG 의 `Entity`/`Relation`/`ChunkEntity` 타입명이 TypeORM `@Entity` 심볼과 이미 충돌 — 스펙이 코드의 회피 명명을 반영하지 않음**
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` §2.3 "Entity (신규)", §2.4 "Relation (신규)", §2.5 "ChunkEntity (신규)" 및 Rationale "도메인 용어" 절이 도입하는 `Entity`/`Relation`/`ChunkEntity` 타입명. 동일 명칭이 `spec/1-data-model.md` §2.12.2~2.12.4 에도 그대로 반복된다(두 문서가 공유하는 데이터 모델 SoT 관계이므로 한쪽만 고치면 안 됨).
  - 기존 사용처: 백엔드 전역에서 TypeORM `@Entity(...)` 데코레이터가 이미 41개 `*.entity.ts` 파일에서 사용 중인 이 리포지토리의 표준 영속 모델 패턴이다. 실제 구현(`codebase/backend/src/modules/knowledge-base/entities/entity.entity.ts` · `relation.entity.ts` · `chunk-entity.entity.ts`)은 각각 `export class GraphEntity` / `GraphRelation` / `GraphChunkEntity` 로 명명되어 있고, 세 파일 모두 "클래스명에 `Graph` 접두를 둔 이유는 TypeORM `@Entity` 데코레이터/심볼과의 명명 충돌을 피하고…" 라는 동일한 코드 주석을 갖고 있다. DTO 계층(`knowledge-base-response.dto.ts`)도 `GraphEntityDto`/`GraphEntityDetailDto`, 프런트엔드(`entity-list.tsx` 등)도 `GraphEntity` 타입을 import 해 end-to-end 로 이미 이 우회 명명을 채택했다.
  - 상세: 스펙 본문(§2.3~2.5)과 데이터 모델(§2.12.2~4)은 필드 표·Rationale 전체에서 여전히 bare `Entity`/`Relation`/`ChunkEntity` 를 "신규 엔티티" 명칭으로 명시하며, 실제 구현이 `Graph` 접두로 그 충돌을 우회했다는 사실은 어디에도 언급하지 않는다. 이는 가정된 위험이 아니라 **이미 한 번 실제로 발생해 팀이 우회 명명을 채택**한 사안이며, 스펙(제품의 단일 진실로 선언된 문서)만 보고 작업하는 사람 — 예컨대 §8 "미결/후속 검토"(entity disambiguation, KB 단위 prompt override 등)를 이어서 구현하는 개발자나, 이 문서를 참조해 유사한 그래프 도메인 개념을 다른 영역에 도입하는 향후 spec 작성자 — 이 스펙 표기 그대로 `export class Entity` 를 새로 작성하면 같은 파일의 `import { Entity } from 'typeorm'` 과 즉시 이름이 충돌한다.
  - 제안: `spec/1-data-model.md` §2.12.2~2.12.4 와 `spec/5-system/10-graph-rag.md` §2.3~2.5 표·Rationale에 실제 구현 식별자(`GraphEntity`/`GraphRelation`/`GraphChunkEntity`/`GraphEntityDto`/`GraphEntityDetailDto`)를 병기하거나, 최소한 "TypeORM `@Entity` 충돌 회피를 위해 코드에서는 `Graph` 접두 사용" 각주를 추가한다. 재발 방지를 위해 `spec/conventions/`(예: 아직 없는 domain-modeling 성격의 규약 문서, 없다면 `1-data-model.md` 서두)에 "bare `Entity`/`Model`/`Schema` 등 프레임워크 예약어와 겹치는 도메인 타입명은 접두어로 구분한다" 는 명명 규약을 등재하는 것도 고려할 만하다 — 현재 어떤 convention 문서에도 이 교훈이 명문화돼 있지 않아, 다음에 유사한 이름을 도입하는 사람이 같은 문제를 반복 발견할 수 있다.

- **[INFO] Graph RAG 시각화의 "노드/엣지" 용어가 워크플로우 핵심 용어(Node/Edge)와 표면적으로 겹침**
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` KB-GR-UI-07 "그래프 시각화 (react-flow 또는 동등) — 노드/엣지 렌더, 줌, 호버 시 chunk 미리보기" — Entity/Relation 을 시각화 그래프의 "노드/엣지" 로 지칭.
  - 기존 사용처: `spec/0-overview.md` §7 "용어 정의" 가 "Node"("워크플로우 내에서 하나의 작업 단위") · "Edge"("두 노드 간의 연결")를 워크플로우 캔버스의 canonical 핵심 용어로 이미 정의한다.
  - 상세: 일반적인 그래프 이론 용어의 자연스러운 재사용이며, KB-GR-UI-07 은 실제로 react-flow(워크플로우 캔버스와 동일 라이브러리) 채택을 검토하다 최종적으로 3D/2D 전용 렌더러(`graph-3d-renderer.tsx`/`graph-visualization.tsx`)로 결정해 라이브러리 수준 충돌은 없다. 다만 같은 제품·같은 KB 상세 화면 인근에 의미가 다른 두 "노드/엣지" 개념이 공존하므로, 지원 문서·로그 검색·신규 합류자 온보딩 시 "노드 오류" 같은 검색어가 두 시스템을 혼동시킬 여지가 남는다.
  - 제안: 명칭 자체를 바꿀 필요는 없으나, §3.6/KB-GR-UI-07 인근에 "그래프의 노드/엣지(엔티티/관계이며 워크플로우 캔버스의 Node/Edge 와 무관)" 같은 1회성 disambiguation 각주를 추가하면 충분하다.

- **[INFO] 본 리뷰에 제공된 컨텍스트 자체의 커버리지 한계 — "생략된 파일" 목록에 파일 경로가 아닌 식별자가 섞여 있음**
  - target 신규 식별자: 해당 없음(리뷰 프로세스 자체에 대한 caveat).
  - 기존 사용처: `prompt_file` 의 "⚠️ 컨텍스트 예산 초과로 생략된 파일" 목록 — `spec/5-system/` 목록 안에 `_selectedPort`/`$trigger`/`$env` 가, `spec/` 전체 목록 안에 `integration_expired`/`integration_action_required` 가 파일 경로가 아닌 식별자 형태로 섞여 있다(예: `spec/5-system/4-execution-engine.md` 와 `5-expression-language.md` 사이에 `_selectedPort`가, `2-navigation/4-integration.md` 와 `5-knowledge-base.md` 사이에 `integration_expired`/`integration_action_required` 가 위치).
  - 상세: 이는 target 문서가 도입한 새 식별자가 아니라, 이 naming-collision 프롬프트를 조립한 orchestrator 스크립트의 "생략 파일 나열" 로직이 backtick 인용구를 파일 경로로 오인해 끼워 넣은 것으로 보인다. target 은 spec/5-system/ 21개 파일 중 3개만, 코퍼스는 spec/ 루트 트리 97개 중 1개·plan/in-progress 58개 중 1개·conventions 270개 중 1개만 실제로 포함됐다 — 이 리뷰가 "추가 충돌 없음" 이라고 결론짓더라도 그 근거는 이 좁은 가시 범위에 갇힌다. 이번 검토는 이를 보완하기 위해 실제 리포지토리를 직접 grep 해 target 이 도입한 구체 식별자(요구사항 ID 접두어 `KB-GR-*`/`NF-GR-*`, 신규 env var, 신규 endpoint, WS 이벤트, `Entity`/`Relation` 타입명)를 재검증했으나, 생략된 18개 `spec/5-system/*` 파일(webhook·replay-rerun·external-interaction-api·chat-channel·system-status-api·agent-memory·api-convention·error-handling·execution-engine·expression-language·websocket-protocol·llm-client·embedding-pipeline·rag-search·_product-overview) 본문은 줄 단위로 재확인하지 못했다.
  - 제안: 스펙 콘텐츠 문제는 아니므로 즉시 조치 불필요하나, orchestrator 의 "생략 파일 나열" 생성 로직(아마 backtick 인용구를 파일 경로로 grep 하는 방식)을 점검해 향후 리뷰의 "생략 파일 수" 표기 신뢰도를 높이는 편이 좋다.

## 요약

target 으로 제공된 `spec/5-system/1-auth.md`·`10-graph-rag.md`·`11-mcp-client.md` 세 문서에서 새로 도입되는 요구사항 ID(`KB-GR-*`/`NF-GR-*`), API endpoint, WebSocket 이벤트(`document:graph_*`), 환경변수(`MCP_MAX_CONCURRENT_CONNECTIONS` 등), 에러 코드는 실제 리포지토리 교차검증 결과 기존 사용처와 충돌이 없었다. 다만 Graph RAG 가 도입하는 `Entity`/`Relation`/`ChunkEntity` 타입명은 TypeORM `@Entity` 데코레이터와 이미 실제로 충돌해 구현이 `GraphEntity`/`GraphRelation`/`GraphChunkEntity` 로 우회한 전례가 있는데, 스펙 문서(`1-data-model.md`·`10-graph-rag.md` 양쪽 모두)는 이 사실을 전혀 반영하지 않고 있어 스펙만 보고 작업하는 향후 개발자가 같은 충돌을 반복 발견할 위험이 남아 있다 — 이미 코드로는 안전하게 우회됐으므로 당장 시스템이 오작동하는 것은 아니지만, "단일 진실" 로 선언된 스펙 문서의 정확성 문제이자 재발 가능한 명명 함정이라 CRITICAL 로 표기한다. 그 외에는 그래프 시각화의 "노드/엣지" 용어가 워크플로우 핵심 용어와 표면적으로 겹치는 경미한 INFO, 그리고 이번 리뷰 자체의 컨텍스트 커버리지가 예산 제약으로 크게 제한됐다는 caveat 을 보고한다. 코퍼스 대부분(스펙 루트 97개 중 96개, plan/in-progress 58개 중 57개, conventions 270개 중 269개, spec/5-system 21개 중 18개)이 이번 프롬프트에 실제로는 포함되지 않았으므로, "추가 충돌 없음" 은 직접 grep 으로 보강한 항목에 한해서만 확정적이다.

## 위험도

MEDIUM
