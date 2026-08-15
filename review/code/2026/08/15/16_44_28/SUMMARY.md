# Code Review 통합 보고서

## 전체 위험도
**LOW** — `finalizeStalledExhausted` 를 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)와 동형으로 `dataSource.transaction()` 원자화한 순수 하드닝 변경. CRITICAL/WARNING 급 코드 결함은 없음. WARNING 2건 모두 문서/후속 추적 성격(코드 자체를 되돌릴 필요 없음). forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | 신규 `finalizeStalledExhausted` 트랜잭션이 Execution→NodeExecution 순서로 잠그는데, 같은 파일 `claimResumeEntry` 는 반대 순서(NodeExecution→Execution)로 같은 두 테이블을 잠근다 — 교차 함수 lock-order 역전으로 인한 데드락 잠재 표면(다중 브랜치 실행에서 한쪽이 stalled 소진 중, 다른 쪽이 동시에 재개될 때). 기존에도 `cancelParkedExecution`/`markWebChatIdleTimeout` 대 `claimResumeEntry` 사이에 있던 패턴이며 이번 PR 이 세 번째 참여자를 추가. PostgreSQL 자동 데드락 검출 + 신규 실패-전파 테스트로 hang·유령 상태는 없음(기능 차단 사유 아님) | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357` (`finalizeStalledExhausted`) vs `:1259` (`claimResumeEntry`) | JSDoc 에 `claimResumeEntry` 와의 잠금 순서 역전 가능성 한 줄 명시, 장기적으로 파일 전체 잠금 순서 불변식 통일을 후속 트래커에 등재 |
| 2 | documentation | `plan/in-progress/eia-stalled-atomicity.md` 의 "판별력(뮤테이션)" 감사 표가 라운드 1 시점(2개 뮤턴트)에 멈춰 있고, 이후 2라운드에서 추가로 잠근 3개 뮤테이션 계약(Execution `WHERE id` 변조 RED, cascade WHERE 가드 변조 RED, 트랜잭션 예외 삼킴 RED)을 반영하지 못함 — 같은 문서 하단 "체크리스트" 절(3라운드 조치 완료로 정확히 기록)과 내용상 어긋남. 정본 트래커(`spec-sync-external-interaction-api-gaps.md:275-279`)도 같은 한 세대 뒤처진 인용을 물려받음 | `plan/in-progress/eia-stalled-atomicity.md:55-60`(판별력 절) vs `:77-78`(체크리스트 절); `plan/in-progress/spec-sync-external-interaction-api-gaps.md:275-279` | 판별력 표에 3개 행 추가(Execution WHERE id 변조 → RED 2/2, cascade WHERE 변조 → RED, 트랜잭션 중간 실패 삼킴 → RED, 각 RESOLUTION.md 참조 링크 포함). 정본 트래커도 누적 결과 한 줄 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 트랜잭션 도입으로 DB 왕복 2회 증가(성공 경로 2→4회) + `Execution` row 락 보유 시간 소폭 연장 — 콜드 경로(워커 크래시 stalled 소진)에서만 발동, 밀리초 단위, 자매 함수와 동일 트레이드오프 | `execution-engine.service.ts:3357-3405` | 조치 불필요, 정확성이 명백히 우선 |
| 2 | side_effect | `logger.warn` 타이밍이 "부분 상태에서도 찍힐 수 있던 지점"에서 "완전 커밋 확인 후"로 이동 — 회귀 아니라 이 PR 이 고치는 결함과 같은 창을 관측성 측면에서도 닫는 개선 | `execution-engine.service.ts:3408-3410` | 조치 불필요 |
| 3 | testing | "트랜잭션 중간 실패" 테스트가 둘째 UPDATE(NodeExecution) reject 만 커버, 첫째(Execution) 단독 실패는 별도 exercised 안 됨(코드 경로는 동일해 실질 위험 낮음) | `execution-engine.service.spec.ts:5029` | 우선순위 낮음, 필요 시 `installStalledTx` 파라미터 확장 |
| 4 | testing / database | 실 DB 트랜잭션 롤백 자체(부분 커밋 실제 방지)는 mock 레벨로는 미검증 — 이미 정본 트래커(`spec-sync-external-interaction-api-gaps.md` W1, `16_19_57`)에 별도 e2e 항목으로 등재됨 | `execution-engine.service.spec.ts:4877` | 이번 diff 스코프 아님, 조치 불요(기등재) |
| 5 | maintainability | 신규 테스트 3곳이 `emitExecution` spyOn 셋업(8~10줄)을 각각 반복 — 파일 전역 기존 관례와 동일, 이번 diff 의 새 회귀는 아님. 같은 파일에 로컬 헬퍼 선례(`emitSpy`) 존재 | `execution-engine.service.spec.ts:4916-4927, 5034-5045, 5056-5067` | 선택적: describe 스코프에 `emitSpy` 헬퍼 추출 |
| 6 | maintainability | 트랜잭션 클로저 골격(Execution UPDATE → affected=0 조기 return → duration 추출 → NodeExecution cascade UPDATE → 플래그)이 3개 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`, `finalizeStalledExhausted`)에서 거의 동일 형태로 반복 | `execution-engine.service.ts:3357-3405` (+ 자매 두 함수) | 이번 diff 범위 밖, plan 문서에 "관용구 헬퍼 추출" 이미 defer 등재 |
| 7 | requirement | 이론적 race(부팅 backstop `recoverStuckExecutions` 와의 좁은 창)는 이번 diff 가 만들거나 넓힌 것이 아니라 JSDoc 에 이미 "수용됨"으로 명시된 기존 노출 — 두 자식 UPDATE 사이 원자성만 다루는 이번 diff 의 범위 밖 | `execution-engine.service.ts:3336-3343` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 파라미터 바인딩만 사용, 신규 취약점 없음 |
| performance | NONE | DB 왕복 2회 증가·락 보유 소폭 연장(콜드 경로, 무시 가능) |
| requirement | NONE | 목적(부분 커밋 방지) 완전 달성, 454/454 테스트 통과 + 뮤테이션 재현 확인 |
| scope | NONE | 변경이 단일 함수/단일 describe 블록에 정확히 한정, 프롬프트 밖 이탈 없음 |
| side_effect | NONE | 관측 가능한 동작 전부 유지, 새 전역상태·부작용 없음 |
| maintainability | LOW | 헬퍼 재사용 WARNING(이전 라운드) 해소 확인, INFO 2건(테스트 반복·3중 골격 반복) |
| testing | LOW | 이전 라운드 갭 전부 해소, INFO 2건(비대칭 커버리지·실DB 미검증) |
| documentation | LOW | 판별력 감사 표가 라운드 1에 머물러 체크리스트와 불일치 (WARNING) |
| database | NONE | 인덱스 커버 확인, 트랜잭션·파라미터 바인딩 정상, 스키마 변경 없음 |
| concurrency | LOW | `claimResumeEntry` 와의 잠금 순서 역전 잠재 표면 (WARNING, 기존 패턴 확장) |
| user_guide_sync | NONE | 매트릭스 20 trigger 중 매칭 1건(spec-major-change), 이미 이행 확인 |

## 발견 없는 에이전트

security, performance, requirement, scope, side_effect, database, user_guide_sync — CRITICAL/WARNING 없음(INFO 또는 전무).

## 권장 조치사항

1. (선택, 후속 트래커) `finalizeStalledExhausted` JSDoc 에 `claimResumeEntry` 와의 잠금 순서 역전 가능성을 한 줄 명시하고, 파일 전체 잠금 순서 통일을 별도 항목으로 등재.
2. (선택, 문서 hygiene) `plan/in-progress/eia-stalled-atomicity.md` "판별력(뮤테이션)" 표에 이후 2라운드에서 검증된 3개 뮤테이션 계약(Execution WHERE id, cascade WHERE 가드, 트랜잭션 예외 삼킴)을 추가해 체크리스트 절과 정합화. 정본 트래커의 동일 인용도 함께 보강.
3. 위 두 항목은 코드 자체의 결함이 아니라 관찰성/문서 hygiene 개선이므로 이번 PR 을 막을 필요는 없음 — 다음 라운드 또는 후속 세션에서 처리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff(단일 함수 트랜잭션 원자화)는 아키텍처 변경 표면 없음 |
  | dependency | 신규 패키지/버전 변경 없음 |
  | api_contract | 공개 API·컨트롤러·DTO 변경 없음(내부 서비스 함수, 유일 호출부는 BullMQ 이벤트 핸들러) |