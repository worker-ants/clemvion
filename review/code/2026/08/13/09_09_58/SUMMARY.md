# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CCH-SE-02 chat-channel update dedup 구현(Redis `SET NX EX 30`, 게이트 배선) 자체는 10개 reviewer 전원이 CRITICAL 0건으로 판정한 견고한 코드다. 유일하게 위험도를 끌어올리는 요인은 기능 결함이 아니라 **절차 위반의 반복** — `developer` 롤이 read-only 대상인 `spec/` 을 이번 PR 안에서만 3회(누적) 직접 수정했고, "다음부터는 순서를 지킨다"는 직전 두 라운드의 자기 다짐이 같은 PR 안에서 두 번 더 어겨졌다(scope reviewer WARNING). forced whitelist(7명) 전원 결과 확보, 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE | `developer` 롤이 `spec/` 를 이번 PR 에서 3개 파일 직접 수정 — "구현 중 spec 변경 필요 시 `project-planner` 위임" 규약 위반이 해소되지 않고 오히려 확산(1차 라운드 2개→이번 3개). 내용 자체는 매번 검증되어 요구사항 충족에는 문제없음(`--impl-done` consistency BLOCK:NO) | `spec/5-system/15-chat-channel.md:88,710`(CCH-SE-02 표·R-CC-20 Rationale), `spec/4-nodes/7-trigger/providers/telegram.md:235-236`, `spec/data-flow/14-chat-channel.md:196-197` | 이번 PR 은 병합 단계라 되돌릴 필요 없음. 다음 세션에서 `project-planner` 사후 추인 턴을 분리하거나, 최소한 "이 패턴이 3회 반복됐다"는 사실을 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트에 명시해 규약 형해화를 막을 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | provider 공급 `idempotencyKey` 길이 제한 없이 Redis 키 구성 — 이론적 리소스 소모 벡터. 다만 인증(`chatChannelInboundAuthenticator.verify()`) 통과 후에만 도달 가능해 실질 위험 낮음 | `chat-channel-dedup.service.ts:6-9`(`makeChatDedupKey`), 호출부 `hooks.service.ts:339` | 급하지 않음. 필요 시 `claim()` 진입부에 길이 상한(예 200자) clamp 방어 추가 |
| 2 | SECURITY/CONCURRENCY | Redis 미가용/에러 시 fail-open — 문서화된 의도된 트레이드오프(형제 rate-limiter/quota 서비스와 동일 정책). 인가/신뢰 경계 문제 아님, 서비스+호출부 양쪽 warn 으로 관측 가능 | `chat-channel-dedup.service.ts:55,68-73` | 조치 불요 |
| 3 | ARCHITECTURE/MAINTAINABILITY | `ChatChannelDedupService` 생성자가 `ChatChannelRateLimiterService`(+`PublicWebhookQuotaService`)와 동일한 "Redis 원자연산+fail-open" 골격을 복제 — 3번째 유사 클래스 | `chat-channel-dedup.service.ts:39-46` vs `chat-channel-rate-limiter.service.ts:34-42` | 조치 불요. 4번째 유사 클래스 등장을 공통 베이스 추출 트리거로 고정 |
| 4 | ARCHITECTURE/MAINTAINABILITY | `HooksService.handleChatChannelWebhook`(~440줄)에 dedup 게이트가 삽입되며 순차 guard 가 5단계로 누적, 생성자 의존성 12개. 이번 diff 자체가 "다음 게이트 추가" 트리거 조건을 충족 | `hooks.service.ts:257-699`(메서드), 게이트 `hooks.service.ts:328-345` | 이번 PR 단독 조치 불요하되, **다음 chat-channel guard 추가 시점**에는 3개 guard(모두 균일 시그니처)를 파이프라인 협력 객체로 추출할 것 — 더 유예 연장 금지 |
| 5 | REQUIREMENT | Redis 키 네이밍 레지스트리(spec §9.1 `{service}:{workspaceId}:{resource}:{id}:{sub}`)를 신규 `cc:dedup:<triggerId>:<updateId>` 키가 여전히 미준수(workspaceId 세그먼트 없음) — 형제 키(`cc:rl:`)와 동일한 기존 편차, 별도 항목으로 추적 중 | `chat-channel-dedup.service.ts:6-9` | 이번 PR 단독 조치 불요(PR #1160 병합 여부 후속 확인) |
| 6 | SCOPE | plan 의 절차 이탈 자기기록이 실제 위반 범위(3개 spec 파일)보다 좁게(2개) 적혀 있음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트 | 완료 노트 목록에 `spec/data-flow/14-chat-channel.md` 추가 |
| 7 | SIDE_EFFECT | dedup `claim()` 선점(SET NX)에 release 경로가 없어, `claim()` 성공 후 후속 처리(예: enrichInbound)가 일시적으로 실패하면 provider 재전송이 최대 30초간 조용히 억제되는 창이 이론상 존재(spec 요구사항엔 정합) | `hooks.service.ts:338-345` | 급하지 않음. R-CC-20 Rationale 또는 게이트 주석에 이 트레이드오프 한 줄 명시 권장 |
| 8 | SIDE_EFFECT | `HooksService` 생성자에 신규 필수 파라미터가 끝이 아니라 중간에 삽입됨. 현재 positional 호출자 0건(grep 확인)이라 위험 없음 | `hooks.service.ts:79` | 향후 이 클래스를 직접 `new` 하는 코드가 생기면 named-args/factory 권장 |
| 9 | MAINTAINABILITY/DOCUMENTATION | `handleChatChannelWebhook` 상단 JSDoc 파이프라인 요약이 신규 dedup/rate-limit 단계를 반영하지 않음 | `hooks.service.ts` 함수 상단 JSDoc | 다음에 이 docstring 을 만질 때 "dedup(rate-limit 보다 먼저)" 단계 추가 |
| 10 | MAINTAINABILITY/DOCUMENTATION | 신규 DI 토큰 `CHAT_CHANNEL_DEDUP_REDIS` 에 형제 클래스가 가진 "테스트 전용 훅" 설명 주석이 없음(프로덕션 미provide, grep 확인) | `chat-channel-dedup.service.ts:39-46` | 형제 클래스와 동일한 한 줄 주석 추가 |
| 11 | MAINTAINABILITY/DOCUMENTATION | `ChatChannelModule` 상단 docstring 의 "모듈 구조" 열거가 `ChatChannelRateLimiterService`/`ChatChannelDedupService` 둘 다 누락(사전 존재 stale, 신규 문제 아님) | `chat-channel.module.ts:22-32` | 낮은 우선순위. 다음에 이 파일을 만질 때 갱신 |
| 12 | TESTING | `RedisConnectionProvider` 폴백 분기(injectedRedis 없고 redisConn 만 있는 경로)가 어떤 단위 테스트에서도 실행되지 않음. 프로덕션 실경로임에도 미검증(형제 서비스도 동일 관례) | `chat-channel-dedup.service.ts:45`, `chat-channel-dedup.service.spec.ts:23-25` | `redisConn` mock 주입 테스트 1개 추가 권장. 급하지 않음(sibling 일괄 정리 시점) |
| 13 | TESTING | dedup 윈도우 상수(30초)·키 포맷이 테스트에서 리터럴로 pin 되지 않고 구현 심볼을 그대로 import해 비교 — 값 자체 회귀는 못 잡음 | `chat-channel-dedup.service.ts:9,12`, `chat-channel-dedup.service.spec.ts:34-40` | `toBe(30)`/`toBe('cc:dedup:t:u')` 리터럴 단언 2줄 추가 권장. 우선순위 낮음 |
| 14 | TESTING | CCH-SE-02 실 Redis 대상 e2e 없음(모킹된 `redis.set` 만) — 형제 rate-limiter/quota 서비스도 동일 갭, plan 에 후속 후보로 이미 등재 | N/A(부재 확인) | 조치 불요(백로그 등재). 후속 e2e: 동일 body 2회 POST → 두 번째 202 ignored |
| 15 | DOCUMENTATION | slack.md/discord.md 의 dedup 서술이 telegram.md 만큼 SoT 백링크를 갖추지 못해 provider 문서 3종 상세도 불균일(사실 오류 아님) | `spec/4-nodes/7-trigger/providers/discord.md:324`, `slack.md:301` | 급하지 않음. 다음에 세 provider 문서를 함께 만질 때 SoT 백링크 통일 |
| 16 | REQUIREMENT/DOCUMENTATION | `hooks.service.spec.ts` 상단에 `@nestjs/common` import 가 두 줄로 분리(`Logger` 단독) — lint 통과, 기존 관례 위반 아님, 이미 유예 처분됨 | `hooks.service.spec.ts:11` | 급하지 않음(다음에 그 블록을 만질 때 병합) |
| 17 | SCOPE | `review/code/**`·`review/consistency/**` 산출물(이전 두 라운드분) 및 `CHANGELOG.md`/plan 체크박스 갱신이 diff 에 포함 — 프로젝트 강제 워크플로의 정규 산출물이라 scope creep 아님 | 해당 디렉터리 전체 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Redis 인젝션 표면 없음, 인증 선행 확인, fail-open 은 문서화된 트레이드오프 |
| architecture | LOW | Redis fail-open 클래스 3중 복제·guard 누적 440줄, 둘 다 명시적 유예 트리거 존재 |
| requirement | LOW | CCH-SE-02 spec 과 line-level 일치, 이전 WARNING 전량 조치 재확인, §9.1 키 네이밍 편차만 잔존 |
| scope | **MEDIUM** | developer 의 `spec/` 직접 수정이 3회로 확산(반복 절차 위반), 그 외는 단일 목적 diff |
| side_effect | LOW | 신규 Redis 키 네임스페이스·생성자 시그니처 변경 모두 안전, release 없는 dedup 선점의 트레이드오프만 INFO |
| maintainability | LOW | 코드 품질 양호, JSDoc/모듈 docstring 미동기화만 잔존(신규 문제 아님) |
| testing | LOW | 1차 WARNING(호출부 warn 미검증) 실제 조치 확인, 잔여 갭은 폴백 분기·리터럴 pin·e2e 부재(전부 기존 관례) |
| documentation | LOW | 이전 두 라운드 WARNING 전부 소스 대조로 해소 확인, 신규 CRITICAL/WARNING 없음 |
| database | NONE | 관계형 DB 요소 전무, 유일한 저장 상호작용(Redis SET)은 이미 security 가 검토 |
| concurrency | LOW | `SET NX EX` 원자 연산으로 TOCTOU 없음, 호출부 await 누락 방지 테스트 존재, fail-open 은 기존 승인 정책 |

## 발견 없는 에이전트

- database — 해당 없음(관계형 DB 요소 없음, CRITICAL/WARNING/INFO 전무)

## 권장 조치사항

1. (프로세스) `spec/` read-only 규약이 같은 PR 안에서 반복적으로(3회) 어겨진 패턴을 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트에 정확한 파일 수(3개)로 갱신하고, 다음 세션부터는 `project-planner` 사후 추인 턴을 실제로 분리할 것.
2. (구조, 트리거 대기) 다음에 `handleChatChannelWebhook` 에 새 inbound guard 가 추가되는 시점 — 이번 diff 로 "다음 게이트" 트리거 조건이 충족됐으므로 — 반드시 인증/dedup/rate-limit 3개 guard 를 파이프라인 협력 객체로 추출할 것.
3. (테스트 보강, 우선순위 낮음) `RedisConnectionProvider` 폴백 분기 테스트 1개, dedup 윈도우/키 포맷 리터럴 단언 2줄 추가로 회귀 방지 폭을 넓힐 것.
4. (문서 정합, 우선순위 낮음) JSDoc 파이프라인 요약·DI 토큰 주석·모듈 docstring·slack/discord provider 문서의 SoT 백링크를 다음에 해당 파일을 만질 때 함께 갱신할 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (10명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 4명 (아래 표. 라우터가 제외 사유 텍스트를 prompt 에 제공하지 않아 이유 컬럼은 카테고리 성격 기반 추정)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff 는 단일 Redis `SET NX EX` 원자 명령 추가로, 성능 특이 표면(N+1, 배치, 알고리즘 복잡도 변화) 없음 — 라우터가 저관련으로 판단한 것으로 추정 |
  | dependency | 신규 외부 패키지 의존성 추가 없음(기존 `ioredis` 재사용) |
  | api_contract | 신규/변경 HTTP 엔드포인트 없음(기존 `POST /api/hooks/:endpointPath` 내부 분기 삽입) |
  | user_guide_sync | 최종 사용자向 UI/가이드 변경 없음(백엔드 내부 dedup 로직) |
