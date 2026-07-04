# 유지보수성(Maintainability) Review — PR4 stalled-job 일원화 + 관측성

- Target 파일 범위: `codebase/backend/src/modules/execution-engine/**` (module, service, service.spec, queues/*), `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/test/execution-stalled-redelivery.e2e-spec.ts`
- `plan/**`, `review/**`, `spec/**` diff 는 문서 변경(코드 아님)이라 본 관점 리뷰에서 제외.

## 발견사항

- **[INFO]** `finalizeStalledExhausted` 와 `executionRunProcessor.onFailed` 사이의 이중 조건부 no-op 방어 로직이 두 파일에 분산돼 있어, 왜 두 실패 경로("setup-throw" vs "stalled 소진")가 하나의 조건부 UPDATE 로 분기되는지 이해하려면 두 파일(`execution-run.processor.ts` JSDoc + `execution-engine.service.ts` `finalizeStalledExhausted` JSDoc)을 같이 읽어야 함
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:790-802`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:257-266`
  - 상세: 두 JSDoc 모두 동일한 내용("(1) setup-throw 는 이미 terminal이라 no-op, (2) stalled 소진만 발동")을 각자 서술한다. 사실 자체는 정확하고 중복 서술이 오히려 각 파일 단독으로도 이해 가능하게 해주는 트레이드오프이므로 문제라기보다는 참고 사항.
  - 제안: 특별한 조치 불요. 향후 세 번째 소비자가 생기면 SoT 를 한쪽(예: service 쪽 JSDoc)으로 모으고 processor 쪽은 링크만 남기는 것을 고려.

- **[INFO]** `runExecutionFromQueue` 의 PENDING/RUNNING/terminal 3-way 분기가 순차 `if` 로 작성되어 있어 조건 분기 자체는 얕지만(중첩 1단계), "3-way switch"라는 설계 의도가 주석에는 명시되는데 실제 코드는 switch 문이 아닌 개별 if-return 나열이라 진입점이 하나 더 늘어날 경우(예: 향후 4번째 status) 가독성이 떨어질 잠재 소지
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3133-3151`
  - 상세: 현재는 RUNNING 분기 처리 후 `return`, 그 다음 `!== PENDING` 이면 ack-discard 후 `return`, fall-through 로 PENDING 정상 처리. 3-way 라는 프레이밍과 실제 코드(guard-clause 연쇄)가 살짝 어긋나지만 가독성 자체는 여전히 양호(각 분기 3~10줄, 중첩 없음).
  - 제안: 현재 3-way 로 충분히 읽히므로 즉시 수정 불필요. 4번째 상태 분기가 추가되는 시점에 `switch (execution.status)` 로 리팩터링 고려.

- **[INFO]** `finalizeStalledExhausted` 내 하드코딩 문자열 `'WORKER_HEARTBEAT_TIMEOUT'` 이 두 곳(Execution/NodeExecution set)에서 리터럴로 중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:275`, `:298`
  - 상세: 동일 에러 코드 문자열이 인접한 두 `.set({...})` 호출에 각각 리터럴로 등장. 이미 코드베이스에 `error-codes.ts` 류 상수 카탈로그가 존재한다면(다른 곳에서 `WORKER_HEARTBEAT_TIMEOUT` 참조 여부 미확인) 상수화가 더 안전하나, 기존 코드베이스에서도 이 에러 코드가 리터럴 문자열로 쓰이는 관례일 가능성이 있어(§Rationale·spec 인용에서도 문자열로 지칭) 심각한 이슈는 아님.
  - 제안: 기존 `WORKER_HEARTBEAT_TIMEOUT` 사용처(다른 파일)와 동일한 패턴을 따르고 있는지만 확인. 이미 리터럴 관례라면 그대로 두어도 무방.

- **[INFO]** `ExecutionRunDlqMonitorService` 의 `checkOnce` 가 in-flight 가드(`this.checking`)·조회 실패 처리·threshold 비교·cooldown 판정을 한 함수에 담아 함수 하나가 여러 책임을 겸함
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:642-688`
  - 상세: 47줄로 과도하게 길지는 않으나 (1) 겹침 방지, (2) 큐 조회 + 에러 삼킴, (3) 알람 판정 + cooldown, (4) 로깅 네 가지 책임이 한 메서드에 있음. 다만 `ContinuationDlqMonitorService` 와 "동일 패턴"임을 문서화하고 있으므로(주석 참조) 기존 코드베이스 관례를 그대로 따른 것으로 보이며, 함수 길이·중첩(2단계 try 중첩)은 읽기에 무리 없는 수준.
  - 제안: 현재 크기에서는 분리 불필요. `ContinuationDlqMonitorService` 와 완전히 동일한 구조라면 두 서비스 간 공통 로직(threshold/cooldown 판정)을 공유 헬퍼로 추출하는 리팩터링을 향후 고려 가능(현재는 아직 2번째 인스턴스라 DRY 위반이라 보기엔 이름·상수만 다른 정도).

- **[INFO]** 매직 넘버 `30_000`(stalled interval), `20`/`60_000`/`300_000`(DLQ 모니터 기본값)이 상수/설정값으로 잘 명명되어 있고 JSDoc 으로 근거(BullMQ 기본값과 정렬, KB 참조)가 남아 있어 매직넘버 문제 없음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:922`, `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts:401-410`
  - 상세: 긍정적 발견 — 상수명 자체가 의미를 드러내고(`EXECUTION_RUN_STALLED_INTERVAL_MS`), 주석에 왜 그 값인지(BullMQ 기본 30s, KB 선례) 근거가 남아 있음.
  - 제안: 없음(양호 사례로 기록).

- **[INFO]** `DISABLED_VALUES = new Set(['false', '0', 'no', 'off'])` 와 `parsePositiveInt` 의 정규식 사전검증 방식은 기존 `ContinuationDlqMonitorService`/`loadContinuationDlqMonitorConfig` 패턴과 동일한 스타일(주석에서도 명시)로, 코드베이스 컨벤션 일관성이 잘 유지됨
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts:395, 420-424`
  - 상세: 긍정적 발견.
  - 제안: 없음.

- **[INFO]** 네이밍 일관성 양호 — `finalizeStalledExhausted` 는 기존 `finalizeRehydrationCleanup`/`recordRunningSegmentStart`/`redriveStuckExecution` 계열 네이밍 컨벤션(동사+명사, 책임을 함수명에서 바로 유추 가능)을 그대로 따름
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:267`
  - 상세: 긍정적 발견 — 새 함수가 기존 함수군과 동일한 어휘·형태(동사원형 시작, PascalCase 아님 camelCase, 목적어로 상태를 표현)를 따라 코드베이스 전체 일관성을 해치지 않음.
  - 제안: 없음.

- **[INFO]** `executions.controller.ts` 의 e2e 전용 backdoor 엔드포인트가 기존 `_test/recover-stuck-executions` 와 동일한 게이팅 패턴(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'`)을 재사용해 일관성 유지
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:945-965`
  - 상세: 긍정적 발견 — 새 테스트 훅이 기존 컨벤션을 그대로 복제해 추가 학습 비용이 없음. JSDoc 에 "프로덕션 표면 아님"이 명시돼 있어 의도도 명확.
  - 제안: 없음.

## 요약

이번 PR4 변경분은 전반적으로 유지보수성이 양호하다. 신규 함수(`finalizeStalledExhausted`, `ExecutionRunDlqMonitorService`, `loadExecutionRunDlqMonitorConfig`)는 각각 하나의 책임에 집중되어 있고 길이도 적절(50줄 내외)하며, 중첩 깊이도 2단계를 넘지 않는다. 네이밍은 기존 코드베이스의 `finalize*`/`record*`/`redrive*` 관례와 `ContinuationDlqMonitorService` DI 패턴을 충실히 재사용해 일관성이 높고, 매직 넘버는 모두 명명된 상수 + 근거 주석으로 뒷받침된다. `runExecutionFromQueue` 의 3-way 분기와 `finalizeStalledExhausted`/`onFailed` 간 이중 방어 로직에 약간의 문서 중복·프레이밍 불일치가 있으나 심각한 가독성 저해는 아니며, 전부 INFO 수준에 그친다. Critical/Warning 급 유지보수성 이슈는 발견되지 않았다.

## 위험도

NONE
