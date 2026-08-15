# Code Review 통합 보고서

## 전체 위험도
**LOW** — `finalizeStalledExhausted` 트랜잭션 원자화는 목적을 정확히 달성했고 CRITICAL 발견은 없다. 유일한 실질 갭은 트랜잭션 콜백 중간 실패(reject) 경로를 잠그는 테스트가 없다는 WARNING 1건(mock 레벨에서 지금 바로 닫을 수 있는 커버리지 갭). forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보 확인 — 강제 이행 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `finalizeStalledExhausted` 트랜잭션 콜백이 중간에 실패(reject)하는 경로를 잠그는 테스트가 없다 — 자매 `cancelParkedExecution`/`markWebChatIdleTimeout`은 이미 이 계약(예외를 삼키지 않고 그대로 던짐)을 잠그는 전용 테스트를 가지고 있다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4858`(`describe('finalizeStalledExhausted (PR4)'`) / 소스 `execution-engine.service.ts:3340`(`finalizeStalledExhausted`), 대조: `execution-engine.service.spec.ts:3383`(`cancelParkedExecution` 동형 테스트) | `nodeQb.execute` 를 `mockRejectedValue(...)` 로 무장한 뒤 `await expect(service.finalizeStalledExhausted(...)).rejects.toThrow(...)` + `emitSpy` 미호출을 단언하는 테스트 1건 추가. 실 DB 롤백 검증(별도 e2e, 이미 트래커 등재)과는 다른 층위 — 지금 mock 만으로 닫을 수 있는 갭 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / side_effect / documentation / maintainability | `finalizeStalledExhausted`는 함수 레벨 `try/catch`가 없어 DB 예외를 호출자에 전파한다 — 자매 두 함수와 형태가 다르지만, 유일 호출부(`execution-run.processor.ts:88` `onFailed` 의 `.catch()`)가 등가로 흡수해 기능 결함 아님. 이번 diff 가 만든 회귀가 아니라 이전 두 라운드(`16_04_38`)에서 이미 "무조치(선택)"로 dispositioned 됨 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3340`(`finalizeStalledExhausted`) | 필요하면 JSDoc 에 "에러 흡수는 caller 의 `.catch()` 가 담당 — 함수 레벨 try/catch 는 의도적으로 없음" 한 줄 추가. 기능 수정 불요 |
| 2 | maintainability | 신규 테스트 헬퍼 `installStalledTx` 만 트랜잭션-밖-접근 즉시 throw 로 무장하고, 자매 `installCancelTx`는 이 하드닝이 없어 두 헬퍼의 무장 수준이 비대칭 | `execution-engine.service.spec.ts:4879-4905`(`installStalledTx`) vs `:3281-3294`(`installCancelTx`) | 다음에 `cancelParkedExecution`/`markWebChatIdleTimeout` 테스트를 손댈 기회에 같은 throw 가드를 백포트해 세 헬퍼의 무장 수준을 동형으로 맞추는 것을 고려(이번 PR 범위 아님) |
| 3 | concurrency | `finalizeStalledExhausted`(조건부 UPDATE `WHERE status='running'`)와 부팅 backstop `recoverStuckExecutions`(re-claim UPDATE) 사이의 이론적 race — 트랜잭션화는 두 자식 UPDATE **사이**의 원자성만 추가했을 뿐 이 함수 **간** race 창은 그대로. 기존에 문서화·수용된 사안이며 이번 diff 로 확대되지 않음 | `execution-engine.service.ts:3331-3338`(JSDoc), 로직 3352-3400 | 조치 불요(기존 결정 유지) — 완전한 fencing(세그먼트-start/owner-token 영속화)은 이미 트래커에 defer 등재 |
| 4 | database / concurrency | 실 DB 트랜잭션 롤백(부분 커밋 방지의 실제 효과)은 여전히 mock 레벨(같은 manager 를 탄다는 전제까지만)로만 검증됨 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(`16_19_57` W1)에 별도 e2e 항목으로 등재됨 | `execution-engine.service.spec.ts` `installStalledTx` 및 사용처(:4914 등) | 이번 PR 범위에서 추가 조치 불요 — 재등재 불필요, 별도 e2e 트랙으로 후속 처리 예정 |
| 5 | side_effect | `logger.warn` 등 emit 시점이 "cascade UPDATE 실행 전"에서 "트랜잭션 커밋 후"로 이동 — 관측 가능한 최종 결과(이벤트 payload·상태)는 동일. 이 로그 문자열을 파싱하는 외부 코드는 발견되지 않음 | `execution-engine.service.ts` — `logger.warn` 및 `finalizeRehydrationCleanup`/`emitExecution` 블록(트랜잭션 콜백 종료 직후) | 없음(정보성). 외부 모니터링이 이 로그를 스크래핑한다면 별도 확인 필요 |
| 6 | testing | 신규 테스트 3건 중 첫 번째만 `emitSpy` 를 변수로 캡처하지 않아 `mockRestore()` 를 호출하지 않음(나머지 두 개는 호출) — 최상위 `beforeEach` 가 매 테스트 `service` 를 재생성해 실질 위험은 낮음 | `execution-engine.service.spec.ts:4914` vs `:4946`/`:5022` | 스타일 통일 권장, 우선순위 낮음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 파라미터 바인딩만 사용, 새 외부 입력·인증 경계·시크릿 없음 — 순수 내부 트랜잭션 원자성 리팩터 |
| requirement | NONE | 목표(부분 커밋 방지)를 정확히 구현, spec(§7.1+Rationale)과 line-level 일치, 이전 라운드 결함 해소 확인 |
| scope | NONE | diff 가 대상 함수·대상 `describe` 블록·1:1 대응 문서 갱신에 정확히 국한. plan 이관은 정당한 hygiene |
| side_effect | NONE | 실행 경로·이벤트 payload·전역 상태·시그니처 불변. 로그 타이밍 변화는 관측 결과 동일 |
| maintainability | LOW | 직전 라운드 WARNING 2건(주석 중복, WHERE 미검증) 해소 확인. 테스트 헬퍼 무장 수준 비대칭은 INFO |
| testing | LOW | 트랜잭션 wiring·WHERE 가드·no-op 커버리지 양호하나, 콜백 중간 실패 경로 테스트 갭 1건(WARNING) |
| documentation | NONE | CHANGELOG·JSDoc·spec §7.1+Rationale·plan 문서 전부 코드와 동기화, 이전 라운드 지적 전부 반영 확인 |
| database | NONE | 인덱스·트랜잭션·SQL 인젝션·마이그레이션 전부 영향 없음. WHERE 대상 일치 회귀 테스트로 보강 |
| concurrency | LOW | 락 순서·조건부 UPDATE 가드 동형 유지, 신규 race 없음. backstop 과의 기존 race 는 재확인만(INFO) |

## 발견 없는 에이전트

security, requirement, scope, side_effect, documentation, database

## 권장 조치사항

1. (testing WARNING) `finalizeStalledExhausted` 트랜잭션 콜백의 중간 실패(reject) 경로를 잠그는 mock 테스트 1건 추가 — `nodeQb.execute` 를 `mockRejectedValue`로 무장하고 `rejects.toThrow` + `emitSpy` 미호출 단언.
2. (선택, INFO #2) `installCancelTx`/`markWebChatIdleTimeout` 테스트 헬퍼에 `installStalledTx` 와 동일한 트랜잭션-밖-접근 throw 가드를 백포트해 세 자매 헬퍼의 무장 수준을 통일 — 이번 PR 범위 아님, 향후 해당 함수를 다시 손댈 때 고려.
3. (선택, INFO #1) `finalizeStalledExhausted` JSDoc 에 "에러 흡수는 caller 의 `.catch()` 가 담당"이라는 한 줄을 남겨 향후 재작업자의 "자매와 완전 동형" 오독 방지 — 기능 수정 불요.
4. (이미 트래커 등재, INFO #4) 실 DB 트랜잭션 롤백 e2e 검증은 `spec-sync-external-interaction-api-gaps.md` W1 로 이미 백로그에 있음 — 별도 조치 불요, 후속 세션에서 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨
  - **제외**: 5명 (사유는 라우터가 개별 전달하지 않음 — 이 diff 가 성능/아키텍처/의존성/외부 API 계약/사용자 가이드 표면과 무관하다는 라우터의 일반 판단으로 추정)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 미제공(라우터 판단 — 단건 조건부 UPDATE 트랜잭션화로 성능 표면 무관 추정) |
  | architecture | 사유 미제공(라우터 판단 — 기존 자매 함수와 동형 패턴 재사용, 신규 아키텍처 결정 없음 추정) |
  | dependency | 사유 미제공(라우터 판단 — 신규 패키지·버전 변경 없음 추정) |
  | api_contract | 사유 미제공(라우터 판단 — 공개 API·시그니처 불변 추정) |
  | user_guide_sync | 사유 미제공(라우터 판단 — 내부 서비스 메서드, 사용자 가이드 대상 아님 추정) |