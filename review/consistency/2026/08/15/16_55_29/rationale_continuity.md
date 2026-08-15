# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 대상 변경 요약

이번 diff(`origin/main...HEAD`)에서 `spec/5-system/` 아래 실제로 변경된 문서는
`spec/5-system/4-execution-engine.md` 한 곳뿐이다 (9줄, `finalizeStalledExhausted` 관련
2곳). 대응 구현은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
의 `finalizeStalledExhausted()` — BullMQ stalled 재배달 소진 시 `Execution` FAILED UPDATE
와 자식 `NodeExecution` cascade UPDATE 를 **각각 autocommit** 으로 실행하던 것을
`dataSource.transaction()` 단일 트랜잭션으로 묶었다.

## 발견사항

검토 관점 1~4(기각 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회) 기준으로
CRITICAL·WARNING 은 발견되지 않았다.

- **[INFO] 이번 변경은 기존 Rationale 을 뒤집는 것이 아니라 기존 원칙에 정합시키는 방향**
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 인용문 + `## Rationale` "dead-letter
    마감의 원자성 (2026-08-15 원자화)" 항목 (diff 상 라인 851, 1464-1471)
  - 과거 결정 출처: 같은 문서 §1.1 "**원자성 보장**" (`running ↔ waiting_for_input` 전이는
    짝이 되는 `NodeExecution` 상태 변경과 **단일 DB 트랜잭션**으로 묶여 commit/rollback,
    WS 이벤트는 트랜잭션 commit 후 발행) — 이 문서 전체에 반복되는 "Execution↔NodeExecution
    짝 전이는 원자적이어야 한다" 는 확립된 설계 원칙이다. 자매 함수
    `cancelParkedExecution`/`markWebChatIdleTimeout` 도 이미 이 원칙을 따르고 있었다
    (코드 확인: `git grep -n "dataSource.transaction" codebase/backend/src/modules/execution-engine/execution-engine.service.ts`).
  - 상세: `finalizeStalledExhausted` 만 이 원칙에서 벗어나 있던 것이 진짜 결함이었고, 이번
    변경은 그 이탈을 닫아 확립된 원칙에 정합시킨 것이다. "결정의 번복"이 아니라 "누락된
    적용의 완성"이라 별도 Rationale 신설이 필요한 유형이 아니지만, 실제로는 spec Rationale
    에 "2026-08-15 원자화" 항목을 신설해 근거·자매 대칭·이전 실패 모드를 명시했고, 본문
    §7.1 인용문도 함께 갱신했다 — Rationale 갱신 의무(검토 관점 3)를 충족한다.
  - 제안: 없음(이미 적절히 처리됨).

- **[INFO] `finalizeStalledExhausted` 의 함수 레벨 `try/catch` 부재(자매와의 유일한 차이)가
  spec Rationale 에는 반영되지 않음**
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeStalledExhausted()` JSDoc ("함수 레벨 `try/catch` 는 의도적으로 없다 — 자매
    둘과 다른 유일한 점이다")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장"(WS 이벤트는
    트랜잭션 commit 후 발행) — try/catch 유무 자체를 규정하는 조항은 없다.
  - 상세: 이 설계 선택(트랜잭션 실패를 삼키지 않고 유일 호출부 `ExecutionRunProcessor.onFailed`
    의 `.catch()` 에 위임)은 코드 확인 결과(`execution-run.processor.ts:88` `void
    this.engine.finalizeStalledExhausted(executionId).catch(...)`) 사실과 일치하고, 회귀
    테스트(`트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다`)로 잠겨 있어
    은폐된 결정은 아니다. 다만 이 divergence 는 spec `## Rationale` 신규 항목에는 명시되지
    않고 코드 JSDoc 에만 있다 — 자매 함수들의 에러 처리 방침과의 대칭/비대칭이 spec 레벨
    invariant 로 문서화되어 있지 않다는 점에서 완전성 개선 여지가 있다(위반은 아님).
  - 제안: 향후 자매 함수 에러 처리 정책을 한 번에 정리할 기회가 있으면
    `spec/5-system/4-execution-engine.md` Rationale 에 "세 자매의 에러 전파 정책 비교" 한
    줄을 추가하는 것을 고려. 이번 PR 범위를 넓힐 필요는 없다.

- **[INFO] `claimResumeEntry` 의 lock 순서 역전은 이번 PR 의 대상이 아니며, spec Rationale
  미기재 상태로 별도 트래커에 정당하게 유예됨**
  - target 위치: 코드(`execution-engine.service.ts`, `claimResumeEntry`) — 이번 diff 는
    해당 함수를 건드리지 않음
  - 과거 결정 출처: 없음(이번에 `spec-sync-external-interaction-api-gaps.md` 에 신규
    등재된 항목, `16_44_28` concurrency W1)
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout`/`finalizeStalledExhausted` 세
    자매는 이제 모두 `Execution → NodeExecution` 순서로 잠그는데 `claimResumeEntry` 만
    반대 순서다. "선존 결함, 이 PR 이 만들지 않았고 오히려 세 번째를 자매와 같은 방향으로
    맞춰 일관성이 개선됐다"는 tracker 서술이 코드 근거(잠금 순서 비교표)와 일치한다.
    fail-closed/무한 재배달 없음(`maxStalledCount:1`) + Postgres 자동 데드락 검출을 근거로
    비차단 처리한 것은 이 저장소의 "유예 근거는 실측해야 한다" 관행에 부합한다. 이는 target
    diff 의 범위 밖이라 CRITICAL/WARNING 사유가 아니다.
  - 제안: 없음(추적됨, 정상 defer).

## 요약

이번 target 변경은 `spec/5-system/4-execution-engine.md` 의 확립된 원자성 원칙(§1.1 "짝
전이는 단일 트랜잭션")을 위반하지 않고, 오히려 그 원칙을 아직 따르지 않던 유일한 함수
(`finalizeStalledExhausted`)를 자매 두 함수(`cancelParkedExecution`,
`markWebChatIdleTimeout`)와 동일 패턴으로 정합시켰다. 과거 Rationale 에서 명시적으로
기각된 대안을 재도입한 흔적, 합의된 설계 원칙을 우회한 흔적, 근거 없이 과거 결정을
뒤집은 흔적은 발견되지 않았다. 새로 도입한 세부 설계(트랜잭션 내 두 UPDATE, 커밋 후
emit, 함수 레벨 try/catch 부재)는 코드 JSDoc·spec Rationale·plan 문서(`eia-stalled-atomicity.md`,
`spec-sync-external-interaction-api-gaps.md`)에 걸쳐 일관되게 근거가 기록되어 있고, 새로
발견된 부수 이슈(lock 순서 역전, 실 DB 롤백 e2e 부재)는 범위 밖으로 명시적으로 분리해
별도 트래커에 정당한 사유와 함께 등재했다.

## 위험도
NONE
