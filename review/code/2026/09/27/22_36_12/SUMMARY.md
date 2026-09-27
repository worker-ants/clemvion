# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(신설 `common/` 유틸이 `nodes/` 를 역방향 import — 팀이 명시적으로 결정해 둔 층 경계 위반이나 기능은 깨지지 않음). forced 화이트리스트(7명) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 신설 `common/utils/reference-in-scope.ts` 가 `ErrorCode` 를 얻으려 `nodes/core/error-codes` 를 import — `common/` → `nodes/` 방향의 이 코드베이스 유일한 역방향 import. `common/utils/password.util.ts:60-65` 주석·`plan/complete/impl-details-code-wiring.md`(W3, 2026-09-11)가 "modules/ 는 canonical 상수, `common/` 2곳(password.util.ts, validation.pipe.ts)은 리터럴 유지 — 층을 갈라 적용"이라고 이미 명시적으로 결정해 둔 규칙을 이번 신설 파일이 어긴다. 문자열 값(`'INVALID_FIELD'`)은 같아 현재 동작·테스트는 안 깨지지만 순수 모듈 경계 회귀이며, 이를 막는 lint 가드가 아직 없어 조용히 통과했다. | `codebase/backend/src/common/utils/reference-in-scope.ts:3`(import), `:28`(`ErrorCode.INVALID_FIELD` 사용) | `import { ErrorCode } ...` 제거하고 `password.util.ts`/`validation.pipe.ts` 와 동일하게 리터럴 `'INVALID_FIELD'` 로 교체(3번째 `common/` 리터럴 자리로 편입). 상수를 `common/` 으로 승격하는 것은 9개 모듈 import 를 건드리는 별개 스코프이므로 이번 PR 범위에서는 리터럴 환원이 안전. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/유지보수성/아키텍처 | "여러 참조를 모아 한 번에 거부"하는 배치 검증 패턴이 4곳(엣지 끝점·노드 배치·캔버스 참조·신규 노드 id 중복)에서 서로 다른 스타일로 손으로 각각 구현됨(performance·architecture·maintainability·concurrency 4개 reviewer 공통 지적) — 2R 에서 이미 W2로 지적, "수렴 예외"로 `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속)에 등재 완료. 코드 변경 없어 재확인만. | `codebase/backend/src/modules/edges/edges.service.ts:72`, `nodes/nodes.service.ts:97`, `workflows/workflows.service.ts:1111,1210` | 조치 불요(이미 트래커 등재). 후속 집행 시 공용 헬퍼(`assertIdsInScope`)로 4자리 통일 고려. |
| 2 | 성능 | 폴더 생성·재부모화가 부모 폴더 행을 두 번 조회(`assertParentInWorkspace` → `getDepth` 첫 반복이 동일 조건 재조회) — 2R W3 로 이미 지적, "수렴 예외"로 등재됨. 재발 아님. | `codebase/backend/src/modules/folders/folders.service.ts:45-56,88-109,116-147` | 조치 불요(등재됨). 향후 `getDepth` 결과 재사용 또는 소속검사 흡수 고려. |
| 3 | DB/동시성 | 신설 소속 검증 대부분이 check-then-act(조회 후 별도 문장으로 저장)라 좁은 TOCTOU 창이 있음. 다만 대상 컬럼 전부 FK 제약(`ON DELETE CASCADE`/`SET NULL`)이 걸려 있어 최악의 경우도 조용한 오염이 아니라 저장 실패(500)/참조 해제로 그침 — 기존 `assertWorkflowInWorkspace`/`assertAuthConfigInWorkspace` 와 동형인 기존 컨벤션이며 이번 PR 신규 위험 아님. 캔버스 저장의 `assertNewNodeIdsUnused` 만 트랜잭션 매니저 스코프 안에서 검사+저장을 묶어 이 창을 구조적으로 닫음. | `codebase/backend/src/common/utils/reference-in-scope.ts:43`, `edges.service.ts:72-95`, `nodes.service.ts:97-130`, `workflows.service.ts:1154`(예외적으로 트랜잭션 스코프) | 조치 불요(기존 컨벤션 추종). 재발이 실측되면 트랜잭션-스코프 검증 확대 고려. |
| 4 | DB/보안 | 저장-전 검증은 신규 쓰기만 막고, 이미 DB 에 존재하는 과거 교차 워크스페이스 참조 행(예: 옛 트리거/스케줄의 `workflow_id`)은 소급 정리되지 않음 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속)에 후속 조사 항목으로 이미 명시적으로 이관됨. | 검증 유틸 공통 — 실행 엔진이 `findOneBy({ id })` 로만 조회하는 기존 구조 | 조치 불요(트래커 등재됨, 이번 PR 스코프 밖). |
| 5 | 지식베이스 | `KnowledgeBaseService.assertModelConfigRefsInWorkspace` 의 독립적인 3개 필드(`extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`) 검증이 `Promise.all` 없이 순차 `await` — 1R 에서 이미 지적·"조치 불요"(우선순위 낮음) 처분됨. 개수 고정(3)이라 N+1 아님. | `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235` | 조치 불요(기존 처분 유지). 여유 있으면 `Promise.all` 병렬화 + 코드 중복(3개 유사 `if`) 배열/루프화 고려. |
| 6 | 테스트 | 폴더 **수정**(PATCH) 경로의 `parentId` 교차 워크스페이스 케이스가 e2e 스위트에 없음(생성만 e2e 커버, 수정은 unit 만) — 생성·수정이 같은 서비스 헬퍼를 공유해 로직 리스크는 낮으나 컨트롤러·검증 파이프까지 통과하는지는 미검증. | `codebase/backend/test/cross-workspace-references.e2e-spec.ts:188-194` | 급하지 않음 — 여유 있을 때 e2e 1케이스 추가 권장. |
| 7 | 테스트 | 소속 판별 falsy 조건이 서비스마다 다름(`AlertsService`는 truthy 체크, 다른 서비스는 `!= null`) — 2R 에서 이미 "동작 결함 아님"으로 처분됨(DTO 검증 파이프가 빈 문자열을 선행 차단). 다만 "빈 문자열이 검증을 우회하지 않는다"를 고정하는 단위 테스트가 어디에도 없어 파이프 변경 시 무방비. | `codebase/backend/src/modules/alerts/alerts.service.ts`(`create`) vs `nodes/nodes.service.ts`(`assertPlacementInWorkflow`) | 우선순위 낮음 — 백로그에 "빈 문자열 workflowId 경계 테스트" 남겨두는 것 권장. |
| 8 | 테스트 | `edges.service.spec.ts`/`nodes.service.spec.ts` 의 mock 이 TypeORM `In()` 오퍼레이터 내부 구조(`where.id.value`)에 의존 — 2R 에서 이미 "공개 getter, 조치 불요" 처분됨. TypeORM 메이저 업그레이드 시 mock 만 조용히 깨질 여지. | `codebase/backend/src/modules/edges/edges.service.spec.ts`(`mockNodeRepo`) | 조치 불요(선례와 동일). 리팩터 여유 시 `toHaveBeenCalledWith` 방식으로 전환 고려. |
| 9 | 문서화 | 신규 소속 검증이 적용된 필드들의 Swagger `@ApiProperty` 설명이 새 제약(같은 워크스페이스/워크플로 소속, 위반 시 400)을 언급하지 않음 — 이미 트래커의 "API 문서 셋에 §1.1 미러" 항목과 같은 클래스 갭. | `folders/dto/{create,update}-folder.dto.ts`, `workflows/dto/{create,update}-workflow.dto.ts`, `edges/dto/create-edge.dto.ts`, `alerts/dto/alert-rule.dto.ts` 등 | 조치 불요(기존 유예 패턴과 동형). 다음 planner 턴에서 §1.1 미러 시 Swagger description 도 함께 갱신 권장. |
| 10 | 문서화/plan 위생 | `plan/in-progress/cross-workspace-refs.md` 체크리스트의 `/ai-review` 항목이 "3R 진행"으로 적혀 있음(현재는 오류 아니나, 이번 3R 마무리 후 결과로 갱신 필요). | `plan/in-progress/cross-workspace-refs.md` `## 체크리스트` | 이번 라운드 RESOLUTION 작성 시 체크리스트·`--impl-done` 줄을 3R 결과로 갱신. |
| 11 | 유지보수성 | `assertReferenceInScope(repo, where, field, message)` 의 `field`/`message` 가 인접한 동일 타입(`string`) 위치 인자라, 호출부에서 순서를 바꿔도 타입체크가 못 잡음. 현재 6개 호출부는 모두 순서를 지켜 실결함 없음. | `codebase/backend/src/common/utils/reference-in-scope.ts:37` | 급하지 않음 — `{ field, message }` 객체 인자로 리팩터하면 `throwInvalidReferences`(이미 객체 형태)와 형태가 맞고 순서 실수 여지도 사라짐. |
| 12 | 보안(긍정 확인) | 2R 에서 지적된 버전 복원(`skipLegacyDataGates=true`) 경로의 참조 검사 우회 가능성은 `421b69088`(뮤턴트 M6 KILLED)으로 이미 닫혀 있음을 이번 라운드에서 재확인(security·requirement·testing·api_contract 공통 확인). | `codebase/backend/src/modules/workflows/workflows.service.ts:696`(`validateCanvasReferences` 호출이 `skipLegacyDataGates` 조건문 밖) | 조치 불요(확인 목적 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 보안 강화(IDOR 수정), 파라미터화 쿼리·존재/부재 무구분 에러·mass-assignment 경로 없음. 버전 복원 우회 닫힘 재확인. |
| performance | LOW | N+1 없음. 폴더 부모 중복조회·KB 순차 await 는 기존 등재 사안 재확인. |
| architecture | LOW | **WARNING**: `common/` → `nodes/` 역방향 import 가 팀 결정을 위반. 그 외 배치 검증 중복은 수렴 예외 재확인. |
| requirement | NONE | spec §1.1 10개 참조 지점 line-level 일치. 1R/2R 지적 사항 전부 조치·검증 완료. |
| scope | NONE | 핵심 변경(24 src 파일)이 CHANGELOG 의도와 1:1 대응, 스코프 이탈 없음. |
| side_effect | LOW | 6개 서비스 생성자 변경은 전부 DI 로만 조립(수동 `new` 0건). 유일한 실질 변경은 의도된 API 동작 변경(400/404). |
| maintainability | NONE | 신규 유틸 설계 양호. 배치 검증 중복·인접 string 인자는 경미. |
| testing | LOW | 유닛+e2e(18케이스, DB 상태까지 검증) 두꺼움. 폴더 수정 e2e 미커버·falsy 경계 테스트 부재는 저위험 INFO. |
| documentation | NONE | CHANGELOG·spec 5개·JSDoc 모두 정합. Swagger 설명 미반영은 기존 유예 패턴과 동형. |
| database | LOW | 스키마 변경 없음, 전부 PK/인덱스 커버. check-then-act 는 FK 가 최종 방어선인 기존 컨벤션. |
| concurrency | LOW | 새 락/데드락 위험 없음. TOCTOU 창은 FK 가 백스톱, 신규 위험 아님. |
| api_contract | NONE | API 표면(엔드포인트·에러코드·응답봉투) 무변경. 불변 필드는 create-only 검사로 DTO 설계와 정합. |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전부 미매칭 확인, 발견사항 없음. |

## 발견 없는 에이전트

- **user_guide_sync** — 매트릭스 21개 trigger 전량 미매칭, 발견사항 0건.
- **scope**, **requirement**, **security**, **api_contract**, **documentation**, **maintainability** — Critical/Warning 없음(각자 INFO 확인 기록만 존재, 표에 반영됨).

## 권장 조치사항

1. **(WARNING #1)** `reference-in-scope.ts` 의 `nodes/core/error-codes` import 를 제거하고 리터럴 `'INVALID_FIELD'` 로 교체 — 팀이 2026-09-11 에 문서화한 `common/`↔`nodes/` 층 경계 결정을 다시 지킨다.
2. (선택, 급하지 않음) `plan/in-progress/cross-workspace-refs.md` 체크리스트의 `/ai-review` 항목을 이번 3R 결과(Critical 0 · Warning 1)로 갱신.
3. (선택, 급하지 않음) 폴더 수정(PATCH) `parentId` 교차 워크스페이스 e2e 케이스 1건 추가, Swagger DTO 설명에 소속 제약 미러는 다음 planner 턴으로 유예.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음).
  - **제외**: 아래 표(1명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터가 이번 diff 범위에서 제외 판단(프롬프트에 별도 사유 텍스트 미제공 — 신규 외부 패키지/버전 변경이 diff 에 없어 대상 없음으로 추정) |