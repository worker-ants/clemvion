# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** OpenAPI 로 광고하는 응답 스키마가 넓어진다(공개 인터페이스 변경, 그러나 검증됨)
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:79-85` (`CanvasSaveResultDto.nodes`/`.edges` — `@ApiProperty({ type: 'array', items: { type: 'object' } })` + `Record<string, unknown>[]` → `@ApiProperty({ type: () => [NodeDto] })`/`[EdgeDto]` + `NodeDto[]`/`EdgeDto[]`)
  - 상세: `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 의 OpenAPI 응답 계약이 "타입 없는 열린 객체 배열"에서 "`NodeDto`/`EdgeDto` 참조 배열"(각 필드 `required`)로 바뀐다. 이 스키마로 클라이언트를 생성하는 소비자가 있다면 이전엔 존재하지 않던 필드-존재/타입 기대를 갖게 된다. 다만 (1) 컨트롤러 반환값은 서비스의 `Promise<{ workflow: Workflow; nodes: Node[]; edges: Edge[] }>`(TypeORM 엔티티, `workflows.service.ts:650`)를 그대로 통과시키고 `CanvasSaveResultDto` 로 명시적으로 타입 캐스팅되지 않으므로 런타임 직렬화 경로는 변경되지 않는다, (2) `NodeDto`/`EdgeDto` 는 `class-transformer` 의 `@Expose`/`@Exclude` 를 쓰지 않는 순수 `@ApiProperty` 전용 DTO라 설령 인스턴스화되어도 필드 필터링이 발생하지 않는다, (3) 새 e2e 두 케이스(생성 가지 C · 갱신 가지 I)가 `assertMatchesContract` 로 실제 응답과 선언을 전수 대조하며 통과했다(커밋 로그 `TEST WORKFLOW 통과(e2e 413)`). 저장소 내 `CanvasSaveResultDto` 참조자는 이 DTO 파일과 새 e2e 스펙뿐(`grep` 결과 그 외 0건) — frontend/생성 클라이언트가 이 타입을 직접 소비하는 자리는 없다.
  - 제안: 저장소 밖의 OpenAPI 스키마를 기반으로 클라이언트를 생성해 쓰는 외부 소비자가 있다면(사내 frontend 는 아님), 스키마가 더 엄격해졌음을 고지할 것. 코드 자체에는 추가 조치 불필요.

- **[INFO]** 같은 계열의 `ExportWorkflowDto.nodes`/`.edges` 는 여전히 타입 없는 객체 배열로 남는다(회귀 아님, 의도적 후속 분리)
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:162-167`(`ExportWorkflowDto`)
  - 상세: 이번 PR 은 `CanvasSaveResultDto` 만 좁혀 고쳤고, `GET /workflows/:id/export` 응답은 그대로 열린 채다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 항목으로 이미 등재돼 있어(export 포맷은 인덱스 기반 참조라 `NodeDto`/`EdgeDto` 재사용이 불가하고 `ImportNodeDto`/`ImportEdgeDto` 재사용 여부를 먼저 정해야 한다는 근거 포함) 의도적 스코프 분리로 보인다. 부작용은 아니지만, "노드/엣지 DTO 광고"라는 제목만 보고 export 경로도 함께 좁혀졌다고 오인하지 않도록 기록.
  - 제안: 조치 불필요 — 후속 plan 이 이미 추적 중.

- **[INFO]** 순환 import 위험 없음 확인
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:2-3`(신규 `import { EdgeDto } from '../../../edges/dto/responses/edge-response.dto'`, `import { NodeDto } from '../../../nodes/dto/responses/node-response.dto'`)
  - 상세: `node-response.dto.ts`/`edge-response.dto.ts` 는 각각 자신의 엔티티(`node.entity`/`edge.entity`)만 import 하고 `workflows` 모듈을 참조하지 않는다 — 단방향 의존(`workflows/dto → nodes/dto`, `workflows/dto → edges/dto`)이라 순환 import 가 생기지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 저장소 파일시스템 변경 없음(가드 결과)
  - 상세: 리뷰 과정에서 코드를 고쳐보는 뮤테이션을 수행하지 않았고(정적 분석·grep·Read 만 사용), `git status --short` 결과도 이 세션이 새로 생성한 `review/code/2026/09/26/22_05_52/` 산출물 외에 변경이 없다.

## 요약

핵심 변경은 `CanvasSaveResultDto.nodes`/`.edges` 의 OpenAPI 광고 타입을 열린 객체 배열에서 `NodeDto[]`/`EdgeDto[]` 로 좁히는 문서 전용(스키마 계약) 변경이다. 컨트롤러가 서비스의 엔티티 반환값을 그대로 통과시키고 두 DTO 에 `class-transformer` 필터링 데코레이터가 없어 런타임 직렬화 경로에는 영향이 없으며, 새 단위 테스트(스키마 선언 고정)와 새 e2e 두 케이스(생성/갱신 두 분기, `assertMatchesContract` 전수 대조)가 실제 응답과 선언의 일치를 검증한다. 다른 in-repo 소비자가 이 DTO 타입을 참조하지 않아 시그니처 변경의 파급 범위도 작다. 자매 DTO(`ExportWorkflowDto`)는 의도적으로 스코프 밖에 남았고 후속 plan 에 정확히 기록돼 있다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 관련된 부작용은 관찰되지 않았다.

## 위험도

LOW
