# 문서화(Documentation) Review — exec-intake-pr4-stalled

- 대상: PR4 — BullMQ stalled-job 자동 재배달 + `execution-run` DLQ 모니터 + spec flip
- 리뷰 일시: 2026-07-04 13:08:20

## 발견사항

### WARNING — `buildExecutionRunJobId` 독스트링이 이 PR 이 정정한 seq/re-enqueue 모델과 모순 (오래된 주석)
- 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:48-57` (특히 55-57행), 참고로 동일 파일 `:15-18` "PR 범위" 블록도 동일 톤
- 상세: 이 PR 이 수정한 `spec/5-system/4-execution-engine.md` §9.2 (`exec:run:seq` 키 설명)은 "당초 'PR4 활성화' 스케치를 정정 — PR4 crash 재개는 **네이티브 BullMQ stalled 재배달(같은 jobId 재처리)**을 쓰므로 re-enqueue 가 없어 seq 가 여전히 불필요하다"고 명시적으로 correction 한다. `plan/in-progress/exec-intake-queue-impl.md`("설계" 1번 항목: "native stalled 채택 (핵심 단순화): `<executionId>:run:<seq>` re-enqueue 불요")도 동일하게 확정했다. 그런데 이 PR 이 실제로 수정한 `execution-run.queue.ts` 파일 안에서, 정작 `buildExecutionRunJobId` 함수의 독스트링(48-57행)은 여전히 "spec §4.2 의 `<executionId>:run:<seq>` 표기는 향후 **re-enqueue(PR3/PR4 crash 재개)** 시나리오를 위한 일반형이다 … 필요해지는 시점에 본 함수만 확장하면 된다"라고 남아 있어, PR4 가 실제로는 re-enqueue 를 도입하지 **않았다**(네이티브 stalled 재사용)는 이번 PR 자신의 결론과 반대로 읽힌다. 같은 파일 상단 모듈 독스트링(15-18행) "PR3/PR4: crash RUNNING 재개(멱등 rehydration) + BullMQ stalled-job 일원화" 도 PR3/PR4 완료 시점 기준으로 과거형/완료형 갱신이 없어 로드맵처럼 읽힌다.
- 제안: `buildExecutionRunJobId` 독스트링을 "PR4 는 네이티브 stalled 재배달(같은 jobId 재처리)을 채택해 이 seq 확장이 불필요해졌다 — `exec:run:seq` 키는 명시적 re-enqueue 를 도입하는 **미래** 변경에서만 활성화 예정(spec §9.2)"으로 정정. 상단 "PR 범위" 블록도 PR1/PR2/PR3/PR4 완료 상태를 반영해 갱신 권장.

### INFO — `ExecutionRunProcessor` 클래스 독스트링 제목이 "PR1" 로 고정, 본문만 PR4 갱신
- 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:14-31`
- 상세: 클래스 독스트링 첫 줄이 여전히 "PR1 — Execution Intake Worker."이고 그 아래 "crash 재개 (PR4): …" 단락이 덧붙는 형태다. 내용 자체는 정확하고 최신이나(§7.1/§7.4 정합 확인함), 제목이 PR1 시점에 고정돼 있어 이 클래스가 이제 crash-recovery 책임까지 갖는다는 것이 제목만 봐서는 드러나지 않는다. 저장소 관례상 "PRx — " 접두는 계속 레이어링되는 패턴(`execution-run.queue.ts` 등도 동일)이라 critical 은 아님.
- 제안: 원한다면 제목을 "PR1 — Execution Intake Worker (PR4 — crash 재개 확장)" 등으로 갱신. 선택사항.

### INFO — plan 체크박스 `[~]` 잔존 (완료 반영 전)
- 위치: `plan/in-progress/exec-intake-queue-impl.md:58` (`- [~] **PR4 — stalled-job 일원화 + 관측성**`)
- 상세: 코드(스탈드 재배달·DLQ 모니터·컨트롤러 훅·e2e)와 spec(§7.1/§7.2/§9.2/§9.3/error-codes/data-model/data-flow 5파일)이 모두 "완료"로 갱신됐고 consistency-check SUMMARY(`review/consistency/2026/07/04/12_57_25/SUMMARY.md` 등)도 통과했으나, 본 plan 파일의 PR4 체크박스는 진행중 표기(`[~]`)로 남아 있다. 프로젝트 관례(plan 체크박스 = 실제 상태 반영, PR 커밋에 포함)상 구현·리뷰·spec 반영이 끝나면 `[x]` + 완료 일자로 갱신하는 것이 기대된다.
- 제안: 본 PR 의 나머지 워크플로(ai-review 후속 fix, e2e 통과 확인) 종료 시점에 `[x]` 로 전환 + 완료 요약 한 줄 추가.

## 요약
전반적으로 문서화 품질이 매우 높다. 변경된 3개 핵심 모듈(`execution-engine.service.ts`/`execution-run.queue.ts`/`execution-run.processor.ts`)의 JSDoc 은 새 `finalizeStalledExhausted`·3-way switch(`RUNNING` 분기)·`maxStalledCount`/`stalledInterval` 변경의 이유·경계·인접 실패 경로와의 구분을 정확하고 상세히 설명하며, 신규 `ExecutionRunDlqMonitorService`/`execution-run-dlq-monitor.config.ts` 도 기존 `ContinuationDlqMonitorService` 패턴과의 관계를 명시한다. 5개 spec 파일(`4-execution-engine.md`, `1-data-model.md`, `3-error-handling.md`, `conventions/error-codes.md`, `data-flow/3-execution.md`)이 코드 변경과 함께 Planned→구현으로 전면 flip 됐고, `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의·`recoverStuckExecutions` backstop 병존·§9.2 seq 스케치 정정까지 촘촘히 반영됐다 — 이는 consistency-checker 가 이미 CRITICAL(spec 미전파)을 잡아내 해소시킨 결과로 확인된다. e2e 스펙(`execution-stalled-redelivery.e2e-spec.ts`)과 신규 `_test/simulate-execution-run-redelivery` 컨트롤러 엔드포인트도 시뮬레이션 필요성·게이팅 방식을 충분히 설명한다. 유일한 실질 갭은 이 PR 이 변경한 `execution-run.queue.ts` 자체에 남아 있는 `buildExecutionRunJobId` 독스트링(및 상단 모듈 코멘트)이 이번 spec 정정("네이티브 stalled = 같은 jobId 재처리, re-enqueue/seq 불요")과 어긋나는 오래된 서술을 그대로 두고 있다는 점이며, 이는 이 PR 의 범위 안에서 손쉽게 정합화할 수 있다. CHANGELOG.md 미갱신은 직전 PR3(#795) 등 동일 성격의 내부 엔진 신뢰성 변경들과 일관된 저장소 관례이므로 갭이 아니다.

## 위험도
LOW

STATUS: SUCCESS
