### 발견사항

- **[INFO]** `spec-draft-nf-ob-07-redis-fail-open.md` 는 체크리스트 전항목 완료, `plan/complete/` 이동 후보
  - target 위치: 해당 없음 (plan 문서 자체)
  - 관련 plan: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` (frontmatter `worktree: eia-r8-cache-scope-4ae434` — 이번 diff 에서 신규 추가된 파일)
  - 상세: `## 체크리스트` 5항목이 모두 `[x]`이고 `## 후속`에 열거된 유일한 미해결 항목("다른 Redis fail-open 소비자 배선")은 명시적으로 **비목표**로 분리되어 있어, 이 plan 자체는 완결된 상태로 보인다. `status: in-progress` 로 남아 `plan/in-progress/`에 있다.
  - 제안: 라이프사이클 규칙(`plan-lifecycle.md`)에 따라 `plan/complete/`로 이동할지 검토 — 정합성 결함은 아니고 housekeeping 성격의 메모.

### 검토 근거 (교차 확인한 항목)

- target diff(`origin/main...HEAD`)는 `spec/5-system/_product-overview.md`(NF-OB-07 카탈로그에 `clemvion.redis.fail_open` 1행 추가) + `spec/data-flow/9-observability.md`(미러 문장 + Rationale 절 추가) + 코드(`BusinessMetricsService.recordRedisFailOpen`, `IdempotencyInterceptor` 5개 fail-open 경로 계측)로 좁게 스코프됨.
- 이 변경의 작업 지시서인 `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`가 정확히 이 두 spec 파일·표 1행·미러 문장·Rationale 절 추가를 지시하고 있고, target 은 그 지시와 1:1 로 일치한다. 충돌 없음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` §"idempotency fail-open 구간의 관측·중복 억제" 항목의 하위 체크박스("Redis 실패율 지표")가 이번 작업으로 `[x]` 완료 처리되어 있고, 서술(다섯 fail-open 경로 전부 계측·뮤테이션 5/5 사살)이 실제 diff 내용과 일치한다. 같은 부모 항목의 **자매 하위 항목**("GET→SET 비원자 구조 개선")은 여전히 미체크로 남아 있으나, target 은 그 항목을 다루지 않는다고 명시하지 않았음에도 diff 범위 밖이며 plan 도 그것을 별개 미해결로 정확히 구분해 두고 있어 충돌이나 은폐가 아니다.
- `RedisFailOpenComponent`(닫힌 유니온, 현재 `'idempotency'` 하나)의 스코프 판단은 `spec-draft-nf-ob-07-redis-fail-open.md` Rationale 에서 "다른 fail-open 소비자(InteractionRateLimiterService·OutboundNotificationRateLimiterService·ChatChannelRateLimiterService·PublicWebhookQuotaService·Cafe24InstallRateLimitService)는 아직 미배선"이라고 명시하며, 이 목록은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 기록된 실제 rate-limiter fail-open 구현 현황과 부합한다. target 이 "카탈로그가 구현보다 넓어지지 않도록" 좁게 등재한 결정과 다른 plan 의 서술 사이에 모순 없음.
- `spec/5-system/14-external-interaction-api.md`(§R8, idempotency 캐시 대상 2xx/409/410)와 `spec/data-flow/15-external-interaction.md`는 이번 diff 에서 변경되지 않았다. 관련 plan(`spec-draft-eia-r8-alignment.md`)은 이미 이전 커밋(`#1154`/`#1155`, origin/main 에 병합됨)에서 전항목 완료 처리되어 있고 이번 target 과 겹치는 결정 영역이 없다.
- `execution-engine.md`(pending_plans: `execution-engine-residual-gaps.md`, `retry-turn-terminal-guard.md`, `exec-intake-followups.md`)는 이번 diff 에서 변경되지 않았고, 세 plan 문서 어디에도 redis fail-open 메트릭·업데이트된 NF-OB-07 카탈로그와 충돌하는 서술이 없다.
- plan/in-progress 전역에서 "결정 필요"·"TBD"·"보류" 로 표시된 미해결 항목들(ai-agent-tool-connection-rewrite, chat-channel-slack-socket-mode/discord-gateway, webchat-usewidget-extraction 등)은 모두 이번 target 과 무관한 영역(AI Agent 도구, 채팅 채널 게이트웨이, 웹챗 위젯)이라 충돌 소지 없음.

### 요약
이번 target(`spec/5-system/_product-overview.md` NF-OB-07 카탈로그 + `spec/data-flow/9-observability.md` 미러/Rationale)은 신규 작업 지시서(`spec-draft-nf-ob-07-redis-fail-open.md`)의 명시적 지시와 정확히 일치하고, 상위 추적 plan(`backend-lint-gate-broken-on-main.md`)의 관련 체크박스 서술과도 부합한다. `RedisFailOpenComponent`를 `idempotency` 하나로 좁게 유지한 결정은 다른 fail-open 소비자(rate limiter 류)의 plan 서술과도 모순되지 않으며, 그 확장은 별도 후속으로 명시적으로 남겨져 있다. plan/in-progress 전역을 훑어도 이 변경과 충돌하는 미해결 결정이나 무효화되는 후속 항목은 발견되지 않았다. 유일한 관찰은 housekeeping 성격의 INFO(완료된 plan 파일의 `plan/complete/` 이동 검토)뿐이다.

### 위험도
NONE
