# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto.nodes`/`.edges` 필드 타입 축소는 컴파일 타임 전용 — 런타임 응답은 그대로다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:245`, `:250` (필드 선언), 대조군 `codebase/backend/src/modules/workflows/workflows.service.ts:456-498` (`exportWorkflow`), `codebase/backend/src/modules/workflows/workflows.controller.ts:524-529` (`exportWorkflow` 핸들러)
  - 상세: `nodes: Record<string, unknown>[]` → `nodes: ExportedNodeDto[]`, `edges: Record<string, unknown>[]` → `edges: ExportedEdgeDto[]` 로 타입을 좁혔지만, 실제 생산자인 `WorkflowsService.exportWorkflow` 는 여전히 `Promise<Record<string, unknown>>` 를 반환하고 컨트롤러도 그 값을 가공 없이 그대로 돌려준다. `ExportWorkflowDto` 는 `@ApiOkWrappedResponse(ExportWorkflowDto, …)` 데코레이터로만 참조되어 Swagger 스키마 생성에만 쓰인다 — TS 타입 시스템이 서비스/컨트롤러 반환값을 이 DTO 로 강제하지 않으므로, 이번 변경은 OpenAPI 문서 표면과 테스트(계약 검증자)에서만 관측되고 실제 HTTP 응답 바이트는 변경 전과 동일하다. plan 자신도 "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다" 라고 명시해 이 관측과 일치한다.
  - 제안: 조치 불요(의도된 설계, plan 이 실측·명시함). 다만 향후 누군가 `exportWorkflow` 의 반환 타입을 `Promise<ExportWorkflowDto>` 로 강하게 타이핑하려 시도하면, 그 시점에 실제 필드 채움 로직(`positionX`/`positionY` 등 `Node`/`Edge` 컬럼 매핑)이 DTO 선언과 어긋나지 않는지 별도 확인이 필요하다는 점만 기록해 둔다.

- **[INFO]** 신규 import(`EdgeType`, `NodeCategory`) 순환참조 없음 — 확인됨, 결함 아님
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:3`, `:5`
  - 상세: `EdgeType` 은 `../../../edges/entities/edge.entity`, `NodeCategory` 는 `../../../nodes/entities/node.entity` 에서 새로 import 된다. 두 엔티티 파일을 직접 열어 확인한 결과 둘 다 `workflow.entity.ts` 만 import 하고 `workflow-response.dto.ts` 를 되돌아 참조하지 않으므로 순환 의존성이 생기지 않는다. `enumName: 'NodeCategory'`/`'EdgeType'` 도 기존 `NodeDto`/`EdgeDto` 가 이미 같은 enum·같은 이름으로 광고 중이라 OpenAPI 컴포넌트 스키마 이름 충돌도 없다.
  - 제안: 조치 불요 — 검증 목적의 기록.

- **[INFO]** e2e·unit 테스트 변경은 순수 부가(additive) — 프로덕션 부작용 없음
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (테스트 C 안 `assertMatchesContract(dupExport.body.data, …)` 블록), `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` (전체)
  - 상세: e2e 파일은 기존 duplicate(C) 케이스 안에 export 응답 계약 대조 단언을 추가했을 뿐 신규 API 호출·DB 쓰기 경로를 만들지 않는다(이미 만들어진 `dupExport` 응답을 재사용). unit 스펙 파일은 `it.each` fixture 확장과 새 `it` 블록 추가로, 둘 다 순수 검증 로직이라 부작용 표면이 없다.
  - 제안: 조치 불요.

- **[INFO]** plan/리뷰 산출물 파일 위치는 프로젝트 규약과 일치
  - 위치: `plan/in-progress/export-workflow-typed.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (항목 추가), `review/consistency/2026/09/26/22_52_28/*` (신규)
  - 상세: 신규 plan 은 `plan/in-progress/`, consistency-check 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 아래에 위치해 CLAUDE.md 의 "정보 저장 위치" 표와 일치한다. 예기치 않은 경로에 파일을 생성하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 저장소 잔여 뮤테이션 없음 — `git status --short` 로 확인
  - 위치: 워크트리 루트
  - 상세: plan 문서가 기술하는 뮤테이션 절차("저장소 파일 제자리 치환 → 실행 → `shutil.copy` 복원")가 정상적으로 원복됐는지 `git status --short` 로 확인했다. 결과는 이 리뷰 세션 자신이 만든 `review/code/2026/09/26/23_25_01/` 한 건뿐이며, DTO·테스트·서비스 파일 어디에도 미커밋 잔여물이 없다.
  - 제안: 조치 불요.

전역 변수 신설/수정, 환경 변수 읽기·쓰기, 예기치 않은 네트워크 호출, 이벤트/콜백 발생 변경은 관측되지 않았다. 기존 함수/메서드의 **런타임 시그니처**(파라미터·반환값 실제 타입)도 변경되지 않았다 — 바뀐 것은 Swagger 문서화용 클래스 필드 타입 선언(컴파일 타임)뿐이다.

## 요약

이번 변경은 `GET /workflows/:id/export` 응답의 `nodes`/`edges` 원소를 타입 없는 객체 배열에서 `ExportedNodeDto`/`ExportedEdgeDto` 로 선언하는 순수 문서화(OpenAPI 계약) 강화이며, 실제 생산자(`WorkflowsService.exportWorkflow`)와 컨트롤러의 런타임 반환값·로직은 전혀 건드리지 않아 실질적 부작용 표면이 없다. 새로 import 한 엔티티 enum(`EdgeType`, `NodeCategory`)도 순환참조·이름 충돌이 없음을 직접 확인했고, 테스트·plan·리뷰 산출물 추가는 모두 적절한 위치에 부가적으로만 이뤄졌으며 저장소에 뮤테이션 잔여물도 없다. 전역 상태·환경 변수·네트워크·이벤트 콜백 관련 부작용은 발견되지 않았다.

## 위험도
NONE
