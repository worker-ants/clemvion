# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 다만 `security` 리뷰어가 `removeMember()` 의 권한 검사(`assertAdmin`) 순서 결함(비멤버도 대상 존재·owner 여부를 구분해 알아낼 수 있음, 신규·미등재)을 지적했고, 4개 리뷰어(security/requirement/database/concurrency)가 owner 승격 TOCTOU(기존에 실측·등재·유예된 갭)를 공통으로 재확인했다. 두 사안 모두 이번 diff 가 새로 만든 결함은 아니며 병합을 막을 사유는 아니지만, 신규 발견인 (1)은 아직 트래커에 없다는 점을 위험도에 반영했다.

**forced 화이트리스트 이행 확인**: `forced (router_safety)` 로 지정된 7개 reviewer(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원의 결과가 인라인 전문으로 확보됐다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `DELETE` 멱등성 표(§3)가 실제 동작(동시 요청 패자=404)과 다시 어긋남 — 코드가 옳고 spec 각주만 낡은, 형제 5건(#1369~#1372)과 동일한 6번째 사례 | `spec/5-system/2-api-convention.md §3` vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:826` | 코드 유지. spec 반영은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 이미 등재됨 — 신규 등재 불요 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `removeMember()` 권한 검사(`assertAdmin`)가 대상 존재·owner 확인보다 뒤에 있어, 워크스페이스 비멤버도 `workspaceId`+`memberId` 로 멤버 존재 여부·owner 여부를 구분해 알아낼 수 있음 (기존 코드의 순서 결함, 이번 diff 가 만든 것은 아니나 신규 발견·미등재) | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` — `findOne`(783)→404(786)→self-check(792)→owner 403(797)→`assertAdmin`(803). 같은 파일의 다른 Admin+ 메서드(`addMemberByEmail`:256, `updateMemberRole`:306)는 `assertAdmin` 을 가장 먼저 호출 | `assertAdmin`(또는 최소 멤버십 확인)을 `findOne` 직후, 비즈니스 로직 이전으로 이동. 이번 PR 범위 밖 — 별도 트래커 항목으로 등재 권장 |
| 2 | 동시성/DB | owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이에 동시 `transferOwnership()` 이 대상을 owner 로 승격시키면 owner 가 삭제될 수 있음 (security/requirement/database/concurrency 4개 리뷰어 공통 지적, 이번 PR 이 만든 결함 아님 — 실측 재현·트래커 등재·의도적 유예 완료) | `codebase/backend/src/modules/workspaces/workspaces.service.ts:797`(owner 가드) ~ `:822`(`delete`) 사이 무락 구간, 자기-인지 주석 `:817-821` | 이번 PR 스코프 밖으로 유지(판별자 오염 방지 논리 타당). 후속 PR 에서 `delete({..., role: Not('owner')})` + 0행 시 재조회로 원인(행없음 vs owner변경) 분기하는 후보 처방(이미 `spec-draft-nullable-notation-followups.md` 등재)을 반드시 닫을 것 |
| 3 | 유지보수성 | `removeMember()` 안에서 `MEMBER_NOT_FOUND` `NotFoundException` 리터럴이 두 번(`:788`, `:828`) 중복됨 — 같은 문제를 형제 PR(#1371 `schedules.service.ts`, #1372 `integrations.service.ts`)이 이미 `throwXNotFound()` 헬퍼로 추출한 선례가 있는데 이번 PR 만 따르지 않음 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:788`, `:826-831` | `private throwMemberNotFound(): never { throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', ... }); }` 로 추출해 두 판정(및 `updateMemberRole():312` 등)에서 재사용 |
| 4 | 유지보수성/테스트 | 테스트 헬퍼 `getAudit()` 가 같은 파일에 바이트 단위로 동일하게 두 번 정의됨(형제 `describe` 블록이 서로 지역 함수를 공유 못 해서 복제) | `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1154`(기존), `:1458`(신규) | 최상위 `describe('WorkspacesService', ...)` 스코프로 한 번만 끌어올려 두 지역 정의 제거 |
| 5 | 테스트 | `removeMember()` 에 대해 "요청자가 admin/owner 가 아니면 `ADMIN_REQUIRED` 로 거부하고 `delete` 를 타지 않는다"를 검증하는 테스트가 신규 describe 블록에도, 파일 전체에도 없음 — `assertAdmin` 을 `delete` 뒤로 옮기는 회귀를 잡을 테스트가 없음 | `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1453`(describe 블록) / 구현: `workspaces.service.ts:803` | `wireFindOne` catch-all 을 `{ role: 'editor' }` 로 오버라이드하고 `memberRepo.delete` 미호출을 단언하는 테스트 추가 |
| 6 | 문서화 | API 계약 변경(동시 DELETE 진 쪽 404)이 그 엔드포인트를 서술하는 spec 문서에 아직 반영되지 않음 (이미 트래커에 등재돼 후속 planner 턴으로 넘겨진 상태, 재확인 성격) | `spec/2-navigation/9-user-profile.md §6.1`, `spec/data-flow/12-workspace.md §1.6` vs `workspaces.service.ts:822-831` | 이번 PR 을 막을 사유는 아님. `api-convention.md §3` 각주 작업 집행 시 이 두 문서도 함께 갱신되도록 트래커 항목 실행 여부만 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 전반 | 원자적 `DELETE`+`affected===0` 명시 비교가 `null`/`undefined`(드라이버 미보고) 오탐을 방지하도록 설계됐고, 대조군 테스트(`it.each([[undefined],[null]])`)가 그 회귀(`!affected` 로 되돌리는 뮤턴트)를 정확히 겨냥함(security/requirement/testing/concurrency/database 공통 확인) | `workspaces.service.ts:826`, `workspaces.service.spec.ts:1518-1531` | 없음 — 현행 유지 |
| 2 | 부작용 | 동시 DELETE 패자가 200→404 로 바뀌는 것은 의도된 변경(형제 5건과 동일 패턴), 감사 이벤트 미기록도 의도됨 | `workspaces.service.ts:822-838` | 없음 — SPEC-DRIFT 항목으로 이미 추적 |
| 3 | 데이터베이스 | 감사 로그 기록이 `DELETE` 와 별도 커밋(best-effort)인 것은 모듈 전체 기존 관례(`leaveWorkspace():671` 등)와 일치 | `workspaces.service.ts:822-837` | 없음 |
| 4 | 테스트/동시성 | e2e(`member-remove-concurrency.e2e-spec.ts`) 는 행 락(`FOR UPDATE`)+`Promise.race` 공허성 가드로 결정적 레이스를 재현하고, 커넥션·트랜잭션 정리(`finally`+`ROLLBACK`)도 적절함 | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:88-118, 167-193` | 없음 |
| 5 | 스코프 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 fix 와 무관한 백로그 3건(auth-configs/model-config/webauthn) 추가는 코드 스코프 확장이 아니며 형제 PR 5건이 반복해 온 관례와 일치 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 없음 |
| 6 | 문서화 | `removeMember()` JSDoc 이 형제 메서드(`assertWorkspaceDeletable`, `transferOwnership`)만큼 동시성 계약을 요약하지 않음(사소) | `workspaces.service.ts` `removeMember()` 상단 JSDoc | 한 문장 추가 고려(급하지 않음) |
| 7 | 유지보수성 | 신규 e2e 파일 안 두 테스트가 "락 대기→공허성 가드→COMMIT→정리" 오케스트레이션 블록을 거의 그대로 반복 | `member-remove-concurrency.e2e-spec.ts:88-117, 167-193` | `raceConcurrentRequests()` 류 헬퍼로 추출 고려(급하지 않음) |
| 8 | 유지보수성 | 신규 describe 블록 로컬 상수(`WS`, `MEMBER_ID`, `REQUESTER`)가 파일의 기존 camelCase 컨벤션과 다름 | `workspaces.service.spec.ts:1454-1456` | camelCase 통일 고려(급하지 않음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 신규 권한검사 순서 결함(WARNING) + owner TOCTOU 재확인(WARNING) |
| requirement | LOW | idempotency 표 SPEC-DRIFT, owner TOCTOU 재확인 |
| scope | NONE | codebase 변경 3파일로 정확히 국한, 스코프 이탈 없음 |
| side_effect | LOW | 관측 가능 API 동작 변경(200→404)은 의도적, owner TOCTOU 폭 불변 |
| maintainability | LOW | `NotFoundException` 리터럴 중복 + `getAudit()` 중복 정의(WARNING 2건) |
| testing | LOW | `ADMIN_REQUIRED` 거부 테스트 부재(WARNING), 나머지 커버리지 양호 |
| documentation | LOW | spec 문서(9-user-profile/data-flow) 미반영(WARNING), 그 외 문서화 품질 높음 |
| database | LOW | owner TOCTOU 재확인(WARNING), 인덱스·트랜잭션·SQL 인젝션 문제 없음 |
| concurrency | LOW | owner TOCTOU 재확인(WARNING), 핵심 수정 자체는 견고 |

## 발견 없는 에이전트

해당 없음 — 실행된 9개 에이전트 모두 최소 1건 이상의 발견사항(WARNING 또는 INFO)을 보고했다.

## 권장 조치사항

1. **(신규, 최우선)** `removeMember()` 권한 검사 순서 결함을 트래커에 신규 등재 — `assertAdmin` 을 `findOne` 직후로 이동하는 후속 작업 필요(security WARNING #1)
2. `removeMember()` 의 `ADMIN_REQUIRED` 거부 테스트 추가 — 권한 검사가 삭제 이후로 밀리는 회귀를 잡을 유일한 안전망(testing WARNING #5)
3. `MEMBER_NOT_FOUND` 리터럴을 `throwMemberNotFound()` 헬퍼로 추출 — 형제 PR(#1371, #1372) 선례를 따를 것(maintainability WARNING #3)
4. `getAudit()` 테스트 헬퍼 중복 정의를 최상위 `describe` 스코프로 통합(maintainability WARNING #4)
5. `spec/2-navigation/9-user-profile.md §6.1`, `spec/data-flow/12-workspace.md §1.6`, `spec/5-system/2-api-convention.md §3` 갱신을 트래커 실행 시 누락 없이 처리 확인(documentation WARNING #6, SPEC-DRIFT #1)
6. owner 승격 TOCTOU 처방(`role: Not('owner')` + 0행 시 재조회)을 후속 PR 로 반드시 닫을 것 — 이미 재현·설계 완료(WARNING #2, 우선순위 유지)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(비관련 영역으로 판정, 상세 사유 비제공) |
  | architecture | 라우터 판단(비관련 영역으로 판정, 상세 사유 비제공) |
  | dependency | 라우터 판단(비관련 영역으로 판정, 상세 사유 비제공) |
  | api_contract | 라우터 판단(비관련 영역으로 판정, 상세 사유 비제공) |
  | user_guide_sync | 라우터 판단(비관련 영역으로 판정, 상세 사유 비제공) |
