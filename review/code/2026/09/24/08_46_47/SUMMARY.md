# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 Critical/High 없음. 이번 라운드에서 새로 발견된 것은 WARNING 1건(중복 단위 테스트)뿐이고, 나머지는 전 라운드(`08_09_57`) WARNING 6건 중 5건의 해소 확인 + 기존에 이미 트래커 등재된 이슈(권한 검사 순서 오라클)의 재확인이다. **forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신규/기존 단위 테스트 두 블록(`'진 쪽은 404 이고 감사를 남기지 않는다'`, `'DELETE 시점에 행이 사라졌으면 404 다'`)이 이름·JSDoc 만 다를 뿐 mock 입력·단언이 완전히 동일하다. plan 의 뮤턴트 추적표(`member-owner-toctou.md` §E)에도 이 둘이 함께 필요한 근거가 없어, 한쪽만 갱신되고 다른 쪽이 낡아도 아무도 알아채지 못하는 silent drift 위험이 있다 | `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1534`, `:1609` | 둘 중 하나 제거(권장: 기존 블록 유지, 신규 블록 제거), 또는 서로 다른 관측(원래 계약 회귀 vs 행 소실 이유)을 검증하도록 분화 |
| 2 | Security (기존 결함, 이번 diff 회귀 아님) | `removeMember()` 의 owner 조기 가드가 `assertAdmin()`/멤버십 검사보다 먼저 실행돼, 워크스페이스 비-멤버를 포함한 임의 인증 사용자가 `403 CANNOT_REMOVE_OWNER` vs `403 ADMIN_REQUIRED` 응답 차이로 대상의 owner 여부를 오라클처럼 알아낼 수 있다. 1라운드부터 식별된 결함이며 이번 PR 이 만든 것도 고친 것도 아니다. 이미 정확한 블라스트 반경(비-멤버 포함 임의 인증 사용자)으로 `plan/in-progress/spec-draft-nullable-notation-followups.md` §F 에 등재돼 있어 이 PR 을 막을 사유는 아니다 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-372`(`@Roles()` 없음), `common/guards/roles.guard.ts`, `common/decorators/workspace.decorator.ts`, `workspaces.service.ts:818-827` | 후속 트래커 처리 시 `assertAdmin`(또는 최소 `assertMembership`) 을 owner 이른 가드보다 먼저 두는 순서 반전을 검토. 이번 PR 스코프 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Database | TOCTOU 수정의 원자성이 표준 SQL 이 아닌 Postgres 고유 EvalPlanQual(동시 UPDATE 에 대한 WHERE 재평가) 동작에 의존한다. 신규 재진입 e2e 로 결정적 검증은 됐으나, DB 엔진 교체 시 재검증이 필요한 구현 세부사항이다 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:841-858` | 현행 유지(plan §B 가 트랜잭션+락 대안을 실측 근거로 기각). DB 엔진 변경 계획 시 재검토 |
| 2 | Testing | `affected===0` 이후 재조회가 `workspaceId` 로도 좁혀 조회하지만(`memberRepository.findOne({where:{id, workspaceId}})`), 이를 직접 검증하는 단위 테스트가 없다 — `wireFindOne` 목이 `id` 만으로 라우팅해 `workspaceId` 필터 누락 회귀를 잡지 못한다. UUID PK 특성상 실무 위험은 낮음 | `workspaces.service.ts:863-865`, `workspaces.service.spec.ts:1483-1492` | (선택) `wireFindOne` 에 `where.workspaceId` 캡처 단언 추가 고려 |
| 3 | Side Effect | 신규 재진입 e2e 가 raw SQL 로 "owner 2명"(애플리케이션 코드로 도달 불가능한 상태)을 전용 워크스페이스(`createTeamWorkspace`)에 영구 커밋한다. 이전 라운드 WARNING(공유 workspace 오염)은 격리로 해소됐으나, 그 전용 워크스페이스 자체엔 명시적 cleanup 이 없다 | `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (신규 `it` 블록) | 조치 불요(격리로 blast radius 축소됨). 필요시 후속으로 테스트 종료 시 원상복구 고려 |
| 4 | Side Effect | `affected===0` 경로에서만 도는 추가 무락 DB 왕복 — 드문 레이스 한정, 데이터를 바꾸지 않아 부작용 없음 | `workspaces.service.ts:863-865` | 조치 불요 |
| 5 | Scope | `test/helpers/concurrency.ts`(`VACUITY_GUARD_MS` export) 와 `integration-rotate-concurrency.e2e-spec.ts` 1줄 변경은 이번 작업의 직접 대상(member 제거)이 아닌 rotate 동시성 파일을 건드리나, 같은 PR 사이클의 리뷰 피드백(하드코딩 상수 중복 제거) 반영으로 근거가 문서화돼 있고 변경 폭도 최소 | `test/helpers/concurrency.ts:31`, `integration-rotate-concurrency.e2e-spec.ts:9,121` | 조치 불요 |
| 6 | Maintainability | 재진입 락 오케스트레이션(`BEGIN`→`FOR UPDATE`→공허성가드→`COMMIT`→`finally` 드레인) 이 두 e2e 파일에 손으로 복제됐다. 다만 트래커에 "세 번째 자리가 생기면 추출" 이라는 임계값과 후보 이름까지 명시적으로 등재돼 있다 | `member-remove-concurrency.e2e-spec.ts:209-`, `integration-rotate-concurrency.e2e-spec.ts` | 조치 불요 — 세 번째 자리가 실제로 생길 때 재확인 |
| 7 | Maintainability | owner 승격/강등 단위 테스트 두 블록이 구조적으로 유사(값 하나만 다름)하나, 인접 JSDoc 이 서로 다른 뮤턴트(옛 분기 형태 복귀)를 겨냥해 의도적으로 분리됐음을 명시한다 | `workspaces.service.spec.ts:1561`, `:1589` | 현행 유지 권장 |
| 8 | Concurrency | `transferOwnership()` 독스트링("두 멤버를 단일 IN 쿼리로 락")이 실제 구현(순차 `pessimistic_write` 두 번)과 다르다. 이번 diff 범위 밖(미변경 코드)이며, 선행 `workspace` 행 락이 동시 이양을 직렬화해 실질 데드락 위험은 없음 — 전 라운드에서 이미 INFO 로 dispositioned | `workspaces.service.ts` (`transferOwnership()`) | 조치 불요 — 기존 처분 유지 |
| 9 | Requirement | `spec/data-flow/12-workspace.md:141`(멤버 제거 행)이 동시성 메커니즘을 규정하지 않는 것은 이번 PR 이 깨뜨린 서술이 아니라 기존 spec 공백이다(SPEC-DRIFT 아님 — 결과 수준 요구사항은 여전히 참). 형제 메서드 셋(`:188-189`)만 락 메커니즘을 명시하는 비대칭은 이미 planner 트래커에 등재됨 | `spec/data-flow/12-workspace.md:141,188-189` | 조치 불요 — 이미 별도 트래커 항목 |
| 10 | Documentation / Requirement | 에러코드 `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 미등재 — 기존 갭이며 이번 diff 가 만들지 않음. 이미 별도 트래커 항목으로 분리돼 있어 중복 지적 아님 | `spec/5-system/3-error-handling.md` §1 | 조치 불요 — 이미 별도 트래커 항목 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 원자적 DELETE 술어 자체는 안전(TypeORM 파라미터 바인딩). 기존 권한 검사 순서 오라클 재확인(WARNING, 이번 PR 스코프 아님) |
| requirement | NONE | TOCTOU 수정이 의도를 정확히 구현. 뮤턴트 3종+단위 4종+e2e 1종 전부 예측=실측, spec 결과 수준 불일치 없음 |
| scope | NONE | 핵심 diff 는 owner 가드 TOCTOU 해결에 엄격히 국한. 도메인 외 파일 변경 1건은 근거 문서화됨 |
| side_effect | LOW | 관찰 가능 동작 변경(동시성 창에서 200→403)은 의도된 계약 강화. e2e 잔여 상태는 격리로 완화됨 |
| maintainability | LOW | 전 라운드 WARNING 6건 중 5건 코드로 해소, 1건은 임계값 근거로 정당 유예. 남은 것은 전부 INFO |
| testing | LOW | 전 라운드 WARNING 대부분 해소 확인. 신규 발견: 완전 중복 단위 테스트 2블록(WARNING) |
| documentation | NONE | CHANGELOG 누락(전 라운드 WARNING) 정확히 해소. 코드/테스트 JSDoc 이 구현과 전부 일치 |
| database | LOW | 쿼리 형태·트랜잭션 경계·인덱스 영향 없음. Postgres EvalPlanQual 의존은 문서화된 트레이드오프 |
| concurrency | LOW | 신규 경쟁조건·데드락 없음. 제3 상태 분기 오류(전 라운드 WARNING) 해소 확인 |

## 발견 없는 에이전트

- documentation (Critical/Warning 없음 — 전 라운드 WARNING 해소 확인 및 구현-문서 일치 확인만 기록)

## 권장 조치사항

1. `workspaces.service.spec.ts` 의 완전 중복 단위 테스트 2블록(`:1534`, `:1609`) 중 하나를 제거하거나, 서로 다른 관측을 검증하도록 분화한다 — silent drift 방지 (WARNING #1).
2. 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` §F) 처리 시, `removeMember()` 의 owner 조기 가드보다 `assertAdmin`/`assertMembership` 을 먼저 두는 순서 반전을 검토한다 — 이번 PR 스코프 아님, 별도 작업으로 (WARNING #2).
3. (선택, 낮은 우선순위) `still` 재조회의 `workspaceId` 스코핑을 검증하는 단위 테스트를 보강해 멀티테넌시 경계 회귀 안전망을 추가한다.
4. (선택) 신규 재진입 e2e 가 격리 워크스페이스에 남기는 "owner 2명" 잔여 상태의 cleanup 을 후속으로 고려한다.
5. 재진입 락 오케스트레이션 보일러플레이트가 세 번째 자리에 등장하면 트래커에 명시된 대로 헬퍼(`reenterUnderHeldLock`)로 추출한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세는 routing 메타에 미제공, 스코프상 성능 영향 낮음으로 추정) |
  | architecture | 라우터 판단 — 단일 메서드 국소 수정으로 아키텍처 영향 낮음으로 추정 |
  | dependency | 라우터 판단 — 신규 의존성 추가 없음 |
  | api_contract | 라우터 판단 — 공개 API 시그니처/엔드포인트 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없는 백엔드 내부 수정 |