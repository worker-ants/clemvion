# Code Review 통합 보고서

## 전체 위험도
**LOW** — 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로)를 가리키면 저장 전에 거부하는 IDOR/무결성 방어 로직을 10여 개 서비스에 일관되게 배선한 PR. 12개 reviewer(강제 7명 포함) 전원 결과 확보됨 — forced 미이행 항목 없음. CRITICAL 없음, WARNING 3건은 모두 비차단(테스트 커버리지 갭 1건, 스타일 중복 1건, 죽은 문서 링크 1건)이며 병합을 막을 사유는 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `AlertsService.create` 의 신규 소속 검사(`assertReferenceInScope`)에 unit 테스트가 전혀 없다 — `alerts.service.spec.ts` 자체가 존재하지 않음. 이 PR 이 같은 헬퍼를 붙인 다른 7개 자리(트리거·스케줄·폴더·워크플로 folderId)는 전부 대응 unit 테스트가 있는데 alerts 만 짝이 없고, 개발자 자신의 뮤턴트 실측(M1 KILLED 8곳) 목록에도 alerts 는 빠져 있다. 현재는 e2e 가 유일한 방어선 | `codebase/backend/src/modules/alerts/alerts.service.ts` (`create`), `alerts.service.spec.ts` 부재 | `alerts.service.spec.ts` 신설 — (1) 다른 워크스페이스 `workflowId` → 400 + `details:[{field:'workflowId',code:'INVALID_FIELD'}]` + `save` 미호출, (2) `workflowId` 미지정 시 검사 미호출 |
| 2 | architecture, maintainability | "워크플로 범위 내 여러 참조가 유효한지" 배치 검증 로직이 같은 PR 안에서 두 가지 다른 쿼리 전략으로 중복 구현됨 — `nodes.service.ts`(`containerId`/`toolOwnerId`)는 순차 `await exists()` 루프(최대 2회 왕복), `edges.service.ts`(`sourceNodeId`/`targetNodeId`)는 `In([...])` 배치 `find` 1회. `reference-in-scope.ts` 가 단일 참조 케이스는 공유 헬퍼로 뽑았지만 "복수 참조 배치 검사"는 공유되지 않아 다음 유사 사례가 세 번째 전략을 고를 위험 | `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`) | `reference-in-scope.ts` 에 `assertReferencesInScope(repo, refs[])` 류 배치 버전을 추가해 두 서비스가 공유하게 하거나 최소 `In()` 배치 조회로 통일 |
| 3 | documentation | 신규 e2e 스펙 파일 헤더 주석이 존재하지 않는 plan 경로(`plan/complete/cross-workspace-refs.md`)를 인용 — 같은 worktree 의 consistency-check 가 이미 **정확히 같은 오기 패턴**을 spec 문서에서 Critical 로 잡아 `18f235a81` 로 고쳤으나, 그 수정 스윕 대상에 이 신규 소스 파일은 포함되지 않아 같은 결함이 다른 자리에서 재발. (scope 리뷰어도 동일 사실을 INFO 로 독립 확인) | `codebase/backend/test/cross-workspace-references.e2e-spec.ts:14` | `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로 경로 정정. `codebase/**` 는 developer 쓰기 범위라 이번 PR 안에서 바로 고칠 수 있음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security, api_contract | 트리거 `config` JSONB 안의 비밀 참조(`botTokenRef`/`inboundSigningRef`/`secretRef`)는 이번 검증기(`assertReferenceInScope`)가 커버하지 않음 — 다른 트리거의 UUID 를 아는 사람이 비밀을 해석/rotate 로 덮어쓸 수 있는 여지. plan 트래커에 "후속" 으로 명시적 등재됨(재현 e2e 없음) | `triggers.service.ts` `config` 처리 경로, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 결함 자체를 이번 PR 로 확장할 필요는 없으나, 자격증명 탈취급 영향이라 다음 세션 우선순위 유지 권고 |
| 2 | security, api_contract, requirement | 이번 수정은 신규 쓰기만 막는다 — 배포 이전에 이미 저장됐을 수 있는 교차 워크스페이스 행(트리거/스케줄 등)에 대한 백필·실행 시점 방어선은 없음. 실행 엔진은 여전히 워크플로를 id 로만 읽음 | 트래킹: `plan/in-progress/spec-draft-nullable-notation-followups.md`, `spec/data-flow/12-workspace.md` Rationale | 배포 직후 `trigger.workspace_id <> workflow.workspace_id` 등 1회성 점검 쿼리 실행 권장 |
| 3 | security, side_effect, database | `WorkflowsService.assertNewNodeIdsUnused` 는 워크스페이스/워크플로 스코프 없이 전역 `Node` 테이블에서 id 충돌을 조회 — TypeORM `save` 가 id 로만 행을 찾아 UPDATE 하는 동작에 대응하기 위한 의도된 설계이며, `spec/data-flow/12-workspace.md` Rationale 이 "UUID v4 는 추측 불가" 근거로 명시적으로 수용 | `codebase/backend/src/modules/workflows/workflows.service.ts` `assertNewNodeIdsUnused` | 조치 불필요. 노드 id 생성 방식이 추측 가능한 값으로 바뀌면 그 시점에 재검토 |
| 4 | security, side_effect, concurrency, database, api_contract | 신설 검증 전반이 check-then-act(TOCTOU) — 검사와 실제 저장 사이에 참조 대상이 삭제되면 이론상 FK 위반(500) 가능. 다만 기존 `assertWorkflowInWorkspace` 등 코드베이스 기존 패턴과 동형이며, 이동/재소속 API 자체가 없어 실질 공격면 낮음. 이 PR 이 새로 도입한 취약점 아님 | `codebase/backend/src/common/utils/reference-in-scope.ts`, 각 서비스 호출부 | 조치 불필요. 향후 "다른 워크스페이스로 리소스 이전" 기능이 생기면 트랜잭션/락 재검토 |
| 5 | architecture | `assertReferenceInScope` 의 핵심 불변식("where 에 소속 조건 필수")이 타입 시스템이 아니라 JSDoc 산문으로만 강제됨 — 다음 참조 필드 추가 시 소속 조건을 빠뜨리면 조용히 "존재만 확인"으로 퇴화할 자리 | `codebase/backend/src/common/utils/reference-in-scope.ts:34` | 스코프 컬럼을 별도 필수 인자로 분리하거나 런타임 가드(`where` 키 2개 미만이면 throw) 고려 |
| 6 | side_effect | 폴더 재부모화(`PATCH /api/folders/:id`) 400 응답이 `details` 없는 형태에서 배열 포함 형태로 바뀜 — 의도된 확장, CHANGELOG 문서화됨, `code`/`message` 는 하위 호환 유지 | `codebase/backend/src/modules/folders/folders.service.ts` | 별도 조치 불필요. 프런트가 `details` 유무로 분기하는 자리가 있다면 한 번 확인 권장 |
| 7 | maintainability | 동일 에러 메시지 리터럴 `'Workflow not found in this workspace'` 가 3개 파일에 하드코딩 중복. `throwInvalidReferences` 빈 배열 가드(`if (invalid.length>0)`)가 4개 호출부에 반복. `knowledge-base.service.ts` 의 구조적으로 동일한 if-블록 3회 반복. `assert*`/`validate*` 네이밍 혼용(`validateCanvasReferences`) | `alerts.service.ts:36`, `schedules.service.ts:192`, `triggers.service.ts:491`, `knowledge-base.service.ts:206`, `workflows.service.ts:1111` | 공용 상수화, `throwInvalidReferences` 내부 빈 배열 가드, 배열 순회 리팩터, 네이밍 통일 — 모두 우선순위 낮음 |
| 8 | testing | `WorkflowAssistantSessionService.assertLlmConfigInWorkspace` 도 unit 테스트 파일 없음(e2e 만 방어). `NodesService.assertPlacementInWorkflow` 는 `containerId`·`toolOwnerId` 동시 invalid 케이스가 테스트되지 않아 자매 클래스(`EdgesService`) 대비 커버리지 약함 | `workflow-assistant-session.service.ts`, `nodes.service.spec.ts` | 최소 스모크 unit 추가 권장, 차단 사유 아님 |
| 9 | requirement | `knowledge-base.service.ts` 의 `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId` 는 값이 기존과 동일해도 매번 재검증(`embeddingModelConfigId` 는 변경 시에만 재조회하는 것과 비대칭) — 기능 결함 아님, PATCH 당 불필요한 DB 왕복 최대 2회 | `knowledge-base.service.ts` `assertModelConfigRefsInWorkspace`(206-235), `update()`(243) | 후속으로 `dto.xxx !== undefined && dto.xxx !== kb.xxx` 가드 통일 가능 |
| 10 | requirement, security | 엣지 UNIQUE 제약에 `workflow_id` 가 없어 남의 워크플로와 튜플이 우연히 겹치면 409 유발 가능 — plan/spec Rationale 에 이미 "재지 않았다"로 명시된 의도적 스코프 경계 | `spec/data-flow/12-workspace.md` Rationale | 조치 불필요, 트래커 등재 확인됨 |
| 11 | database, concurrency | `nodes.service.ts`(`containerId`/`toolOwnerId`), `knowledge-base.service.ts`(3개 모델 설정 필드) 의 독립 쿼리를 순차 `await` — 필드 수만큼 왕복 지연 누적(기능 문제 아님, N+1 아님) | `nodes.service.ts:106-110`, `knowledge-base.service.ts:214-234` | `Promise.all` 로 병렬화 고려, 필수 아님 |
| 12 | documentation | API 엔드포인트 문서(트리거/스케줄/알림규칙/KB)가 신규 400/404 교차 워크스페이스 거부를 아직 반영하지 않음 — "구현 착지 후에 넣는다"는 명시적 근거로 후속 트래커에 등재된 의도적 순서 지연 | `spec/2-navigation/{2-trigger-list,3-schedule,9-user-profile}.md`, `spec/2-navigation/5-knowledge-base.md` | 조치 불필요, 이번 PR 을 막을 사유 아님 |
| 13 | api_contract | 구조 참조 거부 메시지가 "in this canvas"(캔버스 저장 경로) vs "in this workflow"(단건 API 경로) 두 갈래로 갈림 — `code`/`field` 는 동일, `message` 만 다름. JSDoc 상 의도된 구분으로 읽힘 | `workflows.service.ts` `validateCanvasReferences` vs `nodes.service.ts`/`edges.service.ts` | 의도된 구분이면 현행 유지, 문구 통일 원하면 공용 템플릿화 |
| 14 | database | 스키마에 복합 FK/유니크로 이 불변식(같은 워크플로 소속)을 강제하지 않음 — 이번 검증은 애플리케이션 레이어 전용 방어선. 향후 이 경로를 우회하는 새 쓰기 경로(벌크 import, 관리자 스크립트 등)가 생기면 결함 재발 가능 | `codebase/backend/src/modules/nodes/entities/node.entity.ts` (기존 스키마) | 조치 불필요, spec Rationale/코드 주석에 이미 일부 반영됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 핵심 IDOR 패치는 견고. 잔여 표면(트리거 config JSONB 비밀 참조, 과거 데이터)은 트래커에 등재된 의도적 defer |
| architecture | LOW | SRP·계층분리 양호. 배치 검증 중복 구현(WARNING), 불변식이 문서로만 강제(INFO) |
| requirement | NONE | spec §1.1 표 9개 행 전부 line-level 일치 확인. e2e 18케이스 + 뮤턴트 5종 KILLED |
| scope | LOW | 93개 파일 전부 스코프 안. e2e 주석의 깨진 plan 경로 인용(documentation 의 WARNING 과 동일 사안, INFO 로 독립 확인) |
| side_effect | LOW | 전 검증이 상태변경 이전 배치 확인. 폴더 응답 형태 변경(의도됨), 기존 패턴과 동형인 TOCTOU |
| maintainability | LOW | 배치 검증 스타일 중복(WARNING, architecture 와 동일 사안). 메시지 중복·가드 반복 등 사소한 INFO 다수 |
| testing | LOW | e2e/뮤턴트 탄탄. AlertsService unit 테스트 부재(WARNING), WorkflowAssistantSessionService/NodesService 커버리지 약간 약함(INFO) |
| documentation | LOW | JSDoc·CHANGELOG 우수. e2e 파일의 깨진 plan 경로 재발(WARNING) |
| database | LOW | 인덱스/N+1 문제 없음. 순차 await 지연, TOCTOU, 복합 FK 부재는 전부 INFO |
| concurrency | LOW | 신규 락/병렬 로직 없음. TOCTOU 는 기존 컨벤션과 동형(INFO) |
| api_contract | LOW | 응답 봉투·에러코드 재사용 일관. 메시지 문구 두 갈래(INFO) |
| user_guide_sync | NONE | frontend/channel-web-chat 변경 0건, 매트릭스 20개 trigger 전수 점검 결과 매칭 없음 |

## 발견 없는 에이전트

user_guide_sync (매칭되는 doc-sync 트리거 없음, 발견사항 없음)

## 권장 조치사항

1. `alerts.service.spec.ts` 를 신설해 `AlertsService.create` 의 소속 검사(`workflowId` 다른 워크스페이스 → 400, 미지정 시 스킵)를 unit 레벨로 고정한다 — 이 PR 이 스스로 세운 "헬퍼마다 unit 짝 테스트" 기준의 유일한 예외를 없앤다.
2. `codebase/backend/test/cross-workspace-references.e2e-spec.ts:14` 의 `plan/complete/cross-workspace-refs.md` 인용을 `plan/in-progress/cross-workspace-refs.md` 로 정정한다 — 같은 세션이 이미 spec 문서에서 Critical 로 잡아 고친 것과 동일한 오기가 새 소스 파일에서 재발했다.
3. `nodes.service.ts`(순차 `exists()` 루프)와 `edges.service.ts`(`In()` 배치)의 "워크플로 범위 내 다중 참조 검증" 구현을 `reference-in-scope.ts` 의 공용 배치 헬퍼로 통일할지 검토한다(필수는 아니나 다음 유사 사례의 세 번째 전략 분기를 예방).
4. (낮은 우선순위) `WorkflowAssistantSessionService`/`NodesService` 의 잔여 unit 커버리지 갭, 메시지 문자열 중복, 순차 await 병렬화는 후속 정리로 남겨도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨**, 미이행 항목 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(사유 상세 미전달) — 본 PR 은 스키마 변경 없는 사전 검증 추가로, database/concurrency 리뷰어가 성능 관점(N+1·인덱스·순차 await)을 부분적으로 커버함 |
  | dependency | router 판단(사유 상세 미전달) — 신규 의존성 추가 없음(TypeORM 기존 API 재사용)이 security/architecture 리뷰에서 확인됨 |