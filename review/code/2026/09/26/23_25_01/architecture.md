# 아키텍처 리뷰 — export-workflow-typed

## 발견사항

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 가 `NodeDto`/`EdgeDto` 와 필드 대부분(타입·카테고리·라벨·좌표·config·isDisabled·description 등)을 손으로 중복 선언한다. 동기화를 강제하는 컴파일/테스트 장치가 없어, 추후 `NodeDto`/`EdgeDto` 나 `Node`/`Edge` 엔티티에 컬럼이 추가되면 `ExportedNodeDto`/`ExportedEdgeDto` 가 조용히 드리프트할 수 있다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:147` (`ExportedNodeDto`), `:195` (`ExportedEdgeDto`)
  - 상세: plan(`plan/in-progress/export-workflow-typed.md`)에 재사용하지 않는 근거(요청/응답의 presence 계약이 다르다 — optional vs required, nullable 유무)가 명확히 기록돼 있어 결정 자체는 합리적이다. 다만 그 판단이 "필드 재사용 금지"이지 "필드 목록 동기화 불필요"를 뜻하지는 않는다. 이번 PR 은 저장소에 nestjs/swagger 의 `PickType`/`OmitType`/`IntersectionType` 같은 매핑 타입 유틸을 쓰지 않고 완전 수기 중복을 택했다.
  - 제안: 당장 바꿀 필요는 없으나, 다음에 `NodeDto`/`EdgeDto` 필드가 바뀔 때 `ExportedNodeDto`/`ExportedEdgeDto` 도 함께 봐야 한다는 사실을 트래커나 코드 주석에 한 줄 더 남겨두면(예: "필드 추가 시 이 클래스도 확인" 마커) 드리프트를 줄일 수 있다.

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 는 개념적으로 `nodes`/`edges` 모듈의 응답 형태지만, 기존 관례상 `NodeDto`는 `nodes/dto/responses/node-response.dto.ts`, `EdgeDto`는 `edges/dto/responses/edge-response.dto.ts` 에 있는 반면 이 둘은 `workflows/dto/responses/workflow-response.dto.ts` 에 선언됐다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:147`, `:195`
  - 상세: "이 두 DTO 는 오직 `ExportWorkflowDto` 문맥에서만 쓰이고 노드 간 참조를 UUID 가 아닌 인덱스로 정규화한 export 전용 뷰"라는 점에서 사용처(워크플로우 export) 기준 배치도 방어 가능한 선택이다. 다만 "도메인 엔티티별 응답 DTO 는 해당 모듈에 둔다"는 기존 배치 관례와는 어긋나므로, 다음 사람이 `NodeDto` 근처를 찾다가 놓칠 수 있다.
  - 제안: 차단 사유는 아님. 필요하면 `node-response.dto.ts`/`edge-response.dto.ts` 상단에 "export 전용 변형은 `workflow-response.dto.ts` 의 `ExportedNodeDto`/`ExportedEdgeDto` 참고" 같은 backlink 주석을 추가하는 정도로 충분하다.

- **[INFO]** `workflow-response.dto.ts` 한 파일에 `WorkflowDto` · `ExecuteAcceptedDto` · `CanvasSaveResultDto` · `GraphWarningResultDto`/`GraphWarningsResponseDto` · 이번에 추가된 `ExportedNodeDto`/`ExportedEdgeDto`/`ExportWorkflowDto` 까지 서로 다른 엔드포인트의 응답 계열 8개 클래스가 누적돼 있다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 전체
  - 상세: 이번 PR 이 새로 만든 문제는 아니고 기존 파일 구조에 얹은 것이지만, "워크플로우 관련 모든 응답 DTO" 라는 넓은 응집 기준으로 계속 커지고 있다. 각 클래스 자체는 작고 명확해 당장 가독성 문제는 크지 않다.
  - 제안: 파일이 더 커지면 엔드포인트별로 파일을 쪼개는 것(예: `workflow-export-response.dto.ts`)을 고려. 이번 PR 범위에서 강제할 사안은 아니다.

## 긍정적 관찰

- `ExportedNodeDto`/`ExportedEdgeDto`/`ExportWorkflowDto` 추가는 기존 `NodeDto`/`EdgeDto`/`CanvasSaveResultDto` 를 수정하지 않고 순수 확장으로 이뤄져 개방-폐쇄 원칙에 부합한다.
- `NodeCategory`/`EdgeType` enum 을 엔티티에서 import 해 DTO 에 그대로 광고하는 패턴은 `NodeDto`/`EdgeDto` 가 이미 쓰는 기존 관례와 일치해 새로운 결합 축을 만들지 않는다(`codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:2` 대조 확인).
- `workflow-response.dto.spec.ts` 의 리팩터링은 `CanvasSaveResultDto` 전용 `describe` 를 `it.each` 파라미터화 테이블로 일반화해, `ExportWorkflowDto` 케이스를 새 `describe` 블록 복제 없이 얹었다 — 좋은 테이블 기반 테스트 패턴 적용이다.
- `ExportedNodeDto`/`ExportedEdgeDto` 선언 위 인라인 주석(`workflow-response.dto.ts:139-142`)이 "왜 `NodeDto`/`EdgeDto`, `ImportNodeDto`/`ImportEdgeDto` 를 재사용하지 않는가"를 근거와 함께 남겨, 향후 "왜 중복이냐"는 재질문을 코드 수준에서 선점한다 — 레이어 책임(요청 계약 vs 응답 계약)의 구분이 명료하다.
- e2e(`workflow-crud.e2e-spec.ts`)가 이미 알려진 갭(`formatVersion` 미구현)을 `allowMissing` 으로 명시적으로 배제해, 테스트가 알려진 결함을 숨기지 않고 계약 검증의 나머지 범위는 그대로 강제한다.
- 순환 의존성: `workflow-response.dto.ts` → `nodes/entities/node.entity.ts`, `edges/entities/edge.entity.ts` 로의 새 import 는 엔티티 계층에 대한 단방향 참조이며, 두 엔티티는 역으로 `workflows/dto` 를 참조하지 않아(엔티티 간 FK 참조만 `workflows/entities/workflow.entity.ts`) 순환 참조를 만들지 않는다(직접 확인).

## 요약

이번 변경은 `GET /workflows/:id/export` 응답의 `nodes`/`edges` 를 기존처럼 타입 없는 객체 배열이 아니라 export 전용 DTO(`ExportedNodeDto`/`ExportedEdgeDto`)로 광고하도록 좁게 확장한 PR이다. 기존 `NodeDto`/`EdgeDto`/요청 DTO를 수정 없이 그대로 두고 새 클래스만 추가해 개방-폐쇄 원칙을 지켰고, 재사용하지 않기로 한 결정(요청 vs 응답의 presence/nullable 계약 차이)이 plan 문서와 코드 인라인 주석 양쪽에 근거와 함께 기록돼 있어 추상화 수준과 레이어 책임(요청 DTO≠응답 DTO) 구분이 명확하다. 유일한 아쉬운 지점은 `NodeDto`/`EdgeDto` 와의 필드 중복을 강제 동기화하는 장치가 없다는 점과, export 전용 노드/엣지 DTO 가 도메인 모듈(nodes/edges)이 아닌 workflows 모듈 파일에 배치돼 기존 파일 배치 관례와 약간 어긋난다는 점인데, 둘 다 차단 사유가 아닌 유지보수성 참고사항 수준이다. 순환 의존성이나 SOLID 위반, 레이어 침범은 발견되지 않았다.

## 위험도

LOW
