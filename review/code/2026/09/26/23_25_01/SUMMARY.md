# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 10개 reviewer 전원(강제 포함 7명 전원 결과 확보) 결과 모두 위험도 NONE~LOW, 발견사항은 전부 INFO(참고) 수준. `GET /workflows/:id/export` 응답의 `nodes`/`edges` 를 응답 전용 DTO(`ExportedNodeDto`/`ExportedEdgeDto`)로 광고하는 순수 OpenAPI 문서화 강화이며 wire 포맷·서비스 로직 변경 없음.

라우터 강제 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

해당 없음 — 전 reviewer 통틀어 CRITICAL 발견사항 없음.

## 경고 (WARNING)

해당 없음 — 전 reviewer 통틀어 WARNING 발견사항 없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/유지보수성 | `ExportedNodeDto`/`ExportedEdgeDto` 가 `NodeDto`/`EdgeDto` 와 필드(10키/6키 대부분)를 수기로 중복 선언, 동기화를 강제하는 컴파일/테스트 장치는 없음. 의도된 분리이며 근거 주석 존재(요청 vs 응답 presence/nullable 계약 차이) | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:147-219`, 근거 주석 `:139-142` | 조치 불요. 향후 `NodeDto`/`EdgeDto` 필드 변경 시 이 DTO 도 함께 확인하라는 마커 유지 권장 |
| 2 | 아키텍처 | `ExportedNodeDto`/`ExportedEdgeDto` 가 `nodes`/`edges` 도메인 모듈이 아닌 `workflows` 모듈 파일에 배치되어 기존 "도메인별 응답 DTO 는 해당 모듈에 둔다" 관례와 어긋남 | `workflow-response.dto.ts:147`, `:195` | 조치 불요. 필요시 `node-response.dto.ts`/`edge-response.dto.ts` 에 backlink 주석 추가 고려 |
| 3 | 아키텍처 | `workflow-response.dto.ts` 한 파일에 서로 다른 8개 응답 클래스(WorkflowDto·ExecuteAcceptedDto·CanvasSaveResultDto·GraphWarning*·Exported*·ExportWorkflowDto)가 누적 중 | `workflow-response.dto.ts` 전체 | 조치 불요. 파일이 더 커지면 엔드포인트별 파일 분리 고려 |
| 4 | 유지보수성 | 부모 DTO `ExportWorkflowDto`(현재형)와 원소 DTO `ExportedNodeDto`/`ExportedEdgeDto`(과거분사형) 간 명명 시제 불일치 | `:224`, `:147`, `:195` | 조치 불요. export 관련 DTO 증가 시 명명 규칙 문서화 고려 |
| 5 | 보안 | `config`/`condition` 필드가 여전히 임의 키를 허용하는 열린 맵(`additionalProperties: true`)으로 광고됨 — 이 PR 이전부터 존재하던 기존 설계, 이번 diff 범위 밖 | `workflow-response.dto.ts:169`(`ExportedNodeDto.config`), `:218`(`ExportedEdgeDto.condition`) | 이번 PR 조치 불요. 시크릿이 담길 수 있는 노드 타입이 있다면 export 전 마스킹 정책 별도 확인 권장 |
| 6 | 보안 | export 엔드포인트 인가(워크스페이스 소속·권한) 검사는 이번 diff(컨트롤러/서비스 미변경) 밖이라 이번 변경으로 새로 검증되지 않음 | `GET /workflows/:id/export` 컨트롤러/서비스(diff 미포함) | 조치 불요(참고). 교차 워크스페이스 접근 차단은 기존 `workspace-rbac.e2e-spec.ts` 소관 |
| 7 | API 계약 | `formatVersion` 이 스키마상 `required` 이지만 서비스가 emit 하지 않는 기존 갭이 존속 — spec 이 이미 "Planned" 로 추적, e2e 도 `allowMissing`으로 우회 중 | `workflow-response.dto.ts:226-227`; `spec/2-navigation/1-workflow-list.md` | 조치 불요(이미 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 추적 중). 후속 PR 에서 갭을 닫을 때 함께 정리 |
| 8 | API 계약 | export 응답은 노드/엣지 참조를 UUID 대신 배열 index 로 정규화 — canvas 저장/복원 응답(NodeDto/EdgeDto)은 UUID 사용, 엔드포인트 간 참조 표기 방식이 다름(설계 의도, 근거 주석 존재) | `workflow-response.dto.ts:139-142`, `:183-189`, `:196-206` | 조치 불요(현행 유지). 클라이언트 구현자에게 함정이 될 수 있음을 인지만 |
| 9 | 테스트 | `ExportedEdgeDto.condition` 이 non-null 값으로 직렬화되는 경로가 이 PR의 어떤 테스트에도 없음(C·F 케이스 모두 조건부 엣지 없이 항상 `null`) | `codebase/backend/test/workflow-crud.e2e-spec.ts:317-321`, `buildFiveNodeGraphPayload()` 102-117 | 조건부 엣지 1개를 fixture 에 포함하거나, 최소 뮤턴트 표에 갭이 의도적임을 명시 권장 |
| 10 | 테스트 | `containerIndex`/`toolOwnerIndex`/`condition` 의 `nullable` 제거에 대한 뮤턴트 실측이 plan 표(M1~M4)에 없음 — `description` 의 nullable 제거(M3)만 실측됨 | `plan/in-progress/export-workflow-typed.md` 뮤턴트 표(85-92행); `workflow-response.dto.ts:183-189` | blocking 아님. 실측 행 추가 또는 "동일 메커니즘, 실측 생략" 주석 권장 |
| 11 | 스코프 | developer 가 planner 소유(frontmatter `owner: planner`) 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 항목 2건 추가 — `plan/**` 은 developer 쓰기 범위라 권한 위반 아니고, plan 문서에 선례·근거 기록됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 추적 가능하게 근거가 이미 남아 있음 |
| 12 | API 계약/문서화 | `spec/2-navigation/4-integration.md` §9.4 실패 응답 포맷이 SoT/구현과 다르다는 기존 spec drift 가 이번 diff 의 plan 파일에 신규 등재됨 — 이번 코드 변경 범위 밖, planner 인계 완료 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (§9.4 보강) | 조치 불요. 이번 diff 를 근거로 재차 Critical/Warning 매길 필요 없음(이미 planner 라우팅됨) |
| 13 | 유저가이드 동기화 | `backend-api-change` 트리거가 매칭되나 필드 추가/제거/이름 변경이 없어 `saving-and-sharing.mdx` 등 user-guide 갱신은 불필요, swagger jsdoc 은 같은 커밋에서 충족 확인 | `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx` | 조치 불요. 향후 DTO 필드 실변경 시 해당 문서 및 `spec/2-navigation/1-workflow-list.md` §3.2 동반 갱신 필요 |

**긍정적 확인(조치 불요, 회귀 아님)**: 신규 import(`EdgeType`/`NodeCategory`) 순환참조 없음(architecture/side_effect 교차 확인), 저장소 잔여 뮤테이션 없음(`git status --short`, side_effect), DTO 필드 문서·CHANGELOG·e2e 주석이 실제 생산자 코드(`WorkflowsService.exportWorkflow`)·spec §3.2 와 정확히 일치(requirement/documentation), `--impl-prep` consistency-check 의 권고 2건(설계 의도 주석, FE nullable 갭 트래커 등재) 모두 반영 확인(requirement/documentation), 뮤턴트 4개(M1~M4) KILLED 실측(requirement).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | config/condition 열린 맵·인가 검사 diff 범위 밖(둘 다 기존 설계, 이번 PR 무관) |
| architecture | LOW | ExportedNodeDto/EdgeDto 와 NodeDto/EdgeDto 필드 중복(의도됨), 모듈 배치 관례 이탈, 파일 응집 비대화 — 전부 참고용 |
| requirement | NONE | 서비스 실측 대조 완전 일치, spec §3.2 불일치 없음, 뮤턴트 4개 KILLED, impl-prep 권고 반영 확인 |
| scope | NONE | 14개 파일 전부 목적에 수렴, developer 의 plan 트래커 추가·consistency 산출물 정상 절차 |
| side_effect | NONE | 순수 문서화, 런타임 반환값 불변, 순환참조 없음, 저장소 잔여물 없음 |
| maintainability | NONE | 의도된 필드 중복(근거 주석 존재), 명명 시제 불일치, 테스트 리팩터로 중복 오히려 감소 |
| testing | LOW | condition non-null 직렬화 경로 미검증, containerIndex/toolOwnerIndex/condition nullable 뮤턴트 실측 누락 |
| documentation | NONE | CHANGELOG·DTO 문서·e2e 주석이 실제 코드와 전부 일치, impl-prep 권고 반영 확인 |
| api_contract | LOW | formatVersion required-but-not-emitted 기존 갭, UUID vs index 참조 비대칭(둘 다 기존/추적 중), wire 포맷 불변 |
| user_guide_sync | NONE | backend-api-change 트리거 매칭되나 필드 변경 없어 user-guide 갱신 불필요, swagger jsdoc 충족 |

## 발견 없는 에이전트

없음 — 10개 reviewer 모두 최소 1건 이상의 INFO 관찰을 보고했으나, 전부 참고용이며 조치를 요구하는 CRITICAL/WARNING 은 없음.

## 권장 조치사항

1. (선택) `ExportedEdgeDto.condition` 이 non-null 값을 갖는 조건부 엣지 케이스를 e2e fixture 에 추가하거나, plan 뮤턴트 표에 이 갭이 의도적임을 명시한다.
2. (선택) plan 뮤턴트 표(M1~M4)에 `containerIndex`/`toolOwnerIndex`/`condition` 의 `nullable` 제거에 대한 실측 행을 추가하거나 "동일 메커니즘, 실측 생략" 주석을 남긴다.
3. (선택, 차단 아님) `ExportedNodeDto`/`ExportedEdgeDto` 필드 목록에 "NodeDto/EdgeDto 변경 시 함께 확인" 마커를 강화하고, 필요시 `node-response.dto.ts`/`edge-response.dto.ts` 에 backlink 주석을 추가해 드리프트 위험을 더 낮춘다.
4. 그 외 항목(§9.4 spec drift, formatVersion 갭, UUID/index 참조 비대칭)은 이미 별도 트래커로 정상 라우팅되어 있으므로 이번 PR 기준으로는 추가 조치 불필요 — 후속 세션에서 해당 트래커 항목 처리 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(전달된 로그에 개별 사유 텍스트 없음) — 이번 변경이 순수 OpenAPI 타입 선언(런타임 로직 미변경)이라는 diff 성격상 성능 영향 여지가 낮다고 판단된 것으로 추정 |
  | dependency | 라우터 판단(개별 사유 텍스트 없음) — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단(개별 사유 텍스트 없음) — 쿼리/스키마/마이그레이션 변경 없음 |
  | concurrency | 라우터 판단(개별 사유 텍스트 없음) — 동시성 제어 로직 변경 없음 |