# 아키텍처(Architecture) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** "배치(batch) 참조 소속 검사" 로직이 세 곳에서 중복 구현됨 — 이 PR 이 바로 이 관심사를 위해 공용 유틸(`reference-in-scope.ts`)을 신설했음에도, 단건 검사(`assertReferenceInScope`)만 추상화되고 배치 검사 패턴은 추출되지 않았다.
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/workflows/workflows.service.ts:1111`(`validateCanvasReferences`) 및 `:1210`(`assertNewNodeIdsUnused`)
  - 상세: 세 구현 모두 "후보 참조 id 목록 구성 → (DB 조회 또는 in-memory Set 대조로) 존재 여부 판정 → `InvalidReference[]` 누적 → `throwInvalidReferences` 호출"이라는 동일한 골격을 손으로 반복한다. `nodes.service.ts:97` 바로 위 주석("엣지 끝점 검사(`EdgesService.assertEndpointsInWorkflow`)와 같은 형태")이 이 중복을 스스로 인지하고 있음을 보여준다. 실제로 직전 리뷰(`review/code/2026/09/27/21_43_01` W2)에서 노드/엣지 두 구현의 조회 전략(순차 `exists` vs `In()` 일괄)이 갈렸다가 사후 수작업으로 맞춘 이력이 있다(`698ad8ab7`) — 공용 배치 헬퍼가 없으면 다음에 필드가 하나 더 늘 때 같은 종류의 divergence 가 재발할 수 있다. `throwInvalidReferences`/`InvalidReference`는 이미 세 파일 모두 import 하고 있어, "여러 후보 id 를 한 번의 `In()` 조회로 검증하고 남는 것만 `InvalidReference[]`로 묶어 던진다"는 배치 버전을 `reference-in-scope.ts`에 하나 추가해 세 호출부를 걷어낼 여지가 있었다.
  - 제안: `reference-in-scope.ts`에 `assertReferencesInScope(repo, refs: {field, id, message}[], scopeWhere)` 류의 배치 버전을 추가하고 edges/nodes 두 구현을 이걸로 교체. `workflows.service.ts`의 `validateCanvasReferences`/`assertNewNodeIdsUnused`는 DB 조회가 아니라 payload 내부 집합 비교/전역 유일성 검사라 성격이 다르지만, 최소한 "후보 누적 → invalid 필터 → throw" 부분만이라도 공통 헬퍼로 뽑으면 세 파일의 형태 차이를 줄일 수 있다. 지금 당장 막을 결함은 아니므로 급하지는 않지만, 유지보수 관점에서 백로그에 남겨둘 값어치가 있다.

- **[INFO]** 워크스페이스/워크플로 소속 검증이 구조적 강제가 아니라 호출부마다의 "기억"에 의존
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts:31`(`assertReferenceInScope` 호출), `codebase/backend/src/modules/folders/folders.service.ts`(`assertParentInWorkspace`), `codebase/backend/src/modules/schedules/schedules.service.ts:188`, `codebase/backend/src/modules/triggers/triggers.service.ts:487`, `codebase/backend/src/modules/workflows/workflows.service.ts:287`(`assertFolderInWorkspace`) 등 8개 이상 호출부
  - 상세: 이 PR 이 고치는 결함 자체가 "새 참조 필드가 추가될 때마다 소속 검사를 개발자가 수동으로 붙여야 하는 구조"에서 비롯됐다(CHANGELOG 의 트리거/스케줄/캔버스/노드/폴더/모델설정 여섯 갈래가 전부 같은 클래스의 누락). 이번 PR 은 그 클래스 전체를 한 번에 훑어 막았지만, 다음에 새 cross-referencing 필드(예: 새 모듈의 `workflowId`)가 추가될 때 이 검사를 붙이도록 강제하는 구조적 장치(예: DTO 데코레이터, 공통 guard/interceptor, DB 레벨 제약)는 여전히 없다 — 여전히 "그 필드를 만지는 사람이 `spec/1-data-model.md` §1.1 을 기억하고 헬퍼를 호출"하는 규율에 의존한다.
  - 제안: 급하게 처리할 필요는 없음(이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "교차 워크스페이스 참조 후속" 항목이 "이미 저장된 교차 행" 점검과 실행 시점 방어선을 후속 과제로 추적 중이라 팀이 이 리스크를 인지하고 있다). 다만 신규 참조 필드 추가 시 linting/코드리뷰 체크리스트에 이 항목을 명시하는 것을 권장.

- **[INFO]** 단건 참조 검증(`assertReferenceInScope`)의 재사용은 양호한 추상화 — 모듈 경계·SRP 관점에서 개선점
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37`(`assertReferenceInScope`), `codebase/backend/src/common/utils/reference-in-scope.ts:21`(`throwInvalidReferences`)
  - 상세: "쿼리 실행 후 존재 판정"(`assertReferenceInScope`)과 "포맷팅된 400 을 던지는 저수준 프리미티브"(`throwInvalidReferences`)를 분리해 둔 설계 덕에, 단건 케이스(Alerts/Folders/Schedules/Triggers/Workflows-folder)는 5줄 호출로 끝나고, 다건 케이스(Edges/Nodes/Workflows-canvas)는 저수준 프리미티브만 재사용해 자체 배치 로직을 얹을 수 있었다. `folders.service.ts`는 이 리팩터로 기존에 거의 동일하게 중복돼 있던 두 블록(생성 시 부모 검사, `validateParentChange` 내부 검사)을 `assertParentInWorkspace` 하나로 합쳤다 — 이번 변경이 오히려 기존 중복을 줄인 지점도 있다. 제네릭 시그니처(`<T extends ObjectLiteral>`)와 `never` 반환 타입(`throwInvalidReferences`)도 TS 관용구에 맞는 선택이다. 위 WARNING 은 이 좋은 설계를 배치 케이스까지 완전히 밀지 못한 것에 대한 지적이라, 참고용으로 함께 기재.

- **[INFO]** 다수 모듈이 소유 모듈의 서비스가 아니라 `Repository<Workflow>`/`Repository<Node>`/`Repository<Folder>`를 직접 주입받아 조회 — 기존 컨벤션의 연장
  - 위치: `codebase/backend/src/modules/edges/edges.module.ts:10`(`Node` forFeature 추가), `codebase/backend/src/modules/workflows/workflows.module.ts:23`(`Folder` forFeature 추가), `codebase/backend/src/modules/triggers/triggers.module.ts:30`(`Workflow` forFeature 추가)
  - 상세: Edges/Nodes/Alerts/Schedules/Triggers/Workflows 서비스가 각각 다른 모듈의 엔티티(`Workflow`, `Node`, `Folder`)를 `@InjectRepository`로 직접 받아 raw 쿼리를 날린다 — `WorkflowsService`/`FoldersService`의 공개 API를 거치지 않는 형태다. 다만 이는 이 PR 이전부터 존재하던 컨벤션(`workflow-ownership.util.ts`의 `assertWorkflowInWorkspace`)의 연장이고, `workflows.module.ts`의 기존 주석("Integration 은 repository 만 주입해 모듈 순환을 피한다")이 이 선택을 팀이 의식적으로 채택했음을 보여준다. 실제로 순환 의존 검사 결과 모듈 레벨 import cycle 은 없음을 확인했다(`FoldersModule`은 `Workflow`를 참조하지 않고, `WorkflowsModule`은 `Folder` 엔티티만 참조하며 `FoldersModule`을 import 하지 않는다). 새로운 문제는 아니라 정보성으로만 기재.

## 요약

이번 PR 은 "요청 본문의 참조 id 가 다른 워크스페이스/워크플로를 가리켜도 그대로 저장되던" 한 클래스의 결함을 8개 서비스에 걸쳐 일관되게 막았고, 그 과정에서 공용 유틸(`reference-in-scope.ts`)을 신설해 단건 검사(Alerts/Folders/Schedules/Triggers/Workflows-folder)의 중복을 실질적으로 줄였다. 모듈 순환 의존은 없고, 레이어 책임(Controller→Service→Repository)도 기존 패턴을 벗어나지 않는다. 다만 배치 검사(엣지 끝점, 노드 배치, 캔버스 노드/엣지 참조, 신규 노드 id 유일성)는 같은 골격이 세 파일에 손으로 반복돼 있어 — 그중 하나는 코드 주석으로 스스로 중복을 인정하고 있음 — 이 PR 이 만든 추상화가 배치 케이스까지 완전히 커버하지 못했다는 아쉬움이 있다. 기능적 결함은 아니며 시급하지 않지만, 다음에 유사 검증이 하나 더 늘 때 같은 divergence 가 재발할 여지가 있어 백로그성 개선으로 남길 만하다. 구조적 강제 장치(데코레이터/가드/DB 제약) 부재는 팀이 이미 후속 과제로 추적 중인 사항이라 낮은 우선순위의 정보성 지적으로만 남긴다.

## 위험도

LOW
