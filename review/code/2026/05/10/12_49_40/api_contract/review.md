### 발견사항

- **[CRITICAL]** 웹훅 실행 시 `output` 구조 파괴적 변경 — 다운스트림 expression 무음 파손
  - 위치: `manual-trigger.handler.ts` execute(), `spec/4-nodes/7-trigger/1-manual-trigger.md §5.2`
  - 상세: 기존 `output.body` / `output.headers` / `output.query` / `output.method` (평탄 구조)가 `output.request.{body, headers, query, method}` (중첩 구조)로 이동. 기존 워크플로우에서 `$node["Manual Trigger"].output.body` 같은 expression을 사용하는 경우 런타임 오류 없이 `undefined`를 반환하게 된다. 실행 엔진이 expression 오류를 조용히 흡수한다면 실제 버그 발견이 지연될 수 있음.
  - 제안: 현재 배포된 워크플로우가 없거나 마이그레이션이 확정된 상황이라면 수용 가능. 그렇지 않다면 핸들러에서 `output.body` (deprecated), `output.request.body` (new) 두 경로를 동시 노출하는 경도기 grace period를 두거나, expression 정적 분석으로 영향 워크플로우를 사전 탐색해야 함.

- **[WARNING]** `runNow()` 와 cron 자동 실행을 `meta.source`로 구분 불가
  - 위치: `schedules.service.ts` runNow(), `schedule-runner.service.ts` process()
  - 상세: 사용자가 on-demand로 수동 실행한 경우(`POST /schedules/:id/run-now`)와 cron이 자동 실행한 경우 모두 `meta.source: 'schedule'`을 반환한다. 코멘트에서 "파라미터가 schedule-resolved이므로 source는 'schedule'"이라 정당화하지만, 다운스트림에서 실행 origin을 분기해야 할 경우 구분 수단이 없다.
  - 제안: `executedBy` 옵션이 `{ triggerId }` vs `{ executedBy }` 로 이미 구분되므로 `meta.source` 에 `'schedule_manual'` 값을 추가하거나, 실행 컨텍스트(`meta.executedBy`)를 별도 필드로 노출하는 방안 검토.

- **[WARNING]** `__triggerSource` 마커가 `execute()` 호출 계약에 암묵적으로 추가됨 — 타입 강제 없음
  - 위치: `hooks.service.ts`, `schedule-runner.service.ts`, `schedules.service.ts`, `workflows.controller.ts`
  - 상세: 4개 어댑터가 각각 마커를 수동으로 stamp한다. `ExecutionEngineService.execute()`의 두 번째 인수 타입이 `Record<string, unknown>`으로 추정되어 마커 누락 시 컴파일 오류가 없다. 새 어댑터 추가 시 마커 누락 가능성이 있으며, fallback 동작(`'manual'` 기본값)이 잘못된 `meta.source`를 무음으로 생성한다.
  - 제안: `execute()`의 두 번째 인수 타입에 `__triggerSource?: TriggerSource` 를 포함하는 전용 인터페이스(`WorkflowExecutionInput`)를 정의하여 타입 시스템이 계약을 강제하도록 변경.

- **[INFO]** Webhook 핸들러의 backward-resilient fallback은 좋은 설계이나 명시적 경고 로그가 없음
  - 위치: `manual-trigger.handler.ts` `detectTriggerSource()` 분기 2번
  - 상세: 마커 없이 transport 필드만 있는 경우 `'webhook'`으로 자동 감지한다. 테스트로 커버되어 있으나, 런타임에서 이 경로를 탔는지 알 수 없다.
  - 제안: `Logger.warn('__triggerSource marker missing, detected source by transport shape')` 추가하면 어댑터 미스를 운영 단계에서 발견 가능.

- **[INFO]** 외부 HTTP API(`POST /hooks/:path`, `POST /workflows/:id/execute`) 응답 구조는 변경 없음
  - 위치: `hooks.service.ts`, `workflows.controller.ts`
  - 상세: 두 엔드포인트 모두 `{ executionId: string }` 반환 구조는 유지. 외부 API 클라이언트는 직접 영향받지 않음.

---

### 요약

외부 HTTP API 계약(`POST /hooks/:path` → `{ executionId }`, `POST /workflows/:id/execute` → `{ executionId }`)은 변경이 없어 API 클라이언트에 직접 영향은 없다. 그러나 **워크플로우 실행 출력 계약**이 파괴적으로 변경되었다 — 웹훅 트리거로 실행된 워크플로우에서 다운스트림 노드가 참조하는 `output.body` / `output.method` 등의 expression path가 `output.request.*`로 이동한다. 이는 기존 배포 워크플로우에 무음 파손을 유발할 수 있다. 내부 `__triggerSource` 마커 프로토콜은 타입 강제가 없어 새 어댑터 추가 시 누락 위험이 있으며, `runNow`와 cron 자동 실행을 `meta.source` 단일 필드로 구분할 수 없다는 점도 운영상 한계로 남는다.

### 위험도

**MEDIUM**