# 부작용(Side Effect) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 6개 서비스 생성자에 새 필수 파라미터(레포지토리/서비스)가 추가됐다 — DI 전용 경로로만 조립되는지 확인함
  - 위치:
    - `codebase/backend/src/modules/alerts/alerts.service.ts:14`(`workflowRepository: Repository<Workflow>` 추가) + `codebase/backend/src/modules/alerts/alerts.module.ts`(`Workflow` 는 기존에 이미 `forFeature` 등재돼 있어 모듈 diff 없음)
    - `codebase/backend/src/modules/edges/edges.service.ts:25-26`(`nodeRepository: Repository<Node>` 추가) + `codebase/backend/src/modules/edges/edges.module.ts:5,10`(`Node` 신규 `forFeature` 등재)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:46-47`(`workflowRepository` 추가, 모듈은 기존에 이미 `Workflow` 등재)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:267-268`(`workflowRepository` 추가) + `codebase/backend/src/modules/triggers/triggers.module.ts:10,30-36`(`Workflow` 신규 `forFeature` 등재)
    - `codebase/backend/src/modules/workflows/workflows.service.ts` `constructor`(`folderRepository: Repository<Folder>` 추가, 함수명 인용 — 이 파일은 프롬프트에서 diff 가 생략돼 게이트 번호 없음) + `codebase/backend/src/modules/workflows/workflows.module.ts:9,23-30`(`Folder` 신규 `forFeature` 등재)
    - `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:33`(`llmService: LlmService` 추가, 모듈은 기존에 `LlmModule` import)
  - 상세: 생성자 시그니처 변경은 원칙적으로 호출자 영향(관점 4)이 크지만, 이 서비스들은 전부 `@Injectable()` + `@InjectRepository`/모듈 DI 로만 조립된다. `grep -rn "new AlertsService(\|new EdgesService(\|new SchedulesService(\|new TriggersService(\|new WorkflowsService(\|new WorkflowAssistantSessionService(" codebase/backend/src codebase/backend/test` 로 spec 파일 밖의 수동 인스턴스화를 찾았으나 0건이었다. 각 서비스의 `*.spec.ts` 는 이번 PR 에서 새 mock 레포지토리/서비스를 provider 목록에 함께 추가했고(예: `alerts.service.spec.ts` `workflowRepo`, `schedules.service.spec.ts` `getRepositoryToken(Workflow)`), 대상 모듈(`*.module.ts`)의 `TypeOrmModule.forFeature`/`imports` 도 필요한 곳(edges·triggers·workflows)에서만 함께 갱신됐다 — `alerts.module.ts`/`schedules.module.ts` 는 `Workflow` 가 이미 다른 목적(평가기·알림 owner 조회)으로 등재돼 있어 모듈 변경이 필요 없었던 것도 확인했다. RESOLUTION.md(`review/code/2026/09/27/22_11_22/RESOLUTION.md`)의 unit 10447 PASS·e2e 477/477 PASS 도 이 배선이 실제로 부트스트랩됨을 뒷받침한다.
  - 제안: 조치 불요. 향후 이 서비스들을 테스트 밖에서 수동 생성하는 코드가 추가되면 이 시그니처 변경이 컴파일 에러로 드러나므로 위험은 낮다.

- **[INFO]** 쓰기 경로(생성·수정·캔버스 저장) 전반에 저장 전 DB 조회가 새로 추가되어, 이 경로들의 쿼리 횟수 부작용이 늘었다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37-45`(`assertReferenceInScope` — `repo.exists`), `codebase/backend/src/modules/edges/edges.service.ts:68-95`(`assertEndpointsInWorkflow` — `nodeRepository.find`), `codebase/backend/src/modules/nodes/nodes.service.ts:92-130`(`assertPlacementInWorkflow` — `nodeRepository.find`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:200-235`(`assertModelConfigRefsInWorkspace` — 최대 3회 순차 `findEntity`), `codebase/backend/src/modules/workflows/workflows.service.ts`(`assertNewNodeIdsUnused` — `manager.find(Node, …)`, 함수명 인용)
  - 상세: 모두 저장 전에 실행되는 순수 조회(READ)이고 부작용은 "쿼리 1회 이상 추가"뿐이다. 상태 변경·재시도·재진입성 문제는 없다(각 헬퍼는 idempotent 한 `exists`/`find` 만 수행). `assertReferenceInScope` 의 JSDoc 이 명시하듯 `where` 에 소속 조건을 빠뜨리면 검사가 존재-확인으로 줄어드는 설계상 함정이 있으나, 이는 이전 라운드(`review/code/2026/09/27/21_43_01` INFO 5)에서 이미 지적·수용(단위 테스트 + 뮤턴트 M2·M5 로 대체 방어)된 항목이라 재-flag 하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `assertReferenceInScope`/`throwInvalidReferences` 계열 검증기는 이전에는 성공하던(버그였던) 요청을 이제 400/404 로 거부한다 — 의도된 공개 API 동작 변경
  - 위치: `CHANGELOG.md:26-42`(Unreleased 항목 전문), 실제 반영은 `codebase/backend/src/modules/triggers/triggers.service.ts:486-492`, `codebase/backend/src/modules/schedules/schedules.service.ts:186-193`, `codebase/backend/src/modules/alerts/alerts.service.ts:30-38`, `codebase/backend/src/modules/workflows/workflows.service.ts`(`assertFolderInWorkspace`, `validateCanvasReferences`, `assertNewNodeIdsUnused`), `codebase/backend/src/modules/folders/folders.service.ts:149-160`, `codebase/backend/src/modules/nodes/nodes.service.ts:92-130`, `codebase/backend/src/modules/edges/edges.service.ts:68-95`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:200-235`, `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:199-210`
  - 상세: 관점 5(인터페이스 변경)에 해당하는 의도적 변경이다. 다른 워크스페이스/워크플로의 id 를 참조로 보내던 기존 호출자(정상 클라이언트든 악용 시도든)는 이제 201/200 대신 400 `VALIDATION_ERROR`(모델 설정은 404 `MODEL_CONFIG_NOT_FOUND`)를 받는다. `CHANGELOG.md` 에 표면별로 상세히 기록돼 있고 `codebase/backend/test/cross-workspace-references.e2e-spec.ts` 가 18개 케이스로 신·구 동작을 모두 고정해 의도치 않은 회귀가 아님을 뒷받침한다. 사이드이펙트 관점에서 남기는 이유는, 이 변경이 "부작용"이라기보다 "고쳐진 결함"이지만 혹시 이 버그에 (의도치 않게) 의존하던 내부 자동화·마이그레이션 스크립트가 있다면 이번 배포로 400 을 받기 시작할 수 있다는 점을 배포 체크리스트에 남겨 둘 가치가 있다는 것이다.
  - 제안: 조치 불요(코드 결함 아님). 배포 노트에 이미 반영돼 있음을 확인.

- **[INFO]** `assertModelConfigRefsInWorkspace`/`assertLlmConfigInWorkspace` 가 재사용하는 `findEntity`/`resolveConfig` 는 DB 조회일 뿐 외부 네트워크 호출이 아님을 소스로 확인
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:401-411`(`resolveConfig` → `modelConfigService.findEntity`), `codebase/backend/src/modules/model-config/model-config.service.ts:131-146`(`findEntity` → `this.repo.findOne`)
  - 상세: 관점 7(네트워크 호출) 점검 결과 새로 추가된 검증 경로 어디에도 LLM 프로바이더·외부 API 호출이 없다. 전부 TypeORM 조회로 끝난다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 트랜잭션 경계 밖에서 검증(check)과 저장(act)이 분리돼 있는 check-then-act 구조는 신규가 아니라 기존 `assertWorkflowInWorkspace`/`assertAuthConfigInWorkspace` 와 동형이며, 캔버스 저장 경로(`validateCanvasReferences`, `assertNewNodeIdsUnused`)만 같은 `dataSource.transaction`/`manager` 스코프 안에서 일관되게 검사한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`(`saveCanvas`/`syncNodes`/`assertNewNodeIdsUnused`, 함수명 인용) vs. `codebase/backend/src/modules/alerts/alerts.service.ts:30-38`, `codebase/backend/src/modules/schedules/schedules.service.ts:186-193` 등 단건 검증-후-INSERT 경로
  - 상세: 동시성/DB 무결성 관점의 TOCTOU 세부 평가는 concurrency·database 리뷰 담당 영역이라 여기서는 "새로운 종류의 부작용은 아니다"만 확인한다. FK 제약이 최종 방어선 역할을 하므로 최악의 경우도 조용한 데이터 오염이 아니라 저장 실패(500) 또는 참조 무효화로 그친다(직전 라운드 `review/code/2026/09/27/22_11_22/database.md` 와 동일 결론).
  - 제안: 조치 불요.

## 요약

이번 PR 은 트리거·스케줄·알림 규칙·워크플로·폴더·노드·엣지·지식베이스·어시스턴트 세션의 쓰기 경로에 "참조 id 가 요청자 워크스페이스(또는 같은 워크플로) 범위 안에 있는지"를 저장 전에 검증하는 공용 유틸(`assertReferenceInScope`/`throwInvalidReferences`)을 신설해 배선한 변경이다. 전역 변수·파일시스템·환경변수·네트워크 호출·이벤트/콜백 어디에서도 의도치 않은 부작용은 발견되지 않았다. 6개 서비스(`AlertsService`·`EdgesService`·`SchedulesService`·`TriggersService`·`WorkflowsService`·`WorkflowAssistantSessionService`)의 생성자 시그니처가 바뀌었지만 전부 NestJS DI 로만 조립되고(수동 `new` 호출 0건 확인), 필요한 모듈의 `TypeOrmModule.forFeature`/`imports` 도 정확히 갱신됐다(단위 10447 · e2e 477/477 PASS 가 배선을 뒷받침). 유일한 실질적 "동작 변경"은 공개 API 인터페이스 관점 — 종전에 성공하던 교차 워크스페이스/교차 워크플로 참조 요청이 이제 400/404 를 반환하는 것 — 인데, 이는 이 PR 의 목적 자체(보안 결함 수정)이며 `CHANGELOG.md` 와 신규 e2e(`cross-workspace-references.e2e-spec.ts`)에 명시적으로 기록·고정돼 있어 은닉된 부작용이 아니다. 새로 추가된 검증은 전부 저장/트랜잭션 이전에 실행되도록 배치돼 부분 쓰기(partial mutation) 뒤에 실패하는 경로가 없음을 각 서비스(`AlertsService.create`·`EdgesService.create`·`NodesService.create/update`·`FoldersService.create/moveOrRename`·`SchedulesService.create`·`TriggersService.create`·`WorkflowsService.create/update/saveCanvas`)에서 직접 확인했다.

## 위험도
LOW
