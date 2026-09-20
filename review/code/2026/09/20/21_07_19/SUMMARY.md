# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(모두 문서/후속-검증 성격이며 코드 결함 아님) 발견. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 리뷰 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 이 PR의 근거("트리거 자신의 삭제는 이미 spec §4.4대로 동작한다")가 실측되지 않았다. `TriggersService.remove()`는 존재 확인(`findById`, 잠금 없음) 후 advisory lock(`acquireTriggerConfigLock`, 행 잠금 아님)만 잡고 곧바로 `manager.remove()`를 호출 — 워크플로/워크스페이스가 이번 PR 전 갖고 있던 것과 동일한 구조(잠금 없는 선조회 + 0행에도 안 던지는 `remove()`)이며, 동시 트리거 DELETE 두 건도 같은 방식으로 감사 행을 중복 기록할 가능성이 있다. 동시성 e2e·단위 테스트 모두 이 케이스를 커버하지 않는다 | `codebase/backend/src/modules/triggers/triggers.service.ts:1060-1086` | `workflow-delete-concurrency.e2e-spec.ts`와 동일 기법(행 락 직접 획득)으로 `TriggersService.remove()`의 동시 삭제를 실측 검증. 재현되면 별도 plan 항목으로 등재(이 PR을 막을 사유는 아님) |
| 2 | documentation | `plan/in-progress/dup-delete-audit.md`가 2라운드 WARNING(옛 필드명 `parent`→`parentPresence` 리네임 stale 참조)에서 지목된 두 곳 중 한 곳만 고쳐졌다 — §B 스니펫은 정정됐지만 "그 설계가 착수될 때 이 PR 이 바꾼 반환 계약(`{ parent, triggerIds }`)을 전제로" 문장은 옛 이름 그대로 남아 있다. `RESOLUTION.md`도 "스니펫만" 언급해 부분 조치를 완전 조치로 기록 중 | `plan/in-progress/dup-delete-audit.md:69` | `plan/complete/` 이동 전 `{ parentPresence, triggerIds }`로 정정. 후속 트래커(`spec-draft-nullable-notation-followups.md:4501`) 반영 시에도 새 이름 사용 |
| 3 | documentation | `CHANGELOG.md`의 "판별력 실측" 문단이 워크스페이스 경로에 대해 이 저장소 스스로 "구조적으로 불충분"하다고 판명한 단위 뮤테이션 증거만 서술하고, 이후 추가한 더 강한 실 DB e2e 증거(403→404 재현)를 반영하지 않았다 | `CHANGELOG.md:25-31` | 워크스페이스 판별력 실측 문장에 `workspace-delete-concurrency.e2e-spec.ts`의 실 DB 재현 결과를 추가 (코드 결함 아님, 병합 차단 사유 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / maintainability | "잠금→absent 검사→NotFoundException→catch 구분" 4단 패턴이 `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()` 두 곳에 동일하게 복제돼 있고, 이 PR 진행 중 실제로 한 번(워크스페이스 쪽) 어긋났다가 리뷰로 잡힌 전례가 있다. 이미 "네 자리 공용 형태" 후속 설계 트래커로 넘겨져 있음 | `workflows.service.ts:262-309`, `workspaces.service.ts:498-567` | 공용 헬퍼(`guardAgainstConcurrentDelete` 류)로 추출 검토. 급하지 않음 |
| 2 | maintainability | `workspace-delete-concurrency.e2e-spec.ts`가 `workflow-delete-concurrency.e2e-spec.ts`·`integration-rotate-concurrency.e2e-spec.ts`와 거의 동일한 "행 락+공허성 가드+Promise.race" 보일러플레이트를 세 번째로 손 복붙 — rule-of-3 임계 도달 | `codebase/backend/test/*.e2e-spec.ts` | `test/helpers/`에 공용 헬퍼 추출. 급하지 않음, 이번 PR 비차단 |
| 3 | testing | `lockParentAndListTriggerIds`의 `absent` 판정이 `workspaceId` 변형에서는 단위 테스트로 직접 검증되지 않음(공유 로직이라 위험 낮음, 3라운드 연속 캐리오버) | `trigger-resource-releaser.service.spec.ts` | `it.each`로 workflowId/workspaceId × present/absent 조합 표로 통합 |
| 4 | testing | 신규 404 테스트가 `.rejects.toMatchObject({response:{code:...}})`를 쓰는데 같은 파일 기존 테스트는 `.rejects.toThrow(NotFoundException)`만 사용 — 스타일 혼재(신규 방식이 더 강한 단언이라 결함 아님) | `workflows.service.spec.ts` | 후속 정리 시 통일. 비차단 |
| 5 | concurrency | `releaseExternalForParent`는 여전히 트랜잭션/잠금 밖에서 두 동시 요청 모두 실행됨 — 기존에 식별·유보된 잔여 이슈(멱등성 전제), 이번 diff 로 상태 불변 | `workflows.service.ts` `remove()`, `workspaces.service.ts` `deleteWorkspace()` | 후속 "공용 삭제 경로" 리팩터 시 잠금 뒤로 이동 또는 멱등성 계약 명문화 검토 |
| 6 | concurrency | e2e의 겹침-대기 `setTimeout` 핸들이 `clearTimeout` 되지 않음(판정 결과엔 영향 없음, Jest open-handle 경고 가능성) | `workflow-/workspace-delete-concurrency.e2e-spec.ts` | 비차단, 필요시 정리 |
| 7 | database | `WorkspacesService.deleteWorkspace`가 같은 트랜잭션 안에서 `Workspace` 행을 두 번(`lockParentAndListTriggerIds` + `assertWorkspaceDeletable`) 잠금 — 같은 트랜잭션 내 재획득이라 데드락 없음, 왕복 쿼리 1회 낭비 수준 | `workspaces.service.ts:498-560` | 후속 리팩터 시 재조회 제거 검토. 비차단 |
| 8 | api_contract / requirement | 동시 삭제 시 "두 번째는 404" 계약이 트리거 목록 spec(§4.4)에는 명문화돼 있으나, `spec/2-navigation/1-workflow-list.md` §2.6·`spec/data-flow/12-workspace.md` §1.10에는 대칭 서술이 없음 — 이미 이전 라운드가 인지, 후속 project-planner 턴으로 유보 중 | `spec/2-navigation/1-workflow-list.md`, `spec/data-flow/12-workspace.md` | 후속 턴에서 트리거 §4.4와 대칭되는 문구 추가 |
| 9 | api_contract | 동시 DELETE의 관측 가능한 응답이 "둘 다 성공"에서 "승자 200/204·패자 404"로 바뀜 — 의도된 계약 변경(트리거 삭제와 대칭), breaking 이지만 스코프 안 | `workflow-/workspace-delete-concurrency.e2e-spec.ts` | 프론트엔드가 이 두 삭제 mutation의 404를 무해하게 처리하는지 별도 확인(이번 diff 스코프 밖) |
| 10 | 보안/스코프/기타 | 인젝션 표면 없음(전 쿼리 파라미터 바인딩), 인가 순서 회귀 없음, 하드코딩 시크릿·의존성 변경 없음, `spec/` 변경 없음(51개 파일 전체가 목적과 일대일 대응), `TriggerResourceReleasePort` 반환 시그니처 변경의 blast radius는 유일한 구현체·두 호출자·관련 spec 전부로 완전히 닫힘, `parentPresence` 리네임 잔존 없음(전량 grep 재확인) | 전체 diff | 없음 — 여러 리뷰어가 독립적으로 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. 인젝션·인가·정보노출·시크릿 전부 이상 없음 |
| architecture | LOW | 1라운드 계약 비대칭 해소 재확인. 4단 패턴 복제(INFO)만 잔존 |
| requirement | LOW | 이 PR 코드는 spec/plan과 line-level 일치. `TriggersService.remove()`의 동일 결함 미검증 가능성 WARNING |
| scope | NONE | 51개 파일 전부 목적과 일치, spec 변경 없음, 스코프 이탈 없음 |
| side_effect | LOW | 포트 시그니처 변경 blast radius 닫힘, 404 전환은 의도된 부작용 |
| maintainability | LOW | 4단 패턴 복제 + e2e 보일러플레이트 3중 복붙(INFO), 실질 WARNING 없음 |
| testing | NONE | 판별력 있는 단위+e2e 테스트, 갭은 workspaceId absent 단위 테스트 1건(INFO) |
| documentation | LOW | plan 문서 stale 필드명 1곳, CHANGELOG 판별력 실측 문단 최신화 누락(WARNING 2건) |
| database | LOW | 트랜잭션 원자성·인덱스·N+1·인젝션 전부 이상 없음. 이중 잠금 1건(INFO) |
| concurrency | LOW | TOCTOU 창 정석적으로 닫힘, 신규 데드락/레이스 없음. 기존 유보 항목 재확인(INFO) |
| api_contract | NONE | HTTP 계약 breaking 없음(내부 포트만 변경), spec 문서 갭은 기존 추적 항목 |

## 발견 없는 에이전트

security, scope, testing, api_contract — Critical/Warning 없음(위 표 참고).

## 권장 조치사항

1. `plan/in-progress/dup-delete-audit.md:69`의 옛 필드명 `{ parent, triggerIds }`를 `{ parentPresence, triggerIds }`로 정정 — `plan/complete/` 이동 전 필수(documentation WARNING #2).
2. `CHANGELOG.md`의 워크스페이스 판별력 실측 문단에 `workspace-delete-concurrency.e2e-spec.ts`의 실 DB 재현 결과(403→404)를 추가(documentation WARNING #3).
3. `TriggersService.remove()`가 워크플로/워크스페이스와 동일한 동시-삭제 감사 중복 결함을 갖는지 실 DB e2e로 검증 — 재현되면 별도 plan 항목으로 등재(requirement WARNING #1, 이 PR을 막을 사유는 아님).
4. (비차단, 후속) 4단 가드 패턴 공용 헬퍼 추출, e2e 보일러플레이트 공용화, `workspaceId` absent 단위 테스트 추가, spec 문서(§2.6/§1.10)에 동시-삭제 404 계약 명문화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (11명)
  - **제외**: 표 참고 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(성공)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(감사 행 중복 방지용 소규모 트랜잭션 로직 변경)와 관련성 낮음 |
  | dependency | package.json/lockfile 변경 없음(scope 리뷰가 diff 전체 확인으로 재확인) |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음(코드/plan/review 산출물만 변경) |
