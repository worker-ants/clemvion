# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없음. `finalizeStalledExhausted` 트랜잭션 원자화 자체(핵심 로직·spec 동기화·자매 함수 패턴 재사용)는 정확하나, 테스트 커버리지 갭(WHERE 절 미검증) 과 문서화 선례 미준수(CHANGELOG·JSDoc·공유 헬퍼 우회)가 WARNING 4건으로 확인되어 testing/documentation 리뷰어 판정(MEDIUM)을 그대로 채택.

> 강제(router_safety) 화이트리스트: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 결과 확보됨 — forced 미이행 항목 없음. `maintainability.md` 파일이 디스크에 없었으나(reviewer 가 하네스 지시에 따라 Write 를 생략) 인라인 전문이 authoritative 로 제공되어 이번 통합 직전 그 경로에 영속화 완료. 누락으로 인한 판정 공백 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | NodeExecution cascade UPDATE 의 WHERE 가드 조건(`execution_id`, `status = :running`)이 어떤 assertion 으로도 검증되지 않음 — mutation(WHERE 값 치환)으로 생존 실측 확인(GREEN 유지). 값이 잘못돼도(오타·다른 컬럼) 스펙은 계속 통과 | `execution-engine.service.spec.ts:4992-5000` (assertion 부재), 소스 `execution-engine.service.ts:3391-3392` | `expect(nodeQb.where).toHaveBeenCalledWith(...)` / `expect(nodeQb.andWhere).toHaveBeenCalledWith(...)` 추가 |
| 2 | Documentation | `CHANGELOG.md` 에 이번 수정 항목 누락 — 동일 결함 계열("짝 전이(Execution↔NodeExecution) 원자성" 수정)을 매번 `## Unreleased —` 로 기록해 온 이 파일의 확립된 선례를 어김 | `CHANGELOG.md` (신규 항목 부재), 관련 코드 `execution-engine.service.ts:3334-3413` | "`finalizeStalledExhausted` 부분 커밋 시 NodeExecution 영구 RUNNING 잔류 결함 수정" 항목 추가(수신자 영향: 없음) |
| 3 | Documentation | `finalizeStalledExhausted` JSDoc 헤더가 트랜잭션 원자화 사실·근거를 기록하지 않음 — 동일 수정을 받은 자매 함수 `cancelParkedExecution`(`:1017-1021`)은 JSDoc 에 남겼는데 이 함수는 인라인 주석(`:3342-3345`)에만 남겨 문서화 깊이가 다름 | `execution-engine.service.ts:3315-3333` | `cancelParkedExecution` 선례 형식으로 JSDoc 문단 추가 |
| 4 | Maintainability / Testing / Documentation (통합) | 이번 diff 가 도입한 공유 헬퍼 `installStalledTx` 를, 그 헬퍼가 검증하려는 바로 그 명제를 가장 직접 단언하는 신규 첫 테스트가 재사용하지 않고 동일 mock 셋업(qb shape·`txSpy`·`managerCqb`·트랜잭션-밖-throw 무장)을 26~45줄 그대로 복제. 뒤 두 테스트는 정상 재사용. 같은 PR 계열 자매 트래커에 이미 등재된 "신규 테스트가 공유 헬퍼 우회" 패턴의 재발 | `execution-engine.service.spec.ts:4914-4939`(~4960), 헬퍼 정의 `:4879-4905` | `const { execQb, nodeQb, txSpy, managerCqb } = installStalledTx(1);` 로 교체 + `emitSpy` 만 별도 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SQL 인젝션 표면 없음 — 두 UPDATE 모두 TypeORM 파라미터 바인딩만 사용, 문자열 결합 없음 | `execution-engine.service.ts:3348-3395` | 조치 불요 |
| 2 | Security | 트랜잭션화는 보안이 아닌 무결성 개선이나, 부분 커밋으로 인한 orphaned RUNNING 상태(잠재적 좀비 실행 악용 여지)를 줄이는 방향으로 공격 표면을 늘리지 않음 | `execution-engine.service.ts` `finalizeStalledExhausted` 전체 | 조치 불요 |
| 3 | Documentation | "30줄 아래" 주석 표현이 실측(48줄)과 괴리 — PR 이전부터 부정확했던 선재 결함이나, 이번 diff 가 트랜잭션 클로저로 코드를 옮기며 거리가 44→48줄로 더 벌어짐. 이번 diff 변경분 안에 포함된 코드라 지금이 저비용 수정 시점 | `execution-engine.service.ts:3384-3386` | 줄 수 의존 표현 제거 또는 실측치로 갱신 |
| 4 | Concurrency / Database / Testing (통합) | mock 은 "두 UPDATE 가 같은 트랜잭션 manager 를 탄다"는 전제만 검증하고, 실제 롤백(둘째 UPDATE 실패 시 첫째가 커밋되지 않음)은 검증하지 못함 — 테스트 주석이 이 한계를 스스로 명시. 이 저장소의 기존 관례(자매 함수도 동일하게 unit mock 한정)와 일치해 회귀는 아님 | `execution-engine.service.spec.ts:4912-4913` | 실 DB integration/e2e 테스트 1건(둘째 UPDATE 강제 실패 → 첫째 UPDATE 미커밋 확인) 추가 권장(선택) |
| 5 | Maintainability / Database (통합) | `finalizeStalledExhausted` 는 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)와 달리 함수 레벨 `try/catch` 없이 트랜잭션 예외를 그대로 호출자에 전파 — 다만 유일 호출부(`execution-run.processor.ts` `onFailed`)가 `.catch()` 로 이미 흡수해 최종 동작은 동등. pre-existing 비대칭이며 같은 세션 consistency-check 가 이미 "조치 불요(선택)" 로 판정 | `execution-engine.service.ts:3334-3413` (try/catch 부재), 대조 `:1023`, `:1152` | 필요 시 docstring 에 "caller 의 `.catch()` 가 흡수" 한 줄 명시(선택), 또는 반대 방향 계약을 잠그는 테스트 1건 추가(선택) |
| 6 | Database | 인덱스/N+1/마이그레이션/스키마/커넥션 관리/대량 데이터 관점 전부 문제 없음 확인 — `NodeExecutionStatus` composite partial index(`V095`)가 cascade UPDATE WHERE 절을 정확히 커버 | `execution-engine.service.ts:3348-3395`, `V095__node_execution_exec_status_active_index.sql` | 조치 불요 |
| 7 | Requirement | 신규 첫 테스트가 `installStalledTx` 헬퍼를 재사용하지 않는 지점의 최초 발견(WARNING #4 로 통합됨) | `execution-engine.service.spec.ts:4914` | WARNING #4 참조 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션 표면 없음, 민감정보 노출 없음, 신규 보안 결함 없음 |
| requirement | NONE | 기능·엣지케이스·에러경로·spec fidelity 전부 일치. 헬퍼 미재사용 INFO 1건만 |
| scope | NONE | diff 13개 파일이 `git diff --stat` 과 정확히 일치, 단일 hunk 로 범위 이탈 없음 |
| side_effect | NONE | 함수 시그니처·이벤트 payload·no-op 관측 동작 모두 유지, 신규 전역상태/부작용 없음 |
| maintainability | LOW | 공유 헬퍼 미재사용(WARNING), try/catch 위치 비대칭(INFO) |
| testing | MEDIUM | NodeExecution WHERE 가드 미검증(WARNING, mutation 실측), 헬퍼 미재사용(INFO), 롤백 미검증(INFO) |
| documentation | MEDIUM | CHANGELOG 누락(WARNING), JSDoc 미갱신(WARNING), 헬퍼 우회 재발(WARNING), 주석 거리 오차(INFO) |
| database | LOW | 인덱스·트랜잭션·SQL 인젝션 모두 견고, 에러 흡수 위치 차이만 INFO |
| concurrency | LOW | 락 순서·멱등성·race-safety 문제 없음, 롤백 mock 미검증만 INFO |
| user_guide_sync | NONE | doc-sync-matrix 20개 행 전부 미매칭 — 사용자 가시 동작(에러코드/메시지/UI) 불변 확인 |

## 발견 없는 에이전트

security, requirement(Critical/Warning 없음 — INFO 1건은 WARNING #4 로 흡수), scope, side_effect, user_guide_sync

## 권장 조치사항
1. NodeExecution cascade UPDATE 의 WHERE 절(`execution_id`, `status = :running`) 에 대한 assertion 을 신규 테스트에 추가한다 — mutation 으로 생존이 실측된 유일한 실질 커버리지 갭이다.
2. 신규 첫 테스트(`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`)를 `installStalledTx(1)` 재사용으로 교체해 26~45줄 mock 중복을 제거한다.
3. `CHANGELOG.md` 에 이번 원자성 수정 항목을 추가하고, `finalizeStalledExhausted` JSDoc 헤더에 자매 함수(`cancelParkedExecution`) 선례와 같은 형식으로 원자화 근거 문단을 추가한다.
4. (선택) "30줄 아래" 주석을 줄 수 비의존 표현으로 정정하고, 실 DB 기반 롤백 검증 e2e 1건을 백로그에 남긴다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 가 diff 스코프(DB 트랜잭션 원자화, 단건 UPDATE 2회)에서 성능 영향 낮다고 판단해 제외 |
  | architecture | 구조 변경 없음(기존 자매 함수 패턴 재사용, 신규 아키텍처 결정 없음)으로 router 가 제외 |
  | dependency | 의존성 추가/변경 없음으로 router 가 제외 |
  | api_contract | 공개 API/DTO/컨트롤러 변경 없음으로 router 가 제외 |