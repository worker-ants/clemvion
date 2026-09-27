# 요구사항(Requirement) 리뷰 — cross-workspace-refs

## 검증 방법

`spec/1-data-model.md` §1.1(참조의 소속)을 SoT 로 삼아, 표에 열거된 9개 참조 필드(트리거·스케줄·알림 규칙 `workflowId`, 워크플로·폴더
`folderId`/`parentId`, 어시스턴트 세션 `llmConfigId`, KB 4필드, 노드 `containerId`/`toolOwnerId`, 엣지 끝점, 캔버스 저장의 노드간 참조 ·
신규 노드 id)를 코드 구현과 line-level 로 대조했다. 프롬프트에 diff 가 생략된 파일(`folders.service.spec.ts` · `nodes.service.spec.ts` ·
`workflows.service.spec.ts` · `triggers.service.spec.ts` · `workflows.service.ts` · e2e spec)은 저장소에서 직접 `git diff`/`Read` 로
전문을 확인했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 확인 — 이 세션 산출 디렉터리 외 변경 없음).

## 발견사항

없음 — Critical·Warning 급 발견사항 없음.

### 대조 결과 (참고용, 비차단)

- **워크스페이스 스코프 참조** — `alerts.service.ts`(`workflowId`, create-only, `UpdateAlertRuleDto` 에 필드 자체가 없어 update 는 애초에
  변경 불가) · `schedules.service.ts`(`workflowId`) · `triggers.service.ts`(`workflowId`, `UpdateTriggerDto` 에도 필드 없음) ·
  `workflows.service.ts`(`folderId`, create·update 양쪽) · `folders.service.ts`(`parentId`, create·update 양쪽, root 이동 시 건너뜀은
  스펙상 자연스러움) — 전부 `assertReferenceInScope` 로 400 `VALIDATION_ERROR` + `details:[{field, message, code:'INVALID_FIELD'}]`,
  spec §1.1 표·에러 응답 문단과 정확히 일치.
- **워크플로 스코프 참조** — `nodes.service.ts`(`containerId`/`toolOwnerId`, create·update) · `edges.service.ts`(`sourceNodeId`/`targetNodeId`,
  create) 가 `In()` 단일 조회로 소속 검사, 틀린 필드를 전부 싣는 것도 spec 문단("캔버스 저장 · 엣지 생성은 틀린 필드를 전부 싣고")과 일치.
- **캔버스 저장** — `workflows.service.ts` `validateCanvasReferences`(페이로드 내부 참조, 트랜잭션 진입 전 동기 검사, 버전 복원
  `skipLegacyDataGates` 에서도 건너뛰지 않음) + `assertNewNodeIdsUnused`(신규 노드 id 의 전역 유일성, 트랜잭션 내부 `manager.find`) —
  spec 표의 두 행("이번 페이로드의 노드" / "어느 행도 쓰지 않는 id")과 각각 대응. 빈 `fresh` 배열일 때 `In([])` 조회를 건너뛰는 가드도 있음.
- **모델 설정 참조(예외 케이스)** — `workflow-assistant-session.service.ts`(`llmConfigId` → kind `chat`) · `knowledge-base.service.ts`
  (`extractionLlmConfigId`→`chat`, `rerankConfigId`→`rerank`, `rerankLlmConfigId`→`chat`)가 각 필드를 **소비하는 쪽**(`LlmService.resolveConfig`
  의 kind 고정 · `RerankService`의 `rerankConfigId`→`'rerank'`/`rerankLlmConfigId`→`resolveConfig`(`chat`))과 정확히 같은 kind 로
  `findEntity`/`resolveConfig` 를 호출해 404 `MODEL_CONFIG_NOT_FOUND` — spec 이 명시한 "예외 둘" 중 하나(집계 없이 필드마다 순차 실패)와
  일치하며 회귀 아님.
- **null/undefined 처리** — 모든 신설 검사가 `null`(명시적 해제)과 `undefined`(미전송)을 검사 생략으로 처리하고, 이는 각 서비스의
  `omitUndefined`/조건부 대입 로직과 합치한다(예: `WorkflowAssistantSessionService.assertLlmConfigInWorkspace` 의 `null` 통과가
  update 의 "고정 해제" 의미와 일치).
- **DI 배선** — `edges.module.ts`/`workflows.module.ts`/`triggers.module.ts` 에 새로 주입되는 `Node`/`Folder`/`Workflow` 리포지토리가
  전부 `TypeOrmModule.forFeature` 에 등록됐고(`alerts`/`schedules`/`workflow-assistant` 모듈은 `Workflow` 가 이미 기존 목적으로 등록돼
  있어 추가 배선 불요), 관련 스펙 파일의 `new XxxService(...)` 직접 생성 호출부(`edges.service.spec.ts` 등)도 생성자 인자 수가 갱신돼
  있어 컴파일·부트스트랩 불일치 없음(e2e 477/477 통과와 부합).
- **e2e 커버리지** — `cross-workspace-references.e2e-spec.ts` 가 표의 9개 필드 중 KB 3필드를 제외한 전부를 실제 HTTP 요청으로
  검증하고, KB 3필드는 무거운 픽스처를 이유로 단위 테스트로만 커버한다는 점을 파일 헤더 주석에 명시 — 근거가 적절하고 실제로
  `knowledge-base.service.spec.ts` 에 대응 단위 테스트가 존재.
- TODO/FIXME/HACK/XXX 신규 도입 없음.

## 요약

`spec/1-data-model.md` §1.1 의 참조-소속 표에 열거된 모든 필드(워크스페이스 스코프 6종 + 워크플로 스코프 3종 + 모델 설정 예외 4종)가
빠짐없이 구현됐고, 에러 코드(400 `VALIDATION_ERROR`/`details[].code='INVALID_FIELD'`, 모델 설정만 404 `MODEL_CONFIG_NOT_FOUND`)·필드
표기(`nodes[i].id` 등 중첩 경로)·null/undefined 처리(해제 vs 미전송)·생성 전용 vs 생성+수정 구분이 spec 본문과 line-level 로 일치한다.
직전 리뷰 라운드(`21_43_01`)의 W1~W3(단위 테스트 누락 2건, 노드 검사 전략 불일치)도 전용 단위 테스트 신설과 `In()` 일괄 조회 통일로
반영이 확인됐다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 등 전 관점에서 결함을 발견하지 못했다.

## 위험도

NONE
