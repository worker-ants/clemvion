# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 2건: (1) 이번 라운드가 수정한 워크스페이스 삭제 동시성 경로가 실제 Postgres 락/CASCADE 로는 검증되지 않고 mock 단위테스트로만 확인됨(testing, database 리뷰어 corroborate), (2) `plan/in-progress/dup-delete-audit.md` 가 리네임 이전 필드명 `parent` 를 스니펫·트래커 교차참조 예시에 그대로 남겨 다음 사람이 옮겨 적으면 오류가 전파될 수 있음(documentation). 두 건 모두 병합을 막을 사안은 아니나 `plan/complete/` 이동 및 후속 e2e 보강이 필요.

router 강제 포함(forced) 대상 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 인라인으로 확보되어 있고 누락 없음 — "clean" 판정이 강제 화이트리스트 미이행을 가리는 상황은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트(Testing) | `WorkspacesService.deleteWorkspace` 의 동시-삭제 403 오응답/거짓 로그 → 404 수정이 실제 Postgres 동시성(행 락 + CASCADE)으로 검증되지 않는다. workflow 경로만 `SELECT ... FOR UPDATE` 기반 결정적 e2e 를 갖고, workspace 경로는 포트 mock 으로 `parentPresence:'absent'` 를 직접 주입하는 단위 테스트로만 검증됨(database 리뷰어도 동일 갭을 독립적으로 지적) | `codebase/backend/test/`(workspace-delete-concurrency e2e 부재) · `codebase/backend/src/modules/workspaces/workspaces.service.ts:530-542` | `workflow-delete-concurrency.e2e-spec.ts` 와 동일 기법(별도 커넥션 행 락 + 동시 DELETE + 공허성 가드)으로 `workspace-delete-concurrency.e2e-spec.ts` 추가, `[204,404]` 및 멤버/초대 행 정리를 실측 고정 |
| 2 | 문서화(Documentation) | `plan/in-progress/dup-delete-audit.md` §B 의 설계 코드 스니펫과 트래커 교차참조 예시 문구가 리네임 이전 필드명 `parent` 를 그대로 사용(실제 코드는 `parentPresence`). 같은 절 아래 정정문은 이미 새 이름을 쓰고 있어 불일치가 명백하며, 아직 대상 트래커(`spec-draft-nullable-notation-followups.md`)엔 전파되지 않았으나 이 문서를 그대로 복사하면 두 번째 문서로 퍼진다 | `plan/in-progress/dup-delete-audit.md` §B (코드 스니펫, "전제로" 문장) | `plan/complete/` 이동 전 `parent`→`parentPresence` 정정(취소선 불요 — 자기-반증형 소정정 대상인 "예고가 실측 반증된 문장"이 아니라 사후 불일치이므로 그냥 고친다). 트래커에 옮길 때도 `parentPresence` 로 표기 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | "잠금 → absent 검사 → NotFoundException → catch 구분" 패턴이 `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace` 두 곳에 글자 그대로 복제돼 있고, 이 복제가 이번 PR 안에서 실제로 한 번 어긋났다가(워크스페이스 쪽 최초 누락) 리뷰로 잡힌 전례가 생겼다 | `workflows.service.ts:263-312`, `workspaces.service.ts:498-567` | 이미 트래커 추적 중인 "네 자리 공용 형태" 설계 착수 시 공용 가드 헬퍼로 추출 고려 |
| 2 | 유지보수성 | `RESOURCE_NOT_FOUND`/`'Workflow not found'` 객체 리터럴이 `WorkflowsService` 안에서 `findById`(기존)와 신규 `absent` 분기 두 곳에 중복 | `workflows.service.ts:172, :282` | `private workflowNotFound()` 헬퍼로 통합(급하지 않음) |
| 3 | 테스트 | `TriggerResourceReleaserService` 의 `parentPresence` 판정 테스트가 `workflowId` 변형만 커버하고 `workspaceId` 변형엔 `absent` 케이스가 없음 — 위 WARNING#1 과 같은 축의 갭 | `trigger-resource-releaser.service.spec.ts:300-346` | 두 `TriggerParent` 변형에 대한 표 기반(parametrized) 테스트로 통합 고려 |
| 4 | 동시성 | `absent` 404 단락 경로에서는 `releaseSecretsAfterCommit` 이 호출되지 않음(트랜잭션이 예외로 끝남). 다만 이겨서 커밋한 요청이 전체 `triggerIds` 로 이미 비밀을 정리하므로 데이터 잔존 위험은 없음 — 이번 PR 이 만든 것이 아니라 plan 이 스코프 밖으로 명시한 기존 잔여 이슈 | `workflows.service.ts:268, :302-305`, `workspaces.service.ts:513, :563-566` | 조치 불요 — 후속 "네 자리 공용 형태" 개편 시 함께 정리 |
| 5 | 데이터베이스 | `deleteWorkspace` 는 애초에 삭제 시점에 감사 로그를 기록하지 않아, 이번 PR 의 워크스페이스 쪽 수정은 "감사 중복" 방지가 아니라 "403 오응답 + 거짓 ERROR 로그" 방지였다(서술 정밀도 참고, 코드 결함 아님) | `workspaces.service.ts`(`deleteWorkspace` 전체) | 조치 불요 |
| 6 | API 계약 | 동시 삭제 "패자" 요청의 응답 코드가 204→404 로 바뀌지만, 두 컨트롤러 모두 이번 diff 이전부터 Swagger 에 404 를 이미 문서화해 두고 있어 breaking change 가 아니다 — 기존 오류 응답을 정확한 상황에 연결한 것 | `workflows.controller.ts:195-214`, `workspaces.controller.ts:201-213`, e2e `workflow-delete-concurrency.e2e-spec.ts:93` | 조치 불요 |
| 7 | 요구사항 | `spec/2-navigation/1-workflow-list.md` §2.6 이 트리거 §4.4 의 "동시 삭제 404" 대칭 문구를 아직 갖지 않음(모순 아니라 침묵, 이미 --impl-prep·직전 라운드가 비차단 처리) | `spec/2-navigation/1-workflow-list.md:107` | project-planner 후속 턴에서 대칭 문구 추가 여부 결정(선택) |
| 8 | 문서화(환경 관측) | `review/code/2026/09/20/20_06_26/_resolution_log.md` 가 `git status --short` 에 untracked 로 남아 있음 — harness 부기 파일이라 차단 사유는 아니나 커밋 포함 여부가 불명확 | 저장소 루트 `git status --short` | 다음 커밋에 포함하거나 의도적 제외 사유를 남길 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가 우회·시크릿 노출 없음. 신규 404 단락은 인가 이후에만 도달해 IDOR 경로 아님 |
| architecture | LOW | 직전 라운드 CRITICAL(워크플로/워크스페이스 비대칭) 해소 확인. 두 서비스 간 패턴 복제 관찰(INFO#1) |
| requirement | NONE | 반환 계약·spec(트리거 §4.4) 대칭 확인, 174 테스트 GREEN, tsc 신규 회귀 없음 |
| scope | NONE | 34개 파일 전부 "동시 DELETE 감사 중복" 목적에 일대일 대응, 무관 변경 없음 |
| side_effect | LOW | 포트 반환타입 변경 blast radius 전수 확인(호출부 2곳뿐). 응답코드·로그 억제는 의도된 변경 |
| maintainability | LOW | 직전 WARNING(`parent` 네이밍 충돌) 해소 확인. 리터럴/구조 중복 잔존(INFO#2) |
| testing | MEDIUM | 워크스페이스 경로 동시성 수정이 실 DB 락으로 미검증(WARNING#1) |
| documentation | LOW | CHANGELOG/JSDoc 정합 확인. plan 문서 stale 필드명(WARNING#2) |
| database | LOW | 트랜잭션 원자성·잠금 순서·인덱스 이상 없음. workspace e2e 부재 corroborate(INFO#3,5) |
| concurrency | LOW | 워크스페이스 대칭 처리 확인, 잠금 순서 불변으로 데드락 신규 위험 없음 |
| api_contract | NONE | 외부 HTTP 계약 breaking 없음, 기존 404 계약 범위 내 |

## 발견 없는 에이전트

- security — "없음" (Critical/Warning 급 보안 결함 미발견)
- scope — "없음" (범위 이탈 변경 미발견)

## 권장 조치사항

1. `workflow-delete-concurrency.e2e-spec.ts` 와 동일 기법으로 `workspace-delete-concurrency.e2e-spec.ts` 를 추가해, 워크스페이스 삭제 경로의 동시성 수정을 실제 Postgres 행 락 + CASCADE 하에서 실측 고정한다(WARNING#1).
2. `plan/in-progress/dup-delete-audit.md` §B 의 `parent` 잔존 표기를 `plan/complete/` 이동 전에 `parentPresence` 로 정정하고, 트래커(`spec-draft-nullable-notation-followups.md`) 교차참조 시에도 정정된 이름을 사용한다(WARNING#2).
3. (선택, 급하지 않음) `RESOURCE_NOT_FOUND` 리터럴 중복을 헬퍼로 통합하고, `TriggerResourceReleaserService` 의 `workspaceId` absent 케이스 테스트를 보강한다(INFO#2, #3).
4. `review/code/2026/09/20/20_06_26/_resolution_log.md` untracked 상태를 다음 커밋에서 정리한다(INFO#8).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 성능 특성 변경 없음(고정 2쿼리, 신규 쿼리 패턴 없음) |
  | dependency | router 판단 — package.json/lockfile 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 대상 변경 없음 |
