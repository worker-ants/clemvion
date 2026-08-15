# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md` (`finalizeStalledExhausted` 트랜잭션화)

## 검토 범위 확인

target diff(`origin/main...HEAD`)의 실질 변경은 다음 셋으로 좁다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`
  의 Execution `FAILED` UPDATE + 자식 `NodeExecution` cascade UPDATE 를 `dataSource.transaction()` 으로
  묶음(종전엔 각각 autocommit). 반환 shape(`RETURNING duration_ms` → wire `durationMs`)·에러 코드
  (`WORKER_HEARTBEAT_TIMEOUT`)·트리거 조건(`status='running'` 조건부, stalled 재배달 attempts 소진)은
  **불변**.
- `spec/5-system/4-execution-engine.md` — 위 변경을 §7.1 도입부 한 문장 + Rationale 항목으로 반영(신규
  엔티티·필드·엔드포인트·요구사항 ID·상태 전이·권한 모델 없음).
- `plan/in-progress/eia-stalled-atomicity.md`(신규) — 작업 단위 트래커. `plan/in-progress/eia-db-wire-invariant.md`
  는 완료 이관(`plan/complete/`)됨.

새 엔티티/필드/엔드포인트/요구사항 ID/상태 전이/RBAC 규칙은 도입되지 않았다 — 이번 변경은 기존에 이미
문서화된 상태 전이(`running → failed`, `WORKER_HEARTBEAT_TIMEOUT`)의 **쓰기 원자성**만 강화한다.

## 다른 spec 영역과의 대조

- **에러 코드/HTTP 계약** (`spec/5-system/3-error-handling.md:104`, `spec/conventions/error-codes.md:70`,
  `spec/1-data-model.md:473`) — `WORKER_HEARTBEAT_TIMEOUT` 의 트리거 조건·코드명·"부팅 recoverStuckExecutions
  re-drive 는 이 코드 미사용" 서술이 target 변경 후에도 그대로 유효. 트랜잭션화는 이 코드가 **발행되는지
  여부**를 바꾸지 않고 발행 **후 DB 상태의 일관성**만 바꾼다 — 충돌 없음.
- **data-flow 미러** (`spec/data-flow/3-execution.md:252,267,298`) — `running --> failed:
  WORKER_HEARTBEAT_TIMEOUT` 전이·"재배달 소진 시 `finalizeStalledExhausted` 가 `failed`+
  `WORKER_HEARTBEAT_TIMEOUT`" 서술 모두 유효하며 모순 없음. 다만 이 파일은 자매 함수
  `cancelParkedExecution`/`markWebChatIdleTimeout` 의 트랜잭션 여부도 애초에 명시하지 않는 서술
  깊이라(§2.1 Schema 매핑이 컬럼 read/write 단위이지 함수별 원자성 단위가 아님), `finalizeStalledExhausted`
  의 신규 원자성도 언급하지 않는 것이 **기존 문서 깊이와 정합**한다 — 갱신 누락이 아니라 일관된 생략.
- **취소 규약** (`spec/conventions/node-cancellation.md`) — `finalizeStalledExhausted` 는 이 문서의
  매트릭스·Rationale 어디에도 등장하지 않는다. 이는 실수가 아니라 `--impl-prep`(`15_54_20`) 라운드에서
  이미 검토된 결정이다 — "이 함수는 워커 크래시→FAILED 경로지 취소가 아니므로 `node-cancellation.md`
  가 아니라 `4-execution-engine.md` §7.1 (진짜 SoT)에 기록"(`plan/in-progress/eia-stalled-atomicity.md`
  체크리스트). 스코프 판단이 문서화돼 있고 target 도 그 판단을 따랐다 — 충돌 없음.
- **대시보드 지표** (`spec/2-navigation/0-dashboard.md:166`) — `finalizeStalledExhausted` 가 `FAILED`
  를 오염시켜 `avgExecutionTime` 계산에서 제외한다는 서술은 **상태값**(`FAILED`) 근거이지 원자성과
  무관 — target 변경으로도 상태값은 동일하므로 이 서술은 그대로 유효.
- **EIA 종결 이벤트 payload** (`spec/5-system/14-external-interaction-api.md:790-798`) — `error.code`
  `null` 허용 목록에 있는 "무조건 붙는 `WORKER_HEARTBEAT_TIMEOUT`" 서술, `durationMs` wire 필드 모두
  target 변경 후에도 동일 값·동일 조건으로 emit(트랜잭션 커밋 **이후** best-effort emit — 종전과 같은
  순서). 충돌 없음.

## 관찰 사항 (참고용 — 등급 미달)

- **선존 lock-order 역전, 이 PR 범위 밖**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  가 새로 등재한 항목("`claimResumeEntry` 만 두 테이블을 반대 순서로 잠근다")에 따르면, 이번에 세
  자매(`cancelParkedExecution`/`markWebChatIdleTimeout`/`finalizeStalledExhausted`)가 모두
  `Execution → NodeExecution` 순서로 통일된 반면 `claimResumeEntry` 는 `NodeExecution → Execution`
  역순이라 이론적 lock-order 데드락 표면이 있다. `spec/5-system/4-execution-engine.md` §7.5 는 이
  역전을 언급하지 않는다. 이는 **이번 target diff 가 만든 문제가 아니고**(세 번째를 나머지와 맞춘
  것이라 오히려 개선), 이미 plan 트래커에 별도 항목으로 등재·리뷰어 동의하에 비차단으로 defer 됐다
  — cross-spec CRITICAL/WARNING 대상 아님. spec 본문에 한 줄 캐비엇을 추가하면 향후 재발견 비용을
  줄일 수 있다는 점만 기록한다(등급 부여 안 함, target 필수 아님).

## 요약

target(`spec/5-system/4-execution-engine.md`)의 변경은 이미 문서화된 상태 전이·에러 코드·이벤트 payload
계약을 그대로 둔 채 내부 쓰기 원자성만 강화한 매우 좁은 범위의 수정이며, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 모순되지 않는다. `node-cancellation.md`
스코프 배제·data-flow 미러 생략 깊이 모두 기존 관행과 정합하고, 유일하게 눈에 띄는 인접 이슈
(`claimResumeEntry` lock-order 역전)는 이 PR 범위 밖의 선존 사안으로 이미 별도 트래킹됐다.

## 위험도

NONE
