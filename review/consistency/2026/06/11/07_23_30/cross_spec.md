# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/db-pool-creds-pubsub.md`
검토 기준: `spec/**` 전 영역과의 충돌

---

## 발견사항

### [INFO] `spec/0-overview.md §2.6` Redis 용도 목록에 `integration:cache:invalidate` 채널 미등록
- **target 위치**: plan §설계 — `IntegrationCacheBus`, 채널 `integration:cache:invalidate`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/spec/0-overview.md` §2.6 Data Layer Redis 항목
- **상세**: `spec/0-overview.md §2.6` 는 Redis 용도를 "캐시, BullMQ 큐 백엔드 (`execution-run`/`execution-continuation`/`background-execution`), 운영 lock (`exec:recover:lock`), KB 채널 등, 세션 관리" 로 열거한다. `integration:cache:invalidate` pub/sub 채널은 해당 열거에 없다. `2-database-query.md` 는 이미 채널을 정의했으므로 `spec/0-overview.md §2.6` 의 Redis 용도 목록과 동기화가 필요하다.
- **제안**: `spec/0-overview.md §2.6` Redis 항목에 `integration:cache:invalidate` (integration 자격증명 캐시 무효화 pub/sub) 를 추가한다.

### [INFO] `spec/5-system/4-execution-engine.md §9.2` Redis 키/채널 목록에 `integration:cache:invalidate` 미등록
- **target 위치**: plan §설계 — 채널명 `integration:cache:invalidate`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/spec/5-system/4-execution-engine.md` §9.2 용도별 키 정의 및 TTL 표
- **상세**: §9.2 표는 애플리케이션이 사용하는 Redis 키를 나열하고, §9.1 에서 모든 Redis 키가 `{service}:{workspaceId}:{resource}` 패턴을 따른다고 선언한다. 신규 채널 `integration:cache:invalidate` 는 이 표에 없다. 또한 채널명이 §9.1 의 `{service}:` 네임스페이스 패턴과 다른 형식(`integration:cache:invalidate`)을 사용한다. §9.1 이미 전역 예외(exec:recover:lock 등)에 대한 선례가 있으므로 모순은 아니지만, 동기화 항목으로 명시가 필요하다.
- **제안**: `spec/5-system/4-execution-engine.md §9.2` 표에 `integration:cache:invalidate` 채널 행을 추가하거나, §9.1 의 "전역 키" 예외 설명 주석에 본 채널을 언급한다.

### [INFO] `spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` 목록에 `integration-cache-bus.service.ts` 미포함
- **target 위치**: plan §설계 — "email 은 후속 1줄(별 항목)" / "bus 는 generic 설계 → email 후속"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` 섹션
- **상세**: 본 plan 은 `IntegrationCacheBus` 가 integration-generic 이라 Send Email transport invalidation 도 후속 단계에서 동일 bus 에 register 된다고 명시한다. `2-database-query.md` 의 frontmatter `code:` 에는 `integration-cache-bus.service.ts` 가 이미 추가됐다. 향후 Send Email 연결 시 `3-send-email.md` frontmatter 도 동일하게 갱신이 필요함을 추적 항목으로 관리해야 한다. 현 시점에서는 spec 간 모순이 아니나 미래 연결 시 누락될 위험이 있다.
- **제안**: plan §체크리스트 또는 `3-send-email.md` 에 "후속: `IntegrationCacheBus` register 시 frontmatter `code:` 에 `integration-cache-bus.service.ts` 추가" 메모를 남긴다.

### [INFO] `spec/data-flow/5-integration.md` rotate/update/reauthorize 흐름에 pub/sub publish 단계 미반영
- **target 위치**: plan §설계 — `IntegrationsService`: rotate/update/remove/reauthorize/OAuth save 후 `bus.publish(integrationId)`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/spec/data-flow/5-integration.md` §1 흐름도 및 §1.2 OAuth callback 흐름
- **상세**: data-flow §5 는 `rotate`/`reauthorize`/OAuth callback 의 `UPDATE integration` 시퀀스를 상세히 기술하지만 `bus.publish(integrationId)` 단계가 없다. 구현 완료 후 해당 시퀀스 다이어그램에 `publish` 단계를 추가해야 단일 진실이 유지된다. 현재는 plan 단계이므로 모순이 아니지만 spec 구현 후 동기화가 필요하다.
- **제안**: 구현 완료 후 `spec/data-flow/5-integration.md` 의 rotate/reauthorize/OAuth 콜백 흐름에 `IntegrationCacheBus.publish(integrationId)` 단계를 추가한다.

---

## 요약

target 문서(`plan/in-progress/db-pool-creds-pubsub.md`) 가 제안하는 `IntegrationCacheBus`(채널 `integration:cache:invalidate`) 설계는 기존 spec 과 직접 모순되는 항목이 없다. 신규 Redis pub/sub 채널이 `spec/0-overview.md §2.6` Redis 용도 목록, `spec/5-system/4-execution-engine.md §9.2` 키 목록에 미등록된 INFO 수준 동기화 결여 3건과, `data-flow/5-integration.md` 의 rotate/reauthorize 흐름에 publish 단계가 미반영된 INFO 건이 확인됐다. 모두 "구현 완료 후 spec 갱신" 단계에서 처리 가능한 수준이며, CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다.

---

## 위험도

LOW
