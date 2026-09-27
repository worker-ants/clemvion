# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. Warning 3건은 전부 기능 결함이 아니라 중복 코드/성능 최적화 여지/회귀 테스트 공백이며, forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과가 확보되어 있어 "결과 미확보로 인한 거짓 clean" 위험은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `saveCanvas` 가 버전 복원(`skipLegacyDataGates=true`) 경로에서도 `validateCanvasReferences`(캔버스 참조 검사)를 건너뛰지 않는다는 의도적 설계 결정(주석에 명시)을 고정하는 회귀 테스트가 없음. 누군가 다른 legacy gate 와 "통일"하려고 실수로 스킵 조건 안으로 옮겨도 어떤 테스트도 잡지 못해, 이 PR 이 막은 교차 워크스페이스 노드 탈취가 버전 복원 우회로로 되살아날 수 있음 | `codebase/backend/src/modules/workflows/workflows.service.ts:693-697`(호출부), `:1111`(`validateCanvasReferences`) | `saveCanvas(..., skipLegacyDataGates=true)` 를 페이로드 밖 `containerId`/엣지 끝점과 함께 호출해 400 이 나는지 확인하는 단위 테스트 추가. `validateManualTrigger`/`validateReservedVariableNames` 는 같은 조건에서 스킵됨을 대조 |
| 2 | Architecture / Maintainability | "배치(batch) 참조 소속 검사 → invalid 배열 생성 → throw" 패턴이 edges/nodes/workflows 세 서비스에서 서로 다른 모양(하드코딩 2필드 vs 일반화 N필드 vs in-memory Set)으로 최소 4곳에 반복 구현됨. 이 PR 이 단일 참조 검사(`assertReferenceInScope`)는 공용화했지만 배치 케이스는 공용화하지 못함. `nodes.service.ts` 주석이 스스로 이 중복을 인지하고 있음(추출은 안 함) | `codebase/backend/src/modules/edges/edges.service.ts:72-95`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts:97-130`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/workflows/workflows.service.ts:1111-1143`(`validateCanvasReferences`), `:1210-1233`(`assertNewNodeIdsUnused`) | `reference-in-scope.ts` 에 "여러 `{field, id, message}` 후보를 한 번의 존재 조회(또는 Set)로 걸러 invalid 목록을 만드는" 배치 버전 헬퍼를 추가해 세 구현을 재구성. 급하지 않은 백로그성 개선 |
| 3 | Performance | `FoldersService.create()` 에 새로 추가된 부모 소속 `exists()` 검사가, 바로 이어지는 `getDepth()` 의 첫 조회(`findOne({ id: parentId, workspaceId })`)와 완전히 같은 조건을 다시 쿼리 — 폴더 생성 요청마다 회피 가능한 중복 왕복 1회 발생(이번 PR 이 순수 추가한 것). `update()` 의 `validateParentChange()` 도 같은 모양이지만 이건 PR 이전부터 있던 기존 패턴의 연장 | `codebase/backend/src/modules/folders/folders.service.ts:48-49`(호출부), `:150-160`(`assertParentInWorkspace`), `:88-109`(`getDepth`) | `getDepth`(또는 헬퍼)가 첫 조회 결과를 소속 확인으로 재사용하거나, `assertParentInWorkspace` 가 조회한 엔티티를 전달해 재조회 생략 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Database / API Contract | 신설 참조-소속 검증이 check-then-act(TOCTOU) 패턴 — 검사와 저장 사이 대상 행이 삭제되면 이론상 우회 가능하나, 모든 대상 컬럼에 FK 제약(CASCADE/SET NULL)이 최종 방어선 역할. 기존 `assertWorkflowInWorkspace` 등과 동형인 기존 컨벤션, 신규 결함 아님 | `codebase/backend/src/common/utils/reference-in-scope.ts:43`, edges/nodes/folders/alerts/schedules/triggers 호출부 전반 | 조치 불요(기존 컨벤션 추종). 우려 시 트랜잭션 스코프 repository 로 같은 스냅샷에서 검사하는 방식 고려 가능 |
| 2 | Database / Architecture | 이번 저장-전 검증은 신규 쓰기만 막고, 이미 DB 에 존재하는 교차 워크스페이스 참조 행(트리거/스케줄 `workflow_id`, 노드 `container_id`/`tool_owner_id` 등)은 소급 정리되지 않음 | 전 검증 유틸 공통 | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속" 항목에 감사 쿼리+실행 시점 방어선 검토가 이미 후속 과제로 등재됨 |
| 3 | Security | 트리거 `config` JSONB 안의 비밀 참조(`botTokenRef`·`inboundSigningRef`·`notification.signing.secretRef`)는 이번 소속 검증 범위 밖 — 자기 트리거 `config` 에 다른 트리거의 시크릿 참조를 넣어 해석/rotate 로 덮어쓸 수 있는지는 이번 diff 로 닫히지 않음 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`(이번 diff 밖) | 조치 불요 — 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재된 기지 갭 |
| 4 | Security | `assertNewNodeIdsUnused` 의 "신규 노드 id 중복" 조회가 워크스페이스로 스코프되지 않아, 임의 UUID 가 다른 워크스페이스 어딘가에 존재하는지 여부를 구분할 수 있는 부울 오라클이 구조적으로 남음(UUID 128비트라 실질 악용 가치는 낮음, 검사 자체를 없애면 원 결함 재발) | `codebase/backend/src/modules/workflows/workflows.service.ts` `assertNewNodeIdsUnused` | 현 설계 유지 권장, 추가 조치 불요 |
| 5 | Performance / Maintainability | `KnowledgeBaseService.assertModelConfigRefsInWorkspace` 가 독립적인 참조 3건(`extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`)을 순차 `await` — `Promise.all` 이면 최악 latency 1/3. 이전 라운드(`21_43_01` INFO 9)에서 이미 낮은 우선순위로 처분됨 | `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235` | 낮은 우선순위 — 재작업 강제 아님 |
| 6 | Architecture | 워크스페이스/워크플로 소속 검증이 구조적 강제(데코레이터/가드/DB 제약)가 아니라 호출부마다의 "기억"에 의존 — 다음에 새 cross-referencing 필드가 추가될 때 검사 누락이 재발할 수 있음 | alerts/folders/schedules/triggers/workflows 등 8개 이상 호출부 | 급하지 않음 — 팀이 이미 후속 과제로 인지 중. 신규 참조 필드 추가 시 코드리뷰 체크리스트에 명시 권장 |
| 7 | Maintainability | 동일 리터럴 메시지 `'Workflow not found in this workspace'` 3개 파일에 중복(매직 스트링). 옵셔널 참조 id 존재 판단 관용구(truthy vs `!= null`)가 파일마다 다름 | `alerts.service.ts:36`, `schedules.service.ts:192`, `triggers.service.ts:491` 등 | 공용 상수로 추출, `assert*InWorkspace`/`assert*InWorkflow` 계열만이라도 `!= null` 로 통일 |
| 8 | Maintainability | 테스트 provider stub 4줄 블록(`getRepositoryToken(Workflow)` 등)이 `triggers.service.spec.ts` 8곳 + `triggers.web-chat.spec.ts` 1곳, 총 9곳에 복사됨(기존 파일 구조가 원인, 이 PR 이 만든 문제는 아님) | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 다수 라인 | 백로그 — 다음 provider 추가 시 `createBaseProviders()` 로 점진적 통합 검토 |
| 9 | Testing | 세부 테스트 갭 3건: (a) `NodesService.assertPlacementInWorkflow` 의 "한쪽 필드만 무효" 혼합 케이스 부재(같은 형태의 `EdgesService` 에는 있음), (b) `WorkflowsService.update` 의 `folderId` 미제공 시 조회 스킵을 명시 검증하는 테스트 부재(`create` 에는 있음), (c) `EdgesService` 단위 테스트가 TypeORM `In()` 의 내부 표현(`FindOperator.value`)에 의존 | `nodes.service.spec.ts`, `workflows.service.spec.ts:368`, `edges.service.spec.ts:44-51` | 보강 테스트 각 1건 추가 권장(낮은 우선순위) |
| 10 | API Contract | 저장 전 소속 위반 거부가 표면별로 메시지 문구("in this canvas" vs "in this workflow")와 응답 형태(다중 위반 배열 400 vs 첫 위반에서 멈추는 404 단건)가 갈림 — 의미상 차이가 실재하고 spec §1.1 이 모델 설정 참조를 예외로 이미 승인 | `workflows.service.ts`(`validateCanvasReferences`) vs `nodes.service.ts`/`edges.service.ts` vs `knowledge-base.service.ts` | 차단 사유 아님. 필요 시 공용 메시지 팩토리로 후속 정리 |
| 11 | Documentation | 트리거/스케줄/알림 규칙/지식 베이스 API 문서의 필드 표에는 아직 "다른 워크스페이스면 400/404" 문구 미반영 | `spec/2-navigation/2-trigger-list.md` §2.3, `3-schedule.md`, `9-user-profile.md`, `5-knowledge-base.md` | 조치 불요 — 트래커에 "구현 착지 후 반영" 근거와 함께 의도적으로 등재됨, 1R 에서도 동일 처분 |

### 확인 완료 항목 (문제 없음)

- DI 배선: 다수 서비스 생성자 시그니처 변경(신규 repository 주입)이 전량 Nest DI 로만 소비되고, 직접 `new` 하는 3곳(spec)도 인자 갱신 확인됨. `triggers.module.ts` 의 `Workflow` 엔티티 추가는 기존 순환 회피 관례(엔티티만 import)를 따라 순환 재도입 아님.
- 신규 사전검증 호출(`findEntity`/`resolveConfig`)은 전부 DB 조회이며 신규 외부 네트워크 호출 없음. 모든 신규 검사가 영속 부작용(저장·큐 등록·secret 이관)보다 먼저 실행되어 부분 쓰기 위험 없음.
- 신규 쿼리는 전부 기존 인덱스(`idx_node_workflow`, `idx_edge_workflow`, `idx_folder_workspace_parent`) 또는 PK 조회로 커버되어 마이그레이션 불요, N+1 없음.
- 1R Warning 3건(alerts 단위 테스트 부재, nodes/edges 검사 전략 불일치, e2e 헤더 인용 오류)은 `698ad8ab7` 로 조치 완료가 diff 로 확인됨(재지적 아님).
- 신규 유틸/서비스의 JSDoc·인라인 주석(FK CASCADE, `findEntity` kind, spec §1.2 인용)이 실제 엔티티·구현과 대조해 정확함. CHANGELOG 항목도 기준·내용·형식 부합.
- 응답 봉투(`GlobalExceptionFilter`), 에러 코드(`INVALID_FIELD`/`MODEL_CONFIG_NOT_FOUND`) 재사용, 필수/옵셔널·불변 필드 처리, 하위 호환성(의도된 breaking change, CHANGELOG 명시) 모두 spec/기존 컨벤션과 일치.
- 폴더 `parentId` 거부 응답에 `details` 배열 신규 추가는 CHANGELOG 에 문서화된 additive 확장으로 하위 호환 위험 낮음.
- 코드 스코프(`git diff --stat`) 전수 확인 결과 25개 파일이 전부 "쓰기 요청의 교차 워크스페이스/교차 워크플로 참조 거부" 한 가지 목적에 수렴, 무관한 리팩토링·설정 변경 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 잔여 오라클 2건·기존 TOCTOU — 전부 수용 가능한 트레이드오프, 신규 결함 없음 |
| performance | LOW | FoldersService.create() 중복 쿼리(WARNING), KB 순차 await(INFO, 기처분) |
| architecture | LOW | 배치 참조 검사 3~4곳 중복(WARNING), 구조적 강제 장치 부재(INFO) |
| requirement | NONE | spec §1.1 9개 필드 전수 line-level 대조, 결함 없음 |
| scope | NONE | 25개 파일 전부 단일 목적 수렴, 스코프 이탈 없음 |
| side_effect | NONE | DI/모듈 배선·외부 호출·부작용 순서 전부 확인 완료, 문제 없음 |
| maintainability | LOW | 배치 검사 중복(WARNING, architecture 와 동일 이슈), 매직 스트링·테스트 stub 복사(INFO) |
| testing | LOW | saveCanvas 버전 복원 회귀 테스트 부재(WARNING), 세부 테스트 갭 3건(INFO) |
| documentation | NONE | 1R W1 정정 확인, API 문서 미러링 지연은 기 처분 유지 |
| database | LOW | TOCTOU·소급 미정리(INFO, 기존/기지), 인덱스·마이그레이션 이상 없음 |
| api_contract | LOW | 메시지/응답 형태 표면별 상이(INFO, 의도됨), 1R Warning 3건 조치 확인 |

## 발견 없는 에이전트

- requirement — "없음, Critical·Warning 급 발견사항 없음"으로 명시 응답

## 권장 조치사항

1. `saveCanvas` 버전 복원 경로에서 캔버스 참조 검사가 스킵되지 않음을 고정하는 회귀 테스트 추가 (WARNING 1 — 보안·데이터 무결성 설계 결정을 리팩토링 실수로부터 보호)
2. 배치 참조 소속 검사(edges/nodes/workflows 3~4곳)를 공용 헬퍼로 통합 검토 (WARNING 2 — 중복 축소, 다음 필드 추가 시 divergence 재발 방지)
3. `FoldersService.create()` 의 부모 소속 `exists()` 중복 쿼리를 `getDepth()` 첫 조회와 통합 (WARNING 3 — 회피 가능한 왕복 제거)
4. (낮은 우선순위) 매직 스트링 상수화, null-체크 관용구 통일, 테스트 provider stub 헬퍼 통합, NodesService/WorkflowsService.update 세부 테스트 3건 보강

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced 전원 결과 확보됨 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(프롬프트에 세부 사유 미제공) |
  | concurrency | router 판단(프롬프트에 세부 사유 미제공) — 단, database/security 리뷰가 TOCTOU 관점을 부분적으로 다룸 |
  | user_guide_sync | router 판단(프롬프트에 세부 사유 미제공) |