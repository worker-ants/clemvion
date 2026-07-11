# Cross-Spec 일관성 검토 결과

対象: `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 / §R19 (공개 웹채팅 위젯 idle-wait execution 회수 reaper) — impl-done, diff-base=origin/main

## 발견사항

- **[WARNING]** `spec/5-system/16-system-status-api.md §1` 큐 레지스트리 표에 신규 큐 `webchat-idle-reaper` 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 / §R19 (구현 완료로 flip) + 구현 diff `system-status.constants.ts` (`MONITORED_QUEUES` 에 `WEBCHAT_IDLE_REAPER_QUEUE` 추가) + `test/system-status.e2e-spec.ts` (`EXPECTED_QUEUE_NAMES` 에 `webchat-idle-reaper` 추가)
  - 충돌 대상: `spec/5-system/16-system-status-api.md` §1 "대상 큐 레지스트리" 표 (17행, `webchat-idle-reaper` 없음)
  - 상세: 이번 PR 은 `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`(SoT)에는 `webchat-idle-reaper` 행을 정확히 추가했고(큐 수 17→18, `spec/data-flow/15-external-interaction.md`, `spec/5-system/3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md` 등 다른 관련 영역도 이미 EIA-RL-07/`WEBCHAT_IDLE_TIMEOUT` 참조로 잘 동기화돼 있음에도), `spec/5-system/16-system-status-api.md §1` 의 "모니터링 그룹·concurrency 관점 요약" 표는 갱신하지 않았다. 이 표는 코드 `MONITORED_QUEUES` 를 반영해야 한다는 것이 문서 자체 관례다 — 실제로 그 관례에 따라 기존에도 반대 방향 gap(코드에 `agent-memory-extraction` 미등재)이 인라인 "⚠ 구현 갭" 주석으로 명시 추적되고 있다. 이번 PR 로 코드 `MONITORED_QUEUES` 가 `webchat-idle-reaper` 를 새로 포함하게 되면서, 이제 방향이 반대인 새 gap(표에는 없고 코드에는 있음)이 생겼는데 이는 추적/플래그 되지 않았다. `group: "execution"|"knowledge-base"|"integration"|"system"` DTO 유니온 자체는 `system` 값을 이미 포함하므로 API 응답 계약이 깨지지는 않으나(순수 문서 표 누락), 운영자가 이 spec 표만 보고 모니터링 대상 큐 목록을 파악하면 신규 큐를 놓친다.
  - 제안: `spec/5-system/16-system-status-api.md §1` 표에 `| webchat-idle-reaper | system | 1 (기본) | ... ([EIA §3.4 EIA-RL-07 / §R19](./14-external-interaction-api.md)) |` 행을 추가하거나, 기존 `agent-memory-extraction` gap 과 동일한 방식으로 "⚠ 구현 갭" 주석에 병기해 명시적으로 추적한다.

- **[INFO]** `spec/1-data-model.md §2.13 Execution.error` 의 엔진 레벨 `error.code` 예시 열거에 `WEBCHAT_IDLE_TIMEOUT` 미포함
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `markWebchatIdleTimeout` — `error.code = 'WEBCHAT_IDLE_TIMEOUT'`
  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` 표의 `error` 필드 설명("엔진 인프라 차원의 코드를 포함한다 — `SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`")
  - 상세: 정면 모순은 아니다 — 이 목록은 이미 기존 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`, §8 admission 큐 대기 타임아웃)도 빠뜨린 비-완전 예시 열거이며, 실제 카탈로그 SoT 는 `spec/conventions/error-codes.md` 가 명시하듯 `spec/5-system/3-error-handling.md §1` 이다(거기엔 `WEBCHAT_IDLE_TIMEOUT` 이 이미 정확히 등재돼 있음, 확인 완료). 다만 1-data-model.md 의 이 인라인 열거가 "포함한다 —" 라는 완결형 어조라 신규 독자에게 오도 가능성이 있다.
  - 제안: 우선순위 낮음(이번 PR 이 만든 결함이 아니라 기존 패턴의 연장). 동일 배치로 고칠 필요는 없으나, 이후 §2.13 정리 시 `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 두 항목을 함께 추가하거나 "예시일 뿐, 카탈로그 SoT 는 §3-error-handling §1" 로 문구를 명확화 권장.

- **[INFO]** `spec/1-data-model.md §2.14 NodeExecution.status` 의 `cancelled` 정의가 AbortError 경로로만 좁게 기술
  - target 위치: `markWebchatIdleTimeout` 의 동반 `NodeExecution` UPDATE(`status = CANCELLED`, WAITING 가드 조건부, abortSignal/AbortError 무관 direct UPDATE)
  - 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution` 표의 `status` 필드 설명("`cancelled` = 외부 `abortSignal` 로 노드 외부 I/O 가 중단되어 핸들러가 throw 한 `AbortError` 를 엔진이 분류한 상태")
  - 상세: 이 좁은 정의만 보면 park(`waiting_for_input`) 상태의 NodeExecution 을 직접 `cancelled` 로 마킹하는 이번 경로가 모순돼 보인다. 그러나 이는 신규 결함이 아니다 — 기존 `cancelParkedExecution`(사용자 취소)·`markQueueWaitTimeout`(§8 큐 대기 타임아웃)이 이미 동일하게 WAITING NodeExecution 을 direct UPDATE 로 `cancelled` 처리해 왔고, 이번 `markWebchatIdleTimeout` 은 그 두 선례의 "합성"(코드 주석에 명시)일 뿐이다. `spec/conventions/node-cancellation.md` 자체도 AbortError 분류 외에 "사용자 cancel 버튼" 경로를 별도로 언급한다.
  - 제안: 우선순위 낮음. §2.14 의 `cancelled` 설명에 "AbortError 분류" 외에 "park(WAITING) 상태의 direct 취소 UPDATE(사용자 취소·§8 큐 대기 타임아웃·EIA-RL-07 idle-wait 등)" 케이스를 함께 명시하면 향후 재검토자의 오독을 줄일 수 있다.

## 요약

Cross-Spec 관점에서 이번 PR 은 매우 잘 정합됐다 — 대상 target spec(`14-external-interaction-api.md` §3.4/§R19)뿐 아니라 `4-execution-engine.md §1.1/§7.4`(전이표 예약 사유·무기한 보존 불변식과의 관계), `3-error-handling.md`, `6-websocket-protocol.md §4.1`(`cancelledBy`/`error.code` 닫힌 union), `data-flow/0-overview.md §4`·`data-flow/15-external-interaction.md`(BullMQ 큐 카탈로그), `7-channel-web-chat/1-widget-app.md`·`3-auth-session.md`("Planned"→"구현됨" flip)까지 선제적으로 동기화되어 있다. 유일한 실질 gap 은 `system-status-api.md §1` 큐 레지스트리 표가 새 큐를 반영하지 못한 것으로, 코드·data-flow 카탈로그 대비 문서 한 곳만 뒤처진 documentation-sync 성격의 WARNING 이다. 나머지 두 건은 이번 PR 이전부터 있던 인라인 예시 열거의 불완전성이라 INFO 수준이며 즉시 조치 불요.

## 위험도

LOW
