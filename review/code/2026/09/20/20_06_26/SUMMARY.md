# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 핵심 변경(동시 워크플로 DELETE 중복 감사 수정)은 견고하지만, `architecture` 리뷰어가 지적한 "같은 결함 클래스가 워크스페이스 삭제 경로엔 대칭적으로 닫히지 않아 403 오응답 + 거짓 ERROR 로그가 남을 수 있다"는 지점이 세 개 리뷰어(architecture/maintainability/database)에 걸쳐 반복 확인되어 전체 위험도를 MEDIUM 으로 끌어올린다. forced 화이트리스트(7명) 전원 결과 확보됨 — 라우팅 이행 관련 위험 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 동시 삭제 경합 시 `WorkspacesService.deleteWorkspace`는 이 PR이 워크플로 경로에 추가한 "부모 부재 → 404 + 로그 억제" 처리를 대칭 적용하지 않는다. `assertWorkspaceDeletable`의 판정 순서가 "멤버십(권한) → 존재"이므로, 진 쪽 요청은 자원이 CASCADE로 이미 사라졌는데도 404가 아니라 403(`OWNER_REQUIRED`)을 받고, 바깥 `.catch`는 이를 진짜 실패와 구분 없이 "수동 정리가 필요하다"는 거짓 ERROR 로그로 남긴다 — 정확히 이 PR이 워크플로 경로에서 "거짓 경보"라 부르며 없앤 것과 같은 패턴. `maintainability`·`database` 리뷰어도 동일 지점을 별도로 확인함 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:519-527`(신규 주석), `:567-601`(`assertWorkspaceDeletable` 판정 순서), `:541-549`(무조건 `.catch` 로그) / 대조: `codebase/backend/src/modules/workflows/workflows.service.ts:289-293`(`NotFoundException` 조기 재던짐) | (a) `deleteWorkspace`의 `.catch`에서 `NotFoundException`/`ForbiddenException(OWNER_REQUIRED)`을 구분해 로그 억제, 또는 (b) `parent==='absent'`를 이 자리에서 직접 검사해 트리거 §4.4와 동일한 404로 단락. 최소한 plan 문서에 "워크스페이스 경로는 403 + 거짓 로그가 남을 수 있다"는 한계를 명시 |
| 2 | 유지보수성 | 같은 함수 안에서 동일 식별자 `parent`가 서로 다른 두 의미(파라미터: 어느 부모를 지울지 vs 반환 필드: `'present'\|'absent'` 상태)로 쓰여 시각적 혼동 여지가 있음 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109` (`lockParentAndListTriggerIds`) | 반환 필드명을 `parentPresence` 또는 `parentStatus`로 변경(호출부 3곳 동반 수정 필요 — 급하지 않음, 다음에 이 헬퍼를 만질 때 함께 정리) |
| 3 | 테스트 | `.catch()` 안 `NotFoundException` 조기 재던짐 가드(거짓 "수동 정리 필요" 로그 억제)를 검증하는 테스트가 없음. 뮤테이션으로 실측 확인 — 해당 줄을 삭제해도 `remove` 관련 9개 테스트 전부 GREEN, 오히려 의도된 반증 대상인 거짓 `Logger.error` 가 실제로 찍히며 통과함 | `codebase/backend/src/modules/workflows/workflows.service.ts:289-293`, `workflows.service.spec.ts`("remove — 잠금 뒤 부모가 사라졌으면 404..." 테스트) | 해당 404 테스트에 `jest.spyOn(Logger.prototype, 'error')`를 추가해 그 케이스에서 `logger.error`가 호출되지 않았음을 단언 |
| 4 | 문서화 | 이 저장소가 "동시 X 두 건" 류 결함 수정마다 같은 커밋에서 `CHANGELOG.md` `## Unreleased` 항목을 남겨온 확립된 관례(직전 3개 유사 커밋에서 확인)를 이번 PR만 건너뜀 | `CHANGELOG.md` (변경 없음) | 마무리 커밋에 `## Unreleased — 동시 워크플로 DELETE 두 건이 workflow.deleted 감사 행을 두 번 남겼다` 류 항목 추가(원인·고친 것·판별력 실측 3단 구성) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `RESOURCE_NOT_FOUND`/`'Workflow not found'` 리터럴이 `WorkflowsService` 안에 두 곳(기존 `findById`, 신규 부재 분기) 중복 | `workflows.service.ts:166-177`, `:280-285` | private 헬퍼(`workflowNotFound()`)로 묶어 drift 방지(급하지 않음) |
| 2 | 요구사항/문서화 | `spec/2-navigation/1-workflow-list.md` §2.6이 트리거 목록 §4.4와 대칭되는 "동시 삭제 시 두 번째 요청 404" 서술을 갖고 있지 않음. spec이 침묵하는 영역이라 코드 결함도 SPEC-DRIFT도 아니며, `--impl-prep` consistency-check가 이미 INFO/비차단으로 확인함 | `spec/2-navigation/1-workflow-list.md` §2.6/§3, 대조 `spec/2-navigation/2-trigger-list.md` §4.4 | 후속 project-planner 턴에서 대칭 문구 한 줄 추가 고려(비차단) |
| 3 | 문서화 | plan(`dup-delete-audit.md`)이 스스로 약속한 트래커 교차 참조(`spec-draft-nullable-notation-followups.md` :4501, :4741)가 이 스냅샷 시점에 아직 반영되지 않음 — plan 체크리스트 자체가 `- [ ]`로 남겨둔 예상된 정상 상태 | `plan/in-progress/dup-delete-audit.md:55-58`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4501,4741` | 이 리뷰(및 후속 `--impl-done`) 통과 후 마무리 커밋에서 트래커 항목 해소 표시 + `dup-delete-audit.md`를 `plan/complete/`로 이동 |
| 4 | 테스트 | `lockParentAndListTriggerIds`의 "부모 부재" 판정이 `workspaceId` 변형에 대해서는 명시적으로 테스트되지 않음(구현이 두 분기를 공유해 위험은 낮음) | `trigger-resource-releaser.service.spec.ts:319-343` | 두 `TriggerParent` 변형에 대한 표 기반 테스트로 합치기(필수 아님) |
| 5 | API 계약 | 에러 코드 네이밍이 리소스별로 다름(`RESOURCE_NOT_FOUND` vs `WORKSPACE_NOT_FOUND`) — 이 PR 이전부터 있던 기존 계약이며 새로 생긴 불일치 아님 | `workflows.service.ts:281-284` vs `workspaces.service.ts:589-592` | 조치 불요(pre-existing), 향후 표준화 논의 시 참고 |
| 6 | 동시성 | 동시 삭제 시 `releaseExternalForParent`(외부 자원 해제)는 잠금 없는 선조회 이후·트랜잭션 밖에서 두 요청 모두 호출될 수 있음 — plan이 명시적으로 스코프 밖으로 남긴 기존 잔여 이슈(멱등 전제에 의존) | `workflows.service.ts:268`, `workspaces.service.ts:513` | 신규 결함 아님, 후속 "네 자리 공용 형태" 설계 개편 시 함께 정리 |
| 7 | 환경 관측(투명성 고지) | 리뷰 도중 `workflows.service.ts`가 일시적으로 수정된 상태(293행 `NotFoundException` 재던짐 가드 삭제)로 관측됨 — plan이 기록한 뮤테이션 실험과 동일 형태로, 동시 실행 중인 다른 세션이 재현 중이었을 가능성. 해당 리뷰어는 Read만 수행, 재확인 시 원상복구 확인됨 | `database.md` 리뷰어 보고 | 코드 결함 아님. 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 감사 로그 무결성 개선 확인(OWASP A09), 인젝션·인가 우회·시크릿 노출 없음 |
| architecture | MEDIUM | 워크스페이스 삭제 경로가 워크플로와 대칭적으로 닫히지 않아 403 오응답 + 거짓 ERROR 로그 가능 |
| requirement | NONE | 구현이 트리거 §4.4 정책과 라인 단위로 일치, spec 침묵 영역은 비차단 |
| scope | NONE | 목적-diff 일대일 대응, 스코프 이탈 없음 |
| side_effect | LOW | 반환 시그니처 변경 전 호출처 grep 전수 확인, 204→404 응답 변화는 의도된 변경 |
| maintainability | LOW | `parent` 식별자 재사용(WARNING), 두 삭제 경로 간 로그 처리 비대칭(기존 동작) |
| testing | LOW | 로그 억제 가드에 대한 테스트 공백을 뮤테이션으로 실측 확인 |
| documentation | LOW | CHANGELOG 관례 미준수(WARNING), spec/트래커 대칭 문서 후속 필요(INFO) |
| database | LOW | 워크스페이스 `.catch` 로그 비대칭(architecture와 동일 이슈), 트랜잭션/인덱스/N+1 이상 없음 |
| concurrency | LOW | 외부 자원 해제 중복 실행은 기존 스코프 밖 이슈, 신규 데드락·잠금 누락 없음 |
| api_contract | NONE | 외부 HTTP 계약 변화 없음, 내부 포트 반환 타입 변경은 전수 동기화됨 |

## 발견 없는 에이전트

- **security** — 취약점 없음(인젝션·인가 우회·시크릿 노출·정보 노출 전부 확인 후 이상 없음)
- **scope** — 범위 이탈 없음(작업 목적과 diff 17개 파일 전부 일대일 대응)

## 권장 조치사항

1. `WorkspacesService.deleteWorkspace`의 동시 삭제 경합 처리(403 오응답 + 거짓 ERROR 로그)를 워크플로 경로와 대칭시키거나, 최소한 plan 문서에 이 비대칭을 한계로 명시한다 (WARNING #1).
2. 404 응답 시 "수동 정리 필요" 로그를 억제하는 가드(`workflows.service.ts:293`)에 `Logger.error` 미호출 단언을 추가해 회귀 방지 테스트를 보강한다 (WARNING #3).
3. 마무리 커밋에서 `CHANGELOG.md`에 이번 결함 수정 항목을 추가한다 (WARNING #4).
4. `lockParentAndListTriggerIds`의 반환 필드 `parent` 이름을 파라미터와 구분되도록 리네이밍(`parentPresence` 등) — 다음 헬퍼 수정 시 (WARNING #2).
5. (비차단) plan이 스스로 약속한 트래커 교차 참조 반영 후 `plan/complete/`로 이동, spec 대칭 문구 후속 추가 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff와 관련성 낮음(성능 특성 변경 없음) |
  | dependency | router 판단 — 의존성 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 영향 없음 |
