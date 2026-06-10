# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Schedule↔Trigger 역방향 동기화 부재, Trigger 삭제 시 BullMQ job 잔존, Notification signing secret 승격 시 secretRef 우선순위 충돌 등 3건의 Critical 아키텍처/보안 결함 존재. 다수 WARNING 은 구현 갭(rate limit 미구현, LLM attribution 누락, DB 인덱스 미생성)을 포함함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 도메인 일관성 | `PATCH /api/triggers/:id { isActive }` 가 `schedule.is_active` 와 BullMQ job 을 갱신하지 않음. `ScheduleRunnerService` 를 주입하지 않아 트리거 비활성화로는 schedule 발사가 멈추지 않음 — 레이어 책임 분리 위반 | `spec/data-flow/10-triggers.md` §1.4, §3.1 / `triggers.service.ts update()` | `TriggersService.update()` 에 schedule 타입 트리거의 `isActive` 변경 시 `ScheduleRunnerService.registerJob/removeJob` 호출 추가. 또는 도메인 이벤트(`TriggerStateChangedEvent`) 방식 검토 |
| 2 | 아키텍처 / 인프라 일관성 | `DELETE /api/triggers/:id` 가 FK CASCADE 로 schedule row 를 제거하나 `removeJob` 미호출 → BullMQ job scheduler 엔트리(`schedule:<id>`) 가 Redis 에 잔존. Schedules API 삭제 경로와 인프라 정리 여부 불일치 | `spec/data-flow/10-triggers.md` §1.4 / `triggers.service.ts remove()` | `TriggersService.remove()` 에서 schedule 타입 트리거 삭제 전 `ScheduleRunnerService.removeJob` 호출 |
| 3 | 보안 / Secret Rotation | `promoteRotatedNotificationSecrets` 가 v2 평문을 `config.notification.signing.secret` 에 쓰면서 기존 `signing.secretRef` 를 제거하지 않음. `resolveSigningSecret` 은 `secretRef` 우선 → 승격 후에도 구 secret 으로 서명 지속. Secret rotation 목적 달성 불가 | `spec/data-flow/15-external-interaction.md` §1.5 | `promoteRotatedNotificationSecrets` 완료 시 `signing.secretRef` 제거, 또는 `resolveSigningSecret` 우선순위 로직에서 `secret(평문)` 이 있으면 `secretRef` 보다 우선 적용하도록 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 인증 | `endpoint_path` 클라이언트 생성(`crypto.randomUUID()`) + 서버 UUID 형식 미강제. 악의적 클라이언트가 예측 가능한 값을 직접 지정 가능 → brute-force enumeration 및 충돌 위험 | `spec/data-flow/10-triggers.md` §4, §5 | 서버에서 `endpoint_path` 를 강제 발급하거나 DTO 레벨 `@IsUUID(4)` 형식 검증 추가 |
| 2 | 보안 / Rate Limit | `config.chatChannel.rateLimitPerMinute` (CCH-NF-03) 가 DTO·타입 필드로만 존재, inbound hot path 미적용. chatChannel 은 `PublicWebhookThrottleGuard` 보호도 받지 않음 → 봇 token 유출 시 무제한 execution 생성 | `spec/data-flow/14-chat-channel.md` §1.1 | `handleChatChannelWebhook` 경로에 `rateLimitPerMinute` config 기반 per-triggerId rate limit 구현. plan 등록 및 spec "미구현(Planned)" 명시 |
| 3 | 보안 / 비활성화 우회 | `PATCH /api/triggers/:id { isActive: false }` 로는 schedule 실행이 멈추지 않음 — 관리자의 의도적 실행 중단 보안 조치 무력화 | `spec/data-flow/10-triggers.md` §1.4 | Critical #1 과 동일 수정으로 해결 |
| 4 | 데이터 정합성 | `llm_config_workspace_default_unique` partial UNIQUE index 가 entity `@Index` 선언만 있고 SQL 마이그레이션 미생성. `rerank_config` 는 V081 에서 동일 패턴 정상 생성. 동시 요청 경합 시 중복 default 허용 가능 | `spec/data-flow/7-llm-usage.md` §2.1 | partial UNIQUE index 를 생성하는 마이그레이션(Vxxx) 추가. plan 등록 |
| 5 | 아키텍처 / 비용 Attribution | AI Agent / Text Classifier / Information Extractor 노드 핸들러 3종이 `LlmCallContext` 에 `workflow_id`, `execution_id`, `node_execution_id` 미전달 → `llm_usage_log` 해당 컬럼 전부 NULL. workflowId 필터 기반 비용 집계 및 Alerts `llm_cost` workflow 스코프 룰에서 노드 호출 누락 | `spec/data-flow/7-llm-usage.md` §1.3 | 노드 핸들러 3종에서 `LlmCallContext` 에 `executionContext` 의 세 ID 전달. plan 등록 |
| 6 | 아키텍처 / 확장성 | SSE `SseAdapter.buffers` 가 in-memory ring buffer, single-instance 한정. 다중 인스턴스 배포 시 특정 인스턴스 연결 SSE 클라이언트는 타 인스턴스 이벤트 미수신. Rationale 에 trade-off 와 이관 계획 없음 | `spec/data-flow/15-external-interaction.md` §1.3, §2.2 | Rationale 에 single-instance 한정 이유와 Redis Pub/Sub 기반 이관 계획 명시 |
| 7 | 아키텍처 / 데이터 일관성 | `WorkspaceInvitationsService.pruneExpired` 가 존재하나 프로덕션 호출자 없음 → 만료 초대 row 영구 잔존. 상태 다이어그램 `Expired → [*]` 와 실제 동작 불일치 | `spec/data-flow/12-workspace.md` §3.1 | `login-history-pruner` 패턴으로 BullMQ 스케줄러 연결 또는 기회적 purge. plan 등록 |
| 8 | 문서화 / 추적성 | 다수 구현 갭 callout(`10-triggers §1.4`, `14-chat-channel §1.1`, `15-external-interaction §1.5`, `7-llm-usage §1.3`, `12-workspace §3.1`)에 수정 plan 파일 링크 없음. 수정 일정·책임 추적 불가 | 전체 data-flow 문서 | 각 구현 갭 callout 에 `plan/in-progress/<name>.md` 링크 추가. 없으면 plan 파일 생성 |
| 9 | 유지보수성 | `spec/data-flow/13-agent-memory.md` Overview 코드 진입점 목록에서 경로 표기 일관성 불일치 (일부 설명 접미어 인라인 혼용, 2줄 넘는 설명 포함) | `spec/data-flow/13-agent-memory.md` Overview | 한 bullet = 파일 경로 + 1줄 책임 요약 원칙. 긴 설명은 §1.x 본문으로 이동 |
| 10 | 유지보수성 | `spec/data-flow/7-llm-usage.md` §1.3 attribution 갭 note 와 Rationale 에 동일 인과 흐름 이중 서술 — 향후 사실 변경 시 두 곳 수정 필요(이중 진실 위험) | `spec/data-flow/7-llm-usage.md` §1.3, Rationale | §1.3 note 를 "Rationale 참조" 한 줄로 압축. 상세 인과는 Rationale 에 일원화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(긍정) | OAuth state 원자적 one-shot DELETE(`DELETE ... RETURNING *`) 로 변경 → 동시 callback 경합에서 CSRF/replay 방어 강화 | `spec/data-flow/2-auth.md` §1.3 | 없음 |
| 2 | 보안(긍정) | OAuth 이메일 링크 조건부 UPDATE(`WHERE oauth_provider IS NULL`) — 다른 provider 덮어쓰기 방지 | `spec/data-flow/2-auth.md` §1.3 | 없음 |
| 3 | 보안(긍정) | refresh token reuse 탐지 분기(`is_revoked=true` vs `expires_at < now`) 명확히 분리됨 | `spec/data-flow/2-auth.md` §1.4 | 없음 |
| 4 | 보안(긍정) | `itk_*` Guard 가 `timingSafeEqual` (SHA-256 constant-time 비교) 사용 명시 | `spec/data-flow/15-external-interaction.md` §3.2 | 없음 |
| 5 | 보안 / Redis fail-open | `iext_*` JWT blacklist 및 jti 추적이 Redis 미가용 시 fail-open. 1h JWT exp 이 완화책이나 Redis 장애 1h 초과 시 취소 토큰 valid 처리 가능 | `spec/data-flow/15-external-interaction.md` §3.1 | fail-open vs fail-closed 명시적 결정 + Redis 장애 시 즉시 알림 메커니즘 확보 |
| 6 | 보안 | 비활성 chatChannel 트리거 inbound 요청이 서명 검증 통과 후 `202 { executionId: 'ignored' }` 로 무시 — 감사 로그 없음 | `spec/data-flow/10-triggers.md` §1.2, §1.5 | 비활성 트리거 inbound 요청에 카운터/로그 추가 권장 |
| 7 | 보안 | workflow import 시 payload 내 `llmConfigId` 의 workspace 소속 검증이 spec 에 명시되지 않음 | `spec/data-flow/11-workflow.md` §1.5 | import 시 모든 외부 참조의 현재 workspace 소속 검증 로직을 spec 에 명시 |
| 8 | 보안 | Agent Memory `resolveScopeKey` 에서 제어문자 제거 + 512자 SHA-256 축약 적용. Redis key 구분자 `:` 포함 시 동작 명시 미비 | `spec/data-flow/13-agent-memory.md` §1.2 | Redis key 구분자 `:` 포함 시 escape 처리 또는 동작 명시 |
| 9 | 범위 | PR 구현 범위(trigger-schedule 동기화)와 무관한 13개 data-flow 파일이 별도 커밋(79f1d849 "전수 감사")으로 포함됨. 실질 혼입 리스크 낮으나 인지 필요 | PR 전체 | 내용 품질 문제 없음. 별도 작업임을 기록 |
| 10 | 범위 | `spec/data-flow/10-triggers.md` §1.4 구현 갭 표기가 feat 커밋(59231fd7) 이후 실제로 해소되었을 수 있으나 diff 기준 최종 상태 미확인 | `spec/data-flow/10-triggers.md` §1.4 | 별도 spec 갱신 커밋(8beb1742)에서 §1.4 텍스트 최종 수정 여부 검토 권장 |
| 11 | 문서화 | `spec/1-data-model.md §2.9.1` "역방향도 동일" 계약이 이번 data-flow 갱신과 정합하는지 consistency-checker 별도 확인 권장 | `spec/1-data-model.md` §2.9.1 | consistency-checker 실행 권장 |
| 12 | 문서화 | `spec/data-flow/11-workflow.md` §1.5 `duplicate` 가 nodes/edges 미복제 — 의도된 설계인지 미구현인지 Rationale 없음 | `spec/data-flow/11-workflow.md` §1.5 | 의도된 설계라면 Rationale 추가; 아니라면 nodes/edges 복제 포함 수정 또는 API 명칭 변경 |
| 13 | 문서화 | `notification_preferences.integrationExpiryEmail` default 가 "누락 시 true" → "누락 시 false" 로 정정됨. `spec/1-data-model.md §2.21` 반영 여부 미확인 | `spec/data-flow/8-notifications.md` Rationale | `spec/1-data-model.md §2.21` 에 동일 변경 반영 여부 확인 |
| 14 | 문서화 | `spec/data-flow/3-execution.md` 코드 진입점 목록에서 diff truncation 으로 경로가 잘린 bullet 존재. 실제 파일 확인 필요 | `spec/data-flow/3-execution.md` 코드 진입점 목록 | 해당 bullet 경로 완성 여부 파일 직접 확인 |
| 15 | 문서화 | `spec/data-flow/9-observability.md` Alert window `parseIso8601Duration` 파싱 실패 시 PT1H 로 silent fallback. DTO `@IsString` 만 검증 — ISO 8601 형식 강제 없음 | `spec/data-flow/9-observability.md` §1.3 | DTO 에 ISO 8601 duration 패턴 `@Matches` 검증 추가. fallback 시 경고 로그 발생 여부 문서 명시 |
| 16 | 유지보수성 | `spec/data-flow/10-triggers.md` §1.4 구현 갭 blockquote 내 두 케이스의 원인·증상·영향 과도 압축, 훑어 읽기 어려움 | `spec/data-flow/10-triggers.md` §1.4 | 표 형태(`\| 갭 \| 증상 \| 영향 \|`) 또는 문장 줄 분리로 개선 |
| 17 | 유지보수성 | `spec/data-flow/14-chat-channel.md` §1.1 시퀀스 다이어그램과 command 분기 표에서 동일 케이스 중복 기술 | `spec/data-flow/14-chat-channel.md` §1.1 | 다이어그램 커버 케이스는 표에서 "위 다이어그램 참조"로 간략 처리 |
| 18 | 유지보수성 | `spec/data-flow/15-external-interaction.md` §1.5 본문과 Rationale 에 동일 인과 흐름 이중 서술 | `spec/data-flow/15-external-interaction.md` §1.5, Rationale | Rationale 의 인과 재서술 압축 (2문장 이내) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | HIGH | Schedule↔Trigger 역방향 동기화 부재(CRITICAL), Trigger 삭제 시 BullMQ job 잔존(CRITICAL), Notification secret secretRef 우선순위 충돌(CRITICAL), LLM attribution 갭(WARNING), SSE single-instance 제약(WARNING) |
| security | MEDIUM | Trigger 비활성화 → schedule 미중단(WARNING), 삭제 후 Redis 잔존(WARNING), secretRef 우선순위 충돌(WARNING), chatChannel rate limit 미구현(WARNING), endpoint_path 서버 미검증(WARNING) |
| requirement | MEDIUM | Trigger 역방향 동기화 갭이 `spec/1-data-model.md §2.9.1` 계약 위반(코드 fix 필요), llm_config 인덱스 미생성, endpoint_path 생성 주체 명세 불명확 |
| documentation | LOW | 다수 구현 갭 callout 에 plan 링크 없음(WARNING 다수), 신규 파일 3개 문서화 우수 |
| maintainability | LOW | attribution 갭 이중 서술 위험(WARNING), 신규 파일 bullet 밀도/스타일 불일치(WARNING) |
| scope | LOW | 13개 data-flow 파일이 별도 커밋으로 포함됨 — 실질 혼입 리스크 낮음 |
| side_effect | NONE | 모든 변경이 spec Markdown 문서 전용 — 런타임 부작용 없음 |

---

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 발견사항을 보고함).

---

## 권장 조치사항

1. **[Critical] `TriggersService.update()` 에 schedule 타입 `isActive` 변경 시 `ScheduleRunnerService.registerJob/removeJob` 호출 추가** — `spec/1-data-model.md §2.9.1` "역방향도 동일" 계약 이행, 보안 조치 무력화 방지.
2. **[Critical] `TriggersService.remove()` 에 schedule 타입 삭제 시 `removeJob` 호출 추가** — Redis/BullMQ 상태 일관성 확보.
3. **[Critical] `promoteRotatedNotificationSecrets` 에서 `signing.secretRef` 제거 또는 `resolveSigningSecret` 우선순위 수정** — secret rotation 실효성 확보.
4. **[WARNING] `llm_config_workspace_default_unique` partial UNIQUE 인덱스 마이그레이션 추가** — 동시 요청 경합 시 중복 default 방지.
5. **[WARNING] AI 노드 핸들러 3종에 `LlmCallContext` ID 전달 추가** — 워크플로우별 LLM 비용 집계 정확도 확보.
6. **[WARNING] chatChannel inbound `rateLimitPerMinute` 구현 및 plan 등록** — CCH-NF-03 비기능 요구사항 이행.
7. **[WARNING] 각 구현 갭 callout 에 plan 파일 링크 추가** (`10-triggers §1.4`, `14-chat-channel §1.1`, `15-external-interaction §1.5`, `7-llm-usage §1.3`, `12-workspace §3.1`) — 수정 추적성 확보.
8. **[WARNING] `WorkspaceInvitationsService.pruneExpired` BullMQ 스케줄러 연결 plan 등록** — 만료 row 영구 잔존 방지.
9. **[INFO] `spec/1-data-model.md §2.9.1` 과 `§2.21` consistency 검토** — Trigger 역방향 동기화 계약 및 `integrationExpiryEmail` default 변경 반영 여부 확인.
10. **[INFO] `spec/data-flow/7-llm-usage.md` 및 `15-external-interaction.md` 이중 서술 정리** — 유지보수성 개선.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `documentation` (7명)
- **강제 포함(router_safety)**: `documentation`, `requirement`
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| testing | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |