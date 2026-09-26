# 신규 식별자 충돌 검토 — export-workflow-typed

## 범위 확인

`검토 모드` 헤더는 `scope=spec/2-navigation/` 이지만, 번들에 실린 실제 작업 대상은
`plan/in-progress/export-workflow-typed.md` 다 — `ExportWorkflowDto.nodes`/`.edges` 를 새 응답
전용 DTO(`ExportedNodeDto` · `ExportedEdgeDto`, `workflow-response.dto.ts`)로 타입화하는 착수 전
플랜이며 `spec_impact: none` 으로 선언돼 있다(spec 문서 자체는 새 식별자를 도입하지 않고
`spec/2-navigation/1-workflow-list.md §3.2` 의 기존 서술 그대로다). 따라서 신규 식별자 충돌 점검은
이 플랜이 새로 도입하는 `ExportedNodeDto` / `ExportedEdgeDto` 두 클래스명에 실질적으로 집중했다.

## 발견사항

없음 — 아래는 확인한 근거다.

- **엔티티/타입명 충돌 없음**: 저장소 전체(`grep -rn "ExportedNodeDto\|ExportedEdgeDto"`)에서 이
  두 이름은 이 플랜 문서에만 등장한다. 기존 `*.dto.ts` 어디에도 동명 클래스가 없다
  (`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 확인, 현재
  `ExportWorkflowDto.nodes`/`.edges` 는 아직 `Record<string, unknown>[]` 로 미타입 상태 — 플랜의
  실측과 일치).
- **기존 자동 가드가 이 충돌 클래스를 이미 상시 검증한다**: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` +
  `dto-class-name-collision.spec.ts` 가 `*.dto.ts` 의 `export class` 이름을 AST 로 스캔해
  저장소 전역 유일성을 강제한다 (OpenAPI `components.schemas` 키가 클래스명이라 동명 충돌 시
  스키마가 서로 덮어써지는 것을 막는 가드). `ExportedNodeDto`/`ExportedEdgeDto` 를 구현 시점에
  추가해도 이 가드가 즉시 유일성을 재검증하므로, 이번 리뷰가 놓치더라도 impl-done 단계에서
  다시 걸린다.
- **명명 컨벤션과 정합**: `<Context><Node|Edge>Dto` 패턴은 이미 다수 선례가 있다
  (`SaveCanvasNodeDto`/`SaveCanvasEdgeDto`, `AssistantWorkflowNodeDto`/`AssistantWorkflowEdgeDto`,
  `GraphVizNodeDto`/`GraphVizEdgeDto`, `IntegrationUsageNodeDto`). `ExportedNodeDto`/`ExportedEdgeDto`
  는 이 네이밍 축에 자연스럽게 들어맞고, 플랜이 참조하는 기존 `NodeDto`
  (`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts`) · `EdgeDto`
  (`codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts`) 와도 이름이 겹치지
  않는다 — "타입 표기는 NodeDto·EdgeDto 를 따른다" 는 서술은 **재사용/상속이 아니라 필드 타입
  표기 방식만 참조**하는 것이라 클래스 정체성 충돌도 없다.
- **프런트엔드 대응 타입과의 관계는 충돌이 아니라 의도된 미러링**: `codebase/frontend/src/lib/api/workflows.ts`
  에 이미 `ExportedNode`(10키) / `ExportedEdge`(6키) interface 가 존재하고, 필드 구성이 플랜이
  적은 백엔드 키 목록과 정확히 일치한다(`description`/`containerIndex`/`toolOwnerIndex` nullable,
  엣지 `condition` nullable 포함). `ExportedNodeDto`/`ExportedEdgeDto` 는 이 프런트엔드 타입의 와이어
  계약을 광고하는 백엔드측 대응물로 이름이 자연스럽게 짝지어지며, 같은 `Dto` 접미사 관례상
  네임스페이스도 겹치지 않는다(백엔드는 `*Dto` 클래스, 프런트엔드는 접미사 없는 interface —
  기존 `NodeDto`/`NodeData` 쌍과 동일 패턴).
- **참조 enum 도 기존 정의와 일치**: 플랜이 언급하는 `NodeCategory`
  (`codebase/backend/src/modules/nodes/entities/node.entity.ts`) · `EdgeType`
  (`codebase/backend/src/modules/edges/entities/edge.entity.ts`) 는 이미 존재하는 enum 이며 새로
  도입되는 이름이 아니다.
- **API endpoint / 이벤트 / ENV / 파일 경로**: 이 플랜은 신규 endpoint·webhook·queue·SSE 이벤트·ENV
  var·config key 를 도입하지 않는다. 대상 파일(`workflow-response.dto.ts` · `workflow-crud.e2e-spec.ts` ·
  `workflow-response.dto.spec.ts`)도 모두 기존 파일이며 신규 파일 경로를 만들지 않는다(각각 기존
  경로에서 확인됨).
- **인접 트랙(marketplace)과도 무충돌**: `plan/in-progress/marketplace-and-plugin-sdk.md` 는 "기존
  워크플로 정의 JSON export/import 흐름 재사용" 을 전제하고 있어, 이번 플랜이 그 export 계약을
  타입화하는 방향과 상충하지 않는다(오히려 선행 정합).

## 요약

이 작업은 `spec/2-navigation/` 에 새 식별자를 도입하지 않으며(spec_impact: none), 실질 변경은
`ExportedNodeDto`/`ExportedEdgeDto` 두 백엔드 응답 DTO 클래스 신설이다. 저장소 전역 검색 결과 이
두 이름은 기존에 어떤 의미로도 쓰인 적이 없고, 기존 `NodeDto`/`EdgeDto`·프런트엔드
`ExportedNode`/`ExportedEdge`·`SaveCanvas*Dto` 계열과도 이름·의미 모두 충돌하지 않는다. 특히
저장소에는 이미 `*.dto.ts` 클래스명 전역 유일성을 AST 로 강제하는 전용 가드
(`dto-class-name-collision-guard.ts`)가 있어, 이 카테고리의 충돌은 impl-done 단계에서도 자동으로
재검증된다. 신규 식별자 충돌 관점에서 이 착수 전 검토를 막을 사유는 없다.

## 위험도

NONE
