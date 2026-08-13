# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능·보안·동시성·테스트 관점에서는 CRITICAL/WARNING 없이 전원 LOW(구현은 CCH-SE-02 chat-channel update dedup 를 정확히 충족). 위험도를 MEDIUM 으로 끌어올리는 것은 오로지 **절차/거버넌스** 이슈다 — `developer` 롤이 이번 diff 의 마지막 커밋에서 `spec/` read-only 규약을 **4번째로** 위반했고(`redis-keys.md` 직접 수정), 그 결과 같은 diff 안의 plan 자기 기록("실측 3개 파일" 등)이 스스로를 반증하는 stale 상태로 남아 있다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 는 전원 결과 확보됐고 누락 없음 — 이 MEDIUM 판정을 가릴 "결과 없음" 사각지대는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `developer` 롤이 `spec/` read-only 규약을 이번 diff 의 마지막 커밋(`4b46be711`)에서 **4번째로** 위반 — `redis-keys.md` 에 `cc:dedup:` 키 직접 등재 + `15-chat-channel.md` R-CC-20 앵커 링크 직접 정정. 동일 세션 안에서 3연속 라운드(`02_38_41`·`02_50_38`·`09_09_58`)가 "다음부터는 순서를 지킨다"고 반복 기록했음에도 재발. | `spec/conventions/redis-keys.md:61`, `spec/5-system/15-chat-channel.md`(R-CC-20 앵커) | 이번 PR 안에서 4회 반복된 사실을 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트에 명시 기록. "다음부터 지킨다"는 문구 반복 대신, 다음 PR 부터 실제로 짧은 project-planner 선행 턴을 강제하는 절차적 장치(pre-commit 경고·체크리스트 등)를 도입할 것. |
| 2 | Scope / Requirement | 같은 커밋(`4b46be711`)이 `redis-keys.md` 에 `cc:dedup:` 를 등재하면서, **같은 diff 안**의 plan 자기 기록 두 곳이 이미 stale/거짓이 됐다 — (a) "실측 3개 파일"(`git diff --name-only origin/main...HEAD -- spec/`) 목록이 이제 4개(`redis-keys.md` 누락); (b) "인벤토리는 `cc:rl:` 만 담고 있다"는 전제가 이제 `cc:rl:`+`cc:dedup:` 둘 다 담고 있어 부분적으로 무효. 체크박스는 여전히 미완료(`[ ]`)로 남아 다음 독자가 오판할 수 있다. | `plan/in-progress/backend-lint-gate-broken-on-main.md:752-758`(실측 3개 파일), `:809-816`(인벤토리 `cc:rl:` 만 담고 있다는 항목) | "실측 3개 파일"을 4개로 갱신(`redis-keys.md` 추가). 인벤토리 항목은 `cc:dedup:` 등재 완료를 반영해 잔여 범위를 `chat-channel:<triggerId>`·`chat-channel-lock:<triggerId>` 2계열 미등재로 좁히거나 부분완료로 명시. |
| 3 | Architecture | `HooksService.handleChatChannelWebhook` 가 이미 ~440줄(§257-698)의 단일 메서드인데, 이번 diff 의 dedup 게이트 삽입으로 순차 guard 체인이 6단계(비활성 검사→handshake→parseUpdate→**dedup(신규)**→rate-limit→명령 라우팅/폼 상태 머신)로 늘었다. 새 블록 자체는 인접 rate-limit 블록과 동형이라 국소적 일관성은 지켰으나, 다축 책임이 누적되는 추세다. | `codebase/backend/src/modules/hooks/hooks.service.ts:257`-`698`(메서드 전체), 신규 블록 `:328`-`345` | 즉각 조치 불요. 다음 유사 guard(추가 보안 검사·다른 provider 필터 등) 추가 시점에 `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter`(모두 `trigger.id + 입력 → boolean/throw` 로 시그니처 균일) 를 별도 `ChatChannelInboundGuardPipeline` 협력 객체로 추출하는 것을 확정 작업으로 승격할 것. (maintainability 리뷰어는 "다음 게이트 추가"가 추출 트리거이며 이번 diff 자체가 그 게이트라 트리거 미도달로 보아 INFO 로 유예 — 판단 근거 차이를 기록해 둠.) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `idempotencyKey` 에 길이 제한 없이 Redis 키를 구성 — 인증(`chatChannelInboundAuthenticator.verify`) 선행 + 상위 `PublicWebhookThrottleGuard` 로 실질 위험은 낮음. | `chat-channel-dedup.service.ts:9`(`makeChatDedupKey`), 호출부 `hooks.service.ts:339` | 급하지 않음. 필요 시 `claim()` 진입부에 상한 길이(예: 200자) clamp. |
| 2 | Security / Concurrency | Redis 미가용/에러 시 fail-open(억제 없이 통과) — `ChatChannelRateLimiterService`/`PublicWebhookQuotaService` 와 동일한 문서화된 의도된 정책. 인증/인가 우회 아님, warn 으로 관측 가능. | `chat-channel-dedup.service.ts:55`, `:69-73` | 조치 불요. |
| 3 | Security | catch 블록이 Redis 에러 메시지를 그대로 서버 로그에 기록 — 응답에는 노출되지 않음, 기존 관례와 동일. | `chat-channel-dedup.service.ts:71` | 조치 불요. |
| 4 | Architecture | `HooksService` 생성자 의존성 12개로 증가(`chatChannelDedup` 포함) — "일반 webhook 처리"와 "chat-channel 오케스트레이션" 두 축이 한 클래스에 묶여 facade 비대화 위험. | `hooks.service.ts:69-84`(생성자), `:79`(신규 파라미터) | 위 guard-pipeline 추출과 함께, chat-channel 전용 의존성을 `ChatChannelInboundOrchestrator` 로 묶는 방향을 다음 확장 시점 후보로 남김. |
| 5 | Architecture / Maintainability | `ChatChannelDedupService` 가 `ChatChannelRateLimiterService` 생성자/필드 구조를 그대로 복제 — "Redis 원자연산+fail-open+개별 Logger" 골격 클래스가 (`PublicWebhookQuotaService` 포함) 3개로 증가. | `chat-channel-dedup.service.ts:39-46` vs `chat-channel-rate-limiter.service.ts:34-42` | 지금 통합 불요. 4번째 유사 서비스 추가 시점을 `RedisFailOpenGuard` 공통 베이스 추출 트리거로 삼을 것. |
| 6 | Architecture | Redis 키 `cc:dedup:<triggerId>:<idempotencyKey>` 가 §9.1 `{service}:{workspaceId}:{resource}:{id}:{sub}` 레지스트리 규약(workspaceId 세그먼트)을 따르지 않음 — 형제 키 `cc:rl:` 와 동일한 기존 편차, plan 에 이미 추적 중. | `chat-channel-dedup.service.ts:6-9` | 새 조치 불필요(중복 추적 방지). 기존 plan 항목 처분 시 `cc:rl:`/`cc:dedup:` 함께 판단. |
| 7 | Requirement / Documentation / Maintainability | `handleChatChannelWebhook` 상단 JSDoc 파이프라인 요약(5단계)이 신규 dedup 단계(및 기존 rate-limit 단계)를 나열하지 않음 — 라운드 3에서 이미 지적, 미수정 상태 유지. | `hooks.service.ts:243-256`(요약) vs 실제 게이트 `:328-362` | 요약에 "dedup(rate-limit 보다 먼저) → rate-limit" 항목 추가. |
| 8 | Documentation / Maintainability | `ChatChannelDedupService` 생성자의 `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰에 형제 클래스가 가진 설명 주석("테스트 주입 우선, 아니면 공유 커넥션, 미가용 시 null")이 없음. | `chat-channel-dedup.service.ts:39-46` | 형제 클래스와 동일한 한 줄 주석 추가. 우선순위 낮음. |
| 9 | Documentation / Maintainability | `ChatChannelModule` 상단 docstring "모듈 구조" 열거가 `ChatChannelRateLimiterService`·`ChatChannelDedupService`·`ChatChannelInboundAuthenticator` 를 반영 안 함 — 이번 diff 이전부터 있던 선재 stale. | `chat-channel.module.ts:22-31` | 우선순위 낮음. 다음에 이 파일을 만질 때 목록 갱신 또는 "Spec §7 참조"로 단순화. |
| 10 | Maintainability | `hooks.service.spec.ts` 에 `@nestjs/common` import 가 두 줄로 분리(`Logger` 별도) — 기능 영향 없음, 라운드 2에서 이미 유예. | `hooks.service.spec.ts:4-11` | 사소함. 다음에 이 블록을 만질 때 병합. |
| 11 | Maintainability | `redis-keys.md`(`updateId`)와 `data-flow/14-chat-channel.md`(`idempotencyKey`) 의 키 파라미터 표기가 서로 다름 — 코드는 후자와 일치, 순수 문서 표기 불일치. | `spec/conventions/redis-keys.md:61`, `spec/data-flow/14-chat-channel.md:196` | 조치 불요(문서 정합은 documentation/consistency 영역). |
| 12 | Testing | `ChatChannelDedupService` 생성자의 `RedisConnectionProvider` 폴백 분기가 어떤 단위 테스트에서도 실행되지 않음 — 3라운드 동일 지적, 형제 서비스도 동일 관례라 유예. | `chat-channel-dedup.service.ts`(생성자), `chat-channel-dedup.service.spec.ts`(`makeService()`) | 조치 불요(유예). `redisConn` mock 주입 테스트 1개로 닫을 수 있으나 급하지 않음. |
| 13 | Testing | `CHAT_DEDUP_WINDOW_SEC`/키 포맷이 테스트에서 동일 심볼 참조로만 검증되고 리터럴로 pin 되지 않음. | `chat-channel-dedup.service.ts`, `chat-channel-dedup.service.spec.ts` | 조치 불요(유예). `toBe(30)`/`toBe('cc:dedup:t:u')` 2줄로 닫을 수 있음. |
| 14 | Testing | CCH-SE-02 에 대한 실 Redis/HTTP e2e(동일 raw body 2회 POST) 부재 — plan 백로그에 이미 등재. | N/A(부재) | 조치 불요(백로그 추적 중). |
| 15 | Documentation / User Guide Sync | `slack.md`/`discord.md` 의 dedup 서술이 `telegram.md` 수준("구현됨 2026-08-13" + 메커니즘 + SoT 링크)으로 갱신 안 됨 — planner 백로그에 이미 등재, developer 권한 밖. | `spec/4-nodes/7-trigger/providers/slack.md:301`, `discord.md:324` | 조치 불요(등재·추적 중). 다음 planner 턴에서 SoT 백링크 추가. |
| 16 | Documentation | `redis-keys.md` 인벤토리에 `chat-channel:<triggerId>`/`chat-channel-lock:<triggerId>` 2계열이 여전히 미등재 — 선재 갭, plan 에 이미 등재. | `spec/conventions/redis-keys.md:61` | 조치 불요(추적 중). |
| 17 | User Guide Sync | `slack.mdx`/`slack.en.mdx` 트러블슈팅 표("Slack 이 retry 폭주")가 신규 dedup 동작(30초 내 재도착은 조용히 흡수)을 반영 안 함 — grey zone, 오류는 아님. | `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx:185` | 급하지 않음. 다음에 이 표를 만질 때 "동일 update 30초 재도착은 dedup 으로 이미 무시됨" 한 줄 보강 고려. |
| 18 | Side Effect | 재도착 억제(`claim()` 성공) 직후 처리(ack/알림)가 도중 실패하면 TTL 30초 동안 응답 없는 창이 남음 — 기존 form_submission lock 과 동일 클래스 트레이드오프, spec 에 TTL 30초로 명시. | `hooks.service.ts:338-345` | 조치 불요(인지 목적 기록). 필요 시 "claim 성공 후 처리 실패" 관측(metric/alert) 별도 검토 가능. |
| 19 | User Guide Sync | `spec-major-change` 매트릭스 매칭(spec 3건)은 이미 `--impl-done` consistency-check 3라운드로 BLOCK:NO 검증 완료. | `spec/**` 4건 | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인증 선행·파라미터화 Redis 호출로 인젝션/우회 표면 없음. idempotencyKey 길이 무제한(INFO)만 잔존. |
| architecture | LOW | 레이어 분리/DIP/모듈 경계 깔끔. `HooksService` 다축 책임 누적(WARNING, 다음 확장 시 추출 확정 필요). |
| requirement | LOW | CCH-SE-02 spec 과 line-level 일치, CRITICAL 0. plan 자기 기록 stale(WARNING, scope와 통합). |
| scope | MEDIUM | 핵심 diff 는 단일 목적 수렴. `spec/` read-only 위반 4회째 재발 + plan 자기 기록 stale(WARNING 2건). |
| side_effect | LOW | Redis 신규 쓰기·생성자 변경 모두 DI로만 소비돼 파손 지점 없음. 극단적 실패창(INFO)만 기록. |
| maintainability | LOW | 신규 코드 품질 양호. 잔존 신호는 전부 이전 라운드 유예 항목의 연장(트리거 미도달). |
| testing | LOW | 호출부 warn 단언 등 이전 WARNING 조치 완료 확인. 잔여 갭은 전부 백로그 등재된 기존 관례. |
| documentation | LOW | CHANGELOG/spec CCH-SE-02/R-CC-20/앵커 정정 모두 정확. 잔존 5건 전부 이전 라운드 유예·백로그 등재 재확인. |
| concurrency | LOW | `SET NX EX` 단일 원자 명령으로 TOCTOU/데드락 없음. fail-open 시 억제 재개방은 의도된 정책. |
| user_guide_sync | LOW | CRITICAL 급 trigger(신규 노드/TSX/warningCode 등) 매칭 없음. slack.mdx 트러블슈팅 표 갱신 여지(INFO)만. |

## 발견 없는 에이전트

없음 — 전 10개 reviewer 모두 최소 INFO 이상 발견사항을 남김(대다수는 이전 라운드에서 이미 유예된 항목의 재확인).

## 권장 조치사항

1. (절차) `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트에 "developer 의 `spec/` 직접 수정이 이번 PR 안에서 4회 반복됐다"는 사실을 명시 기록하고, 다음 PR 부터 실제로 project-planner 선행 턴을 강제하는 절차적 장치(pre-commit 경고·체크리스트 등) 도입을 검토한다.
2. (문서 정합) `plan/in-progress/backend-lint-gate-broken-on-main.md:752-758`("실측 3개 파일")을 4개로 갱신(`redis-keys.md` 추가)하고, `:809-816` 항목을 `cc:dedup:` 등재 완료를 반영해 잔여 범위(`chat-channel:`/`chat-channel-lock:` 2계열)로 좁히거나 부분완료로 명시한다.
3. (구조, 비긴급) 다음 chat-channel inbound guard 추가 시점에 `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter` 를 `ChatChannelInboundGuardPipeline` 협력 객체로 추출해 `HooksService.handleChatChannelWebhook` 의 다축 책임 누적을 정리하는 것을 확정 작업으로 승격한다.
4. (저우선) `handleChatChannelWebhook` JSDoc 파이프라인 요약에 dedup/rate-limit 단계 추가, `ChatChannelDedupService` DI 토큰 설명 주석 추가, `ChatChannelModule` docstring 목록 갱신 — 다음에 해당 파일을 만질 때 함께 처리.
5. (백로그 유지, 액션 불요) `slack.md`/`discord.md` dedup 서술 갱신, `redis-keys.md` 잔여 2계열 등재, e2e(raw body 재전송) 추가는 이미 planner/테스트 백로그에 등재돼 있어 이번 라운드에서 새 조치를 요구하지 않음 — 다음 해당 턴에서 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync` (10명)
  - **제외**: 표 참고 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(성능 영향 표면 없음) |
  | dependency | 새 외부 의존성 추가 없음(기존 `ioredis` 재사용) |
  | database | SQL/DB 스키마 변경 없음(Redis 전용 diff) |
  | api_contract | 신규 HTTP 엔드포인트/API 계약 변경 없음(기존 webhook 내부 분기 삽입) |
---

> 조치 내역·유예 근거는 같은 디렉터리의 [`RESOLUTION.md`](./RESOLUTION.md).
