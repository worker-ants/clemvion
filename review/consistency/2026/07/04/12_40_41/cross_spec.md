# Cross-Spec 일관성 검토 — spec-update-execution-engine-pr4

target: `plan/in-progress/spec-update-execution-engine-pr4.md` (spec draft, spec_impact: `spec/5-system/4-execution-engine.md`)

## 발견사항

- **[CRITICAL]** `WORKER_HEARTBEAT_TIMEOUT` PR4 상태 flip 이 4개 다른 spec 문서에 미반영 — self-contradictory spec 트리 발생
  - target 위치: 편집 목록 E7/E8 (§2.13, Rationale) — `spec/5-system/4-execution-engine.md` 만 편집 대상
  - 충돌 대상:
    - `spec/1-data-model.md:469` (§2.13 Execution.error 필드) — `WORKER_HEARTBEAT_TIMEOUT` 설명에 **"PR4 예약"**, **"PR3(2026-07-04)부터 … 이 코드는 PR3 기간 미발동"** 기술
    - `spec/5-system/3-error-handling.md:76` (§1.4 워크플로우 실행 에러 표) — 동일하게 **"PR4 예약 … PR3 기간 미발동"**
    - `spec/conventions/error-codes.md:63` (`WORKER_HEARTBEAT_TIMEOUT` 행) — **"(PR4 target) BullMQ stalled-job 재배달 attempts 소진 시 발동"** (미래형), "PR3 기간 발동하지 않는다" 명시
    - `spec/data-flow/3-execution.md:247, 262, 293` (§3.1 상태 다이어그램 + §3.1 에러 표 + §3.3 소스 표) — **"WORKER_HEARTBEAT_TIMEOUT 은 PR4 stalled 예약 — PR3 미발동"**, `recoverStuckExecutions` 행 설명에 "BullMQ stalled 자동 재배달·WORKER_HEARTBEAT_TIMEOUT 발동은 PR4" (미래형)
  - 상세: target 이 `4-execution-engine.md` 를 "PR4 구현 완료(2026-07-04)" 로 flip 하면, 위 4개 문서의 "PR4 예약(미래형)/PR3 기간 미발동" 서술이 즉시 stale·모순이 된다. `spec/1-data-model.md` §2.13 은 `4-execution-engine.md §7.1`(=target E2) 을 명시적으로 `[§7.1](...)` 링크로 참조하는 **동일 사실에 대한 cross-reference**이므로, 소스가 바뀌면 참조처도 반드시 같이 바뀌어야 한다. `error-codes.md`/`error-handling.md`/`data-flow/3-execution.md` 도 마찬가지로 같은 에러 코드·같은 PR 마커를 반복 서술한다 — 이 프로젝트의 "정보는 한 곳에만 두되 필요한 곳에서 참조" 원칙에 따라 여러 문서가 같은 사실을 각자 다른 문구로 복제해왔고, 그 복제본들이 이번 draft 범위 밖에 있다.
  - 제안: `spec_impact` 에 다음 4개 파일 추가 + 대응 편집 항목 신설:
    - `spec/1-data-model.md` §2.13 Execution.error — `WORKER_HEARTBEAT_TIMEOUT` 괄호 설명을 "PR4 예약 / PR3 기간 미발동" → "PR4 구현(2026-07-04): stalled 재배달 attempts 소진 시 발동" 으로.
    - `spec/5-system/3-error-handling.md` §1.4 — 동일 갱신.
    - `spec/conventions/error-codes.md` `WORKER_HEARTBEAT_TIMEOUT` 행 — "(PR4 target)" → "(PR4 구현, 2026-07-04)" 로, "발동하지 않는다" 문구 제거.
    - `spec/data-flow/3-execution.md` §3.1 mermaid 주석·에러 표·§3.3 `recoverStuckExecutions` 행 — "PR4 stalled 예약/PR3 미발동" → PR4 구현 완료 서술 + `recoverStuckExecutions` 은퇴 아님(backstop 유지) 반영. 이 파일은 특히 target 의 F1 정정(은퇴 아님)이 §3.3 표 문구("완전 대체는 PR4" 뉘앙스와 유사)에도 영향을 줄 수 있어 함께 봐야 함.

- **[WARNING]** `spec/data-flow/3-execution.md` §3.3 이 `recoverStuckExecutions` 를 "PR3 — re-drive" 단독 소스로만 표에 기재 — PR4 트리거 2종 모델 미반영
  - target 위치: E4 (§7.5 case B 트리거 2종화: 부팅 backstop + 운영 중 stalled 재배달)
  - 충돌 대상: `spec/data-flow/3-execution.md:287-294` §3.3 "비정상 종료 회수" 표 — 현재 소스가 `recoverStuckExecutions`(PR3) 와 `ShutdownStateService`(SIGTERM) 두 가지뿐이고, PR4 가 추가하는 "운영 중 stalled 재배달 → `runExecutionFromQueue` RUNNING 분기" 트리거가 표에 없음.
  - 상세: target 은 `4-execution-engine.md §7.5` 에 트리거 2종(부팅 backstop + 운영 중 재배달)을 명기하기로 했으나, data-flow 문서의 같은 표는 여전히 옛 2-소스 모델(re-drive PR3 + shutdown)만 나열해 "비정상 종료 회수" 전체 그림이 실제 구현과 어긋난다.
  - 제안: 표에 3번째 행(운영 중 BullMQ stalled 재배달 → RUNNING 분기 재구동) 추가, 또는 최소한 각주로 PR4 트리거를 언급.

- **[INFO]** `maxStalledCount` 큐 설정값 문서화가 `data-flow/3-execution.md:65` 에도 별도 존재 — target 편집 목록(E6, `4-execution-engine.md §9.3`)과 별개로 갱신 필요
  - target 위치: E6 (`maxStalledCount:0` → `1`, `4-execution-engine.md §9.3`)
  - 충돌 대상: `spec/data-flow/3-execution.md:65` — "**attempts: 1, maxStalledCount: 0** — BullMQ 자동 crash-retry 미도입 (PR1~PR3 무변경; 상향은 PR4)."
  - 상세: 이 문장은 정확히 target 이 다루는 `maxStalledCount` 값 변경(0→1)의 또 다른 서술처다. target 반영 후 이 줄이 "상향은 PR4"(미래형) 로 방치되면 §9.3 의 최신 값(1)과 모순된다.
  - 제안: E6 과 함께 이 줄도 "PR4 구현(2026-07-04): maxStalledCount=1 상향 완료" 로 갱신. `spec_impact` 에 `spec/data-flow/3-execution.md` 를 포함할 때 이 지점도 같이 처리하면 위 CRITICAL 항목과 통합 가능.

## 요약

target draft 자체(F1 backstop 유지, F-seq seq 미사용, Q2 defer, `WORKER_HEARTBEAT_TIMEOUT` PR4 재정의)는 `4-execution-engine.md` 내부적으로는 정합적이며 사용자 확정 사실과 일치한다. 그러나 이 spec 트리는 같은 `WORKER_HEARTBEAT_TIMEOUT`/`recoverStuckExecutions`/`maxStalledCount` 사실을 `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md` 4개 문서에 걸쳐 cross-reference 형태로 복제해 왔고, 이들 모두 "PR4 target/예약, PR3 기간 미발동" 이라는 지금은 stale 이 될 문구를 담고 있다. target 의 `spec_impact` 가 `4-execution-engine.md` 단독이라 이 4개 문서는 이번 반영에서 빠지며, 그 결과 반영 직후 spec 트리는 (a) execution-engine.md = "PR4 구현 완료" vs (b) 나머지 4개 문서 = "PR4 예약/미발동" 으로 명백히 자기모순 상태가 된다. 이는 이후 `/consistency-check --impl-done` 이나 코드 리뷰 시 재차 혼란을 유발할 소지가 크므로, 이번 draft 확정 전에 spec_impact 확장 + 대응 편집 항목을 추가하는 것을 강력히 권고한다.

## 위험도
HIGH
