# Architecture Review

## 발견사항

### [CRITICAL] Schedule ↔ Trigger 역방향 동기화 부재 — 레이어 책임 경계 위반
- 위치: `spec/data-flow/10-triggers.md` §1.4, §3.1
- 상세: `triggers.service.ts`의 `PATCH /api/triggers/:id { isActive }` 는 `trigger` row만 갱신하고 `schedule.is_active` 와 BullMQ job을 갱신하지 않는다. `ScheduleRunnerService`의 processor는 `schedule.is_active`만 보므로, Trigger API를 통한 비활성화로는 Schedule 발사가 멈추지 않는다. 이는 단일 도메인 엔티티(`Schedule`↔`Trigger`)의 상태 일관성이 API 경로(어떤 서비스를 거치느냐)에 따라 갈리는 **레이어 책임 분리 위반**이다. 비즈니스 불변식("is_active 변경은 양방향 동기화")이 서비스 계층 한쪽(`SchedulesService`)에만 구현돼 있고, `TriggersService`에는 없다.
- 제안: `TriggersService.update()`에 `schedule` 타입 트리거의 `isActive` 변경 시 `ScheduleRepository`와 `ScheduleRunnerService.registerJob/removeJob`을 호출하는 조건 분기를 추가한다. 또는 `TriggersService`가 `SchedulesService`의 내부 메서드를 위임 호출하는 구조로 책임을 위임한다. 두 서비스 간 양방향 의존이 우려된다면, `TriggerStateChangedEvent`를 도메인 이벤트로 발행하고 `SchedulesService`가 구독하는 이벤트 구동 방식을 검토한다.

### [CRITICAL] Trigger 직접 삭제 시 BullMQ job 잔존 — 데이터/인프라 레이어 일관성 갭
- 위치: `spec/data-flow/10-triggers.md` §1.4
- 상세: `DELETE /api/triggers/:id` (`triggers.service.ts remove()`)는 trigger row를 삭제해 FK CASCADE로 schedule row를 제거하지만, `removeJob`을 호출하지 않아 BullMQ job scheduler 엔트리(`schedule:<id>`)가 Redis에 잔존한다. 이는 **데이터 레이어(Postgres)와 인프라 레이어(Redis) 간 상태 일관성 책임**이 `triggers.service.ts`에 누락된 것이다. Schedules API 삭제 경로는 계약대로 동작하므로, 같은 비즈니스 결과(schedule 제거)를 낳는 두 경로가 인프라 정리 여부에서 불일치한다.
- 제안: `TriggersService.remove()`에서 삭제 대상 trigger의 type이 `'schedule'`이면 연관 schedule row의 id를 먼저 조회해 `ScheduleRunnerService.removeJob`을 호출 후 삭제하도록 수정한다.

### [CRITICAL] Notification signing secret 승격 경로의 `secretRef` 우선순위 충돌
- 위치: `spec/data-flow/15-external-interaction.md` §1.5
- 상세: `promoteRotatedNotificationSecrets`가 `config.notification.signing.secret`에 v2 평문을 쓰면서 기존 `signing.secretRef`를 제거하지 않는다. 발송 측 `resolveSigningSecret`은 `secretRef`가 있으면 그것을 우선하므로, secret store ref를 이미 가진 trigger는 승격 후에도 구 secret으로 계속 서명한다. rotate API의 의도("v2 → secretRef 승격")와 실제 코드가 불일치하며, 회전된 secret이 실제로 쓰이지 않는 **보안 운영 상 결함**이다. 이는 비즈니스 레이어(rotation 로직)와 데이터 레이어(config JSONB 필드 병합 규칙)의 책임 분리가 불명확해 발생한 문제다.
- 제안: `promoteRotatedNotificationSecrets` 완료 시 `signing.secretRef`를 제거하거나, v2 평문을 secret store에 upsert한 새 ref로 교체하는 단계를 추가한다. 또는 `resolveSigningSecret`의 우선순위 로직을 수정해 `secret(평문)`이 있으면 `secretRef`보다 우선 적용하도록 변경한다.

### [WARNING] `llm_config` is_default partial UNIQUE index — DB 단 강제 부재
- 위치: `spec/data-flow/7-llm-usage.md` §2.1, Rationale
- 상세: entity `@Index` 선언(`llm_config_workspace_default_unique`)이 존재하지만 이를 생성하는 SQL 마이그레이션이 없다. `synchronize: false` 운용이므로 실제 DB에는 해당 제약이 없다. 워크스페이스 당 default 1개 보장이 application 트랜잭션(`saveWithDefaultSwap`)에만 의존하며, 동시 요청 경합(두 요청이 동시에 `is_default=true` 설정 시도)에서 DB 단 차단이 없다. 인접한 `rerank_config`는 V081에서 동일 패턴을 SQL로 정상 생성했으므로, 일관성 없는 처리다.
- 제안: `llm_config_workspace_default_unique` partial UNIQUE index를 생성하는 마이그레이션을 추가한다.

### [WARNING] SSE 이벤트 버퍼의 single-instance 아키텍처 제약 — 확장성 한계
- 위치: `spec/data-flow/15-external-interaction.md` §1.3, §2.2
- 상세: `SseAdapter.buffers`는 in-memory ring buffer(5분 retention, 최대 1000건)로, single-instance에 한정된다. 분산 fan-out은 follow-up으로 명시돼 있다. 현재 구조에서 다중 인스턴스 배포 시 특정 인스턴스에만 연결된 SSE 클라이언트는 다른 인스턴스가 처리한 이벤트를 수신하지 못한다. spec에 제약 사실은 명기되어 있으나, **아키텍처 결정 문서(Rationale)에 trade-off와 이관 계획이 없다.**
- 제안: Rationale에 "single-instance 한정인 이유"와 "다중 인스턴스로의 이관 계획"을 명시한다. 구현 수준에서는 Redis Pub/Sub 또는 BullMQ 기반 분산 fanout으로의 이관 plan을 작성한다.

### [WARNING] Chat Channel inbound rate limit 구현 갭 — 보안 정책 일부 미시행
- 위치: `spec/data-flow/14-chat-channel.md` §1.1
- 상세: `config.chatChannel.rateLimitPerMinute` (CCH-NF-03)는 DTO·타입 필드로만 존재하며 inbound hot path에 적용하는 코드가 없다. chatChannel 트리거는 inbound 서명 인증을 쓰므로 공개 webhook IP rate-limit(`PublicWebhookThrottleGuard`)에도 의존할 수 없다. spec이 명시한 비기능 요구사항이 구현되지 않은 상태에서 해당 갭이 data-flow 문서에만 기재됐고 plan으로 추적되지 않는다.
- 제안: `plan/in-progress/` 또는 backlog에 구현 갭 해소 plan을 생성하고, 해당 필드의 구현 여부를 spec에 "미구현(Planned)"으로 명시한다.

### [WARNING] LLM 노드 핸들러의 `LlmCallContext` 미전달 — attribution 갭
- 위치: `spec/data-flow/7-llm-usage.md` §1.3, Rationale
- 상세: AI Agent / Text Classifier / Information Extractor 노드 핸들러 3종이 `ExecutionContext`의 ID들(`workflow_id`, `execution_id`, `node_execution_id`)을 `LlmCallContext`로 전달하지 않아, `llm_usage_log`의 해당 컨텍스트 컬럼이 전부 NULL이다. 이로 인해 Statistics의 `workflowId` 필터 기반 비용 집계와 Alerts의 `llm_cost` workflow 스코프 룰에서 노드 발 호출이 누락된다. 이는 **비즈니스 계층(노드 핸들러)과 인프라 계층(사용량 기록)의 책임 연결**이 끊긴 것이며, spec 기존 약속("AI 노드 호출은 세 ID를 모두 채운다")과 구현 불일치다.
- 제안: 노드 핸들러 3종에서 `LlmCallContext`에 `executionContext`의 `workflowId`, `executionId`, `nodeExecutionId`를 전달하도록 수정한다. 이 수정을 plan으로 추적한다.

### [WARNING] `pruneExpired` (워크스페이스 초대)의 호출자 없음 — 만료 row 영구 잔존
- 위치: `spec/data-flow/12-workspace.md` §3.1
- 상세: `WorkspaceInvitationsService.pruneExpired`가 존재하지만 현재 프로덕션 호출자가 없어 만료 초대 row가 영구 잔존한다. `agent_memory` 의 forgetting은 `saveMemories` 트랜잭션 말미에서 처리하는 반면, 초대 만료 정리는 연결된 트리거가 없다. 상태 다이어그램에 `Expired → [*]`가 표현돼 있으나 실제로는 소멸하지 않는다.
- 제안: `login-history-pruner`와 동일한 패턴으로 `workspace-invitation-pruner` BullMQ 스케줄러를 연결하거나, 초대 발급 시 기회적 purge를 수행하도록 변경한다.

### [INFO] `WorkflowsController` 책임 확장 — 단일 책임 경계 모니터링 필요
- 위치: `spec/data-flow/11-workflow.md` §1.1, §1.5
- 상세: `WorkflowsController`가 캔버스 저장, 버전 restore, 복제(`duplicate`), 내보내기/가져오기(`export`/`import`), 수동 실행(`execute`) 등을 모두 처리한다. 현재는 각 엔드포인트가 명확한 위임 서비스를 갖고 있어 직접 문제는 없으나, 워크플로우 편집과 실행 트리거가 같은 컨트롤러에 위치해 컨트롤러의 책임 범위가 계속 확장될 위험이 있다.
- 제안: 향후 기능 추가 시 `WorkflowExecutionController` 또는 `WorkflowManagementController`로 분리를 검토한다. 현 시점에서는 즉각 조치보다 모니터링이 적절하다.

### [INFO] `ChatChannelDispatcher`의 `executionEvents$` 직접 구독 — 결합도 관찰
- 위치: `spec/data-flow/14-chat-channel.md` §1.2
- 상세: `ChatChannelDispatcher`가 `WebsocketService.executionEvents$` Subject를 `onModuleInit`에서 직접 subscribe한다. 이는 chat-channel 모듈이 WebSocket 이벤트 Subject에 직접 의존하는 구조로, `NotificationFanout`도 동일한 Subject를 구독한다. 두 구독자가 동일 이벤트를 받아 처리하는 fan-out 패턴은 의도적 설계(R10 단일 sink)이며 spec에 명시되어 있다. 다만 Subject가 in-process RxJS 인스턴스이므로 분산 환경에서 SSE와 동일한 단일 인스턴스 제약을 공유한다.
- 제안: 분산 확장 시 Subject를 Redis Pub/Sub 기반 어댑터로 교체하는 계획을 Rationale에 추가한다.

### [INFO] 워크플로우 `duplicate` 시 nodes/edges 미복제 — 비직관적 동작
- 위치: `spec/data-flow/11-workflow.md` §1.5
- 상세: `POST /api/workflows/:id/duplicate`가 workflow 메타 row만 복제하고 nodes/edges를 복제하지 않는다. 사용자 기대("워크플로우 복제")와 실제 동작("빈 워크플로우 생성")이 다를 수 있다. spec에 명시는 되어 있지만 의도된 설계인지, 미구현인지 Rationale가 없다.
- 제안: 이 동작이 의도된 것이라면 Rationale에 근거를 추가한다. 의도와 다르다면 nodes/edges 복제를 포함하도록 수정하거나 API 명칭을 변경한다.

---

## 요약

이번 변경은 주로 spec/data-flow 문서들의 코드-스펙 정합성 갱신으로, 기존에 부정확하거나 누락된 구현 사실을 명시하는 내용이다. 아키텍처 관점에서 가장 심각한 문제는 `Schedule ↔ Trigger` 역방향 동기화 부재와 `Trigger` 직접 삭제 시 BullMQ job 잔존으로, 두 문제 모두 동일 도메인 엔티티의 상태 일관성이 어떤 API 경로(어떤 서비스)를 거치느냐에 따라 달라지는 **레이어 책임 분리 위반**이다. 비즈니스 불변식("is_active 동기화", "삭제 시 Redis 정리")이 `SchedulesService`에만 구현되고 `TriggersService`에는 없는 것이 근본 원인이며, 두 서비스가 같은 도메인의 다른 진입점 역할을 하면서 일관성 책임이 중복·누락된 구조적 결함이다. Notification signing secret 승격 경로의 `secretRef` 우선순위 충돌은 보안 운영에 직접 영향하는 결함이다. `llm_usage_log`의 노드 컨텍스트 누락, `is_default` partial index 미생성, Chat Channel rate limit 미구현은 WARNING 수준의 기능·데이터 정합성 갭이다.

---

## 위험도

HIGH
