# 신규 식별자 충돌 검토 — spec-update-execution-engine-pr4

## 대상
- target: `plan/in-progress/spec-update-execution-engine-pr4.md`
- 적용 대상: `spec/5-system/4-execution-engine.md` (§7.1/§7.2/§7.5/§8/§9.2/§9.3/§2.13/Rationale)
- 검토 모드: `--spec`

## 검토 요약 (사전 판단)

본 target 은 **신규 식별자를 도입하지 않는다**. PR4 구현(`feat(06-concurrency): PR4 BullMQ stalled 자동 재배달`, 이미 착지)이 사용한 기존 코드 식별자를, PR1~PR3 시점에 "Planned(PR4 target)" 로 spec 에 예고돼 있던 자리에 "구현 완료" 로 flip 하는 **순수 상태 정합화(status reconciliation)** 문서다. 편집 목록(E1~E8)에 등장하는 모든 핵심 토큰 — `WORKER_HEARTBEAT_TIMEOUT`, `recoverStuckExecutions`, `maxStalledCount`, `exec:run:seq`, `execution-run` 큐, `finalizeStalledExhausted`, `redriveStuckExecution`, `recordRunningSegmentStart` — 은 이미 spec 본문(PR3 단계) 및 구현 코드(`codebase/backend/src/modules/execution-engine/`)에 **동일한 의미로 선재**한다. 코드베이스 조회 결과 실제 신규 도입 지점(`ExecutionRunDlqMonitorService`, `EXECUTION_RUN_DLQ_*` env var 등)도 target 문서가 새로 짓는 것이 아니라 이미 구현된 코드 사실을 spec 본문에 반영하는 것뿐이다.

## 발견사항

검토 관점 1~6 을 개별 적용한 결과, CRITICAL/WARNING 은 없음. 참고용 INFO 만 기록한다.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의는 "새 식별자" 가 아니라 "기존 예약어의 의미 활성화"
  - target 신규 식별자: 없음 (기존 에러 코드 재사용)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:827` (attempts 소진 행, "PR4 target"), `:1302`, `:1470` (Rationale, "PR4 stalled 모델 예약어")
  - 상세: PR3 기간에는 미발동 예약어였고, target 은 이를 "PR4 부터 발동" 으로 전환한다. 동일 문자열이 시간에 따라 발동 조건만 바뀌는 것이라 충돌이 아니라 예정된 계승이다. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2754` 의 `finalizeStalledExhausted` 가 이미 이 코드로 `failed` 마킹하는 구현을 갖고 있어 코드-스펙 간 의미도 일치.
  - 제안: 변경 불필요. (참고로만 기록)

- **[INFO]** `exec:run:seq` — "PR4 활성화" 서술을 "PR4 에서도 미사용 유지" 로 정정하는 것은 식별자 충돌이 아니라 값(활성화 여부)의 정정
  - target 신규 식별자: 없음 (기존 Redis 키 네임스페이스, §9.2:1117)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:410, 1117, 1136` — "PR4 에서 활성화" 로 예고돼 있던 자리
  - 상세: target(E6)은 이 키가 여전히 미사용임을 명시해 실제 코드(`redriveStuckExecution`/`recordRunningSegmentStart` 가 jobId=executionId 를 그대로 재사용, seq 미사용)와 정합시킨다. 이름 자체의 재사용·충돌이 아니라 "예약만 되고 활성화되지 않은 키" 로 정정하는 것이라 새 식별자 문제 없음.
  - 제안: 변경 불필요.

- **[INFO]** `ExecutionRunDlqMonitorService` / `EXECUTION_RUN_DLQ_*` — target E2/E8 이 언급하는 "execution-run DLQ 모니터"는 기존 `ContinuationDlqMonitorService` 와 병렬 명명이나 이미 코드에 별도 존재
  - target 신규 식별자: 없음 (target 은 서비스명을 명시하지 않고 "DLQ 모니터" 라는 일반 서술만 추가)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts`, `.config.ts` (PR4 구현, 이미 착지) — env var `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` / `EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS` / `EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS` / `EXECUTION_RUN_DLQ_MONITOR_ENABLED`. `ContinuationDlqMonitorService` (`continuation/continuation-dlq-monitor.service.ts`) 와 네임스페이스가 `EXECUTION_RUN_*` vs `CONTINUATION_*` 로 명확히 분리돼 있어 실질 충돌 없음.
  - 상세: target 문서는 이 서비스/ENV 이름을 spec 본문에 아직 inline 하지 않는다("관측성은 execution-run DLQ 모니터로 도입" 정도의 산문 서술). 실제 spec 반영 시(§9.3 큐 카탈로그 또는 §Rationale) 이 서비스명·env var 를 명시적으로 기입한다면, 기존 §9.3(`ContinuationDlqMonitorService`, :1146) 표와 나란히 두어 두 모니터가 대상 큐(`execution-run` vs `execution-continuation`)만 다를 뿐 동일 패턴임을 분명히 하는 것이 좋다.
  - 제안: spec 본문 반영(향후 developer 작업) 시 `ExecutionRunDlqMonitorService` 명칭과 4개 ENV 키를 §9.3 표에 명시적으로 추가해 `ContinuationDlqMonitorService` 항목과 대구를 이루게 할 것을 권고(현 target draft 자체에는 반영 의무 없음 — 이번 draft 스코프 밖).

- **[INFO]** 파일 경로 — target 은 신규 spec 파일을 만들지 않음
  - target 신규 식별자: 없음. `spec_impact: spec/5-system/4-execution-engine.md` 단일 기존 파일만 대상.
  - 상세: 명명 컨벤션(`N-name.md`, 영역 폴더 내 상세 spec) 을 따르는 기존 파일의 in-place 편집이라 파일 경로 충돌 관점에서 문제 없음.
  - 제안: 없음.

## 점검 관점별 결론

1. 요구사항 ID 충돌 — 해당 없음 (target 은 신규 요구사항 ID 를 부여하지 않음, 순수 구현상태 마커 flip)
2. 엔티티/타입명 충돌 — 해당 없음 (신규 엔티티·DTO·인터페이스 없음)
3. API endpoint 충돌 — 해당 없음 (신규 endpoint 없음)
4. 이벤트/메시지명 충돌 — 해당 없음 (BullMQ job/큐 이름은 기존 `execution-run`/`execution-continuation` 재사용, 신규 이벤트명 없음)
5. 환경변수·설정키 충돌 — 해당 없음. 관련 신규 ENV(`EXECUTION_RUN_DLQ_*`)는 이미 코드에 구현·네임스페이스 분리돼 있고 target 은 이를 새로 짓지 않음(위 INFO 참고)
6. 파일 경로 충돌 — 해당 없음

## 요약

target 문서는 이미 착지한 PR4 구현을 기술하기 위해 spec 의 "Planned" 마커를 "구현 완료" 로 전환하는 순수 정합화 작업이며, 새로 도입하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV 키·파일 경로가 전혀 없다. 편집이 다루는 모든 식별자(`WORKER_HEARTBEAT_TIMEOUT`, `recoverStuckExecutions`, `maxStalledCount`, `exec:run:seq`, `execution-run` 큐, `finalizeStalledExhausted`, `redriveStuckExecution`, `recordRunningSegmentStart`)는 기존 spec 본문과 이미 구현된 코드 양쪽에 동일한 의미로 선재하며, target 의 변경은 "값"(Planned→구현 완료, 활성화 여부, 발동 시점)만 갱신한다. 신규 식별자 충돌 관점에서 BLOCK 사유 없음.

## 위험도
NONE
