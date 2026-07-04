# 부작용(Side Effect) Review

## 리뷰 범위 확인

본 changeset 은 `spec/**/*.md` 5개 파일(`1-data-model.md`, `5-system/3-error-handling.md`,
`5-system/4-execution-engine.md`, `conventions/error-codes.md`, `data-flow/3-execution.md`)의
문서 갱신만 포함한다. `codebase/**` 하위 실제 코드 diff 는 이번 changeset 에 없다 — PR4 구현
자체(`dbc541602 feat(06-concurrency): PR4 BullMQ stalled 자동 재배달 …`)는 이 리뷰 대상 diff 이전
커밋에서 이미 반영됐고, 본 changeset 은 그 구현 상태를 spec 에 "Planned → 구현 완료" 로 동기화하는
후속 문서 커밋이다. 부작용 관점에서 런타임 동작을 바꾸는 코드 변경이 존재하지 않으므로, 문서가
서술하는 코드(런타임 부작용의 실제 소스)가 문서와 정합하는지, 그리고 사용자가 지목한 "이전 라운드
race finding" 이 코드 레벨에서 실질적으로 해소/완화됐는지를 교차 검증했다.

## 교차 검증 내역

- `finalizeStalledExhausted` (`execution-engine.service.ts:2763`) — `status='running'` 조건부
  UPDATE 로 setup-throw 종결 경로(`affected=0` no-op)와 stalled 소진 경로를 안전하게 분기.
  cascade 로 자식 `NodeExecution(RUNNING)` 도 함께 `FAILED` 처리해 유령 running 을 남기지 않음.
  스펙이 서술한 대로 코드 주석(`execution-engine.service.ts:2754-2761`)에 "이미 문서화된 zombie
  double-drive 노출과 동일 class, 신규 회귀 아님" 이 명시되어 있어 spec Rationale 서술과 1:1 일치.
- `runExecutionFromQueue` 의 RUNNING 분기(`execution-engine.service.ts:3151-3159`) — stalled
  재배달로 재진입 시 부팅 backstop 과 **동일한** `redriveStuckExecution` 을 재사용(신규 side-effect
  표면 추가 아님), `recordRunningSegmentStart` 로 §8 active-running baseline 보정도 부팅 경로와
  대칭적으로 수행.
- `execution-run.processor.ts` `onFailed` — `finalizeStalledExhausted` 호출을
  `void ... .catch(...)` 로 감싸 unhandled rejection 을 차단(기존 `recoverStuckExecutions`
  fire-and-forget 패턴과 동일 컨벤션).
- `ExecutionRunDlqMonitorService`/`execution-run-dlq-monitor.config.ts` — 실존 확인. env 값은
  config factory 에서만 읽고 서비스는 `process.env` 를 직접 접근하지 않음(spec 이 명시한
  "useFactory 주입, 서비스가 process.env 직접 접근 안 함" 과 일치).
- `exec:run:seq:<executionId>` 관련 서술 정정("PR4 활성화" → "PR1~PR4 미사용, 미래 예약") — 코드가
  jobId=executionId 고정이고 별도 re-enqueue/seq 로직이 없음을 확인, 서술 정정이 실제 구현과 부합.

이전 라운드에서 지적된 잔여 race(원 워커가 zombie 로 부활해 `recoverStuckExecutions` 부팅 backstop
과 `finalizeStalledExhausted` 가 같은 stale RUNNING row 를 두고 경합할 수 있는 극히 좁은 창)는:

- 코드 주석(`finalizeStalledExhausted` docstring, `redriveStuckExecution` 내부 주석)에 명시적으로
  문서화되어 있고, 완전 fencing 은 세그먼트-start/owner-token 영속(별도 defer 항목)에 의존한다고
  스스로 한계를 인정.
  - `finalizeStalledExhausted` 는 `status='running'` 조건부 단일 UPDATE 라 blast radius 가
    "정상 재구동 세그먼트를 오조기 종결" 범위로 bound 되어 있고(데이터 손상·이중 실행 증폭 아님),
    완료 노드는 `execution_node_log` 재생으로 보존되므로 심각도가 이미 완화되어 있음.
  - `maxStalledCount:1` 로 poison 세그먼트의 무한 재배달을 차단(bounded), 부팅 backstop 도
    boot-only 트리거라 tight-loop 우려 없음 — 두 트리거 모두 자연 rate-limit.
- spec Rationale (`4-execution-engine.md` "PR4 — BullMQ stalled 자동 재배달" 절, §7.5 case B 각주)
  에도 동일 내용이 서술되어 spec↔code 간 불일치 없음.

## 발견사항

없음(No findings).

- 본 changeset 자체는 코드 변경이 없는 spec 문서 동기화이므로 부작용(전역 상태·시그니처·인터페이스·
  환경변수·네트워크·이벤트/콜백) 관점에서 신규 위험이 도입되지 않았다.
- 문서가 서술하는 대상 코드(`execution-engine.service.ts`, `execution-run.processor.ts`,
  `execution-run-dlq-monitor.*`)를 실측 검증한 결과, 문서 서술과 실제 구현이 일치했고, 이전 라운드
  에서 지적된 race 는 코드 주석 + spec Rationale 양쪽에 이미 정확히 문서화되어 있으며 blast radius
  가 bound 된 수용 가능한 잔여 리스크로 판단된다(신규 결함 아님).

## 위험도

NONE

STATUS: SUCCESS
