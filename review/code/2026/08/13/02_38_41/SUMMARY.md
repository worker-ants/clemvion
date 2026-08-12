# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 구현(`ChatChannelDedupService` 신설, CCH-SE-02 재도착 dedup 배선)은 스펙 정합·테스트 실효성(뮤테이션 킬 확인)이 높아 CRITICAL 은 전무하다. 다만 `spec/` 직접 수정(developer 롤 read-only 규약 위반 가능성), sibling spec 문서 drift, `CHANGELOG.md` 누락, 호출부 로그 미검증 등 절차/문서 WARNING 4건이 있어 MEDIUM 으로 판정한다. 강제(forced) reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope/절차 | `spec/5-system/15-chat-channel.md` CCH-SE-02 표 행을 이번 diff 가 직접 재작성함. 내용은 구현과 정합하지만, CLAUDE.md 규약상 `developer` 는 `spec/` read-only 이며 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"이 명문화되어 있다. diff 만으로는 이 변경이 project-planner 턴을 거쳤는지 판별 불가 | `spec/5-system/15-chat-channel.md:88` | 이 spec 수정이 project-planner 롤(또는 `consistency-check --spec`)을 거쳤는지 확인. 아니라면 별도 project-planner 턴으로 분리하거나 최소한 변경 사유를 커밋/PR 설명에 명시 |
| 2 | Documentation | `spec/4-nodes/7-trigger/providers/telegram.md:235` 가 여전히 "미구현(Planned): update_id 기반 dedup — consumer 없음" 이라고 서술하나, 이번 PR 이 정확히 그 갭을 `ChatChannelDedupService` 로 닫아 문구가 stale/반증됨. 이 파일은 리뷰 diff 대상에 포함되지 않아 `15-chat-channel.md` 만 갱신되고 놓친 것으로 보임 | `spec/4-nodes/7-trigger/providers/telegram.md:235` | bullet 제거 또는 "구현됨(`ChatChannelDedupService`, 2026-08-13)"으로 갱신 — `15-chat-channel.md` CCH-SE-02 행과 동일 사실(키 형식·TTL·fail-open) 반영 |
| 3 | Documentation | `CHANGELOG.md` 에 이번 변경(dead field 배선 + spec 정정) 에 대한 `Unreleased` 항목이 없음. 이 저장소는 유사 변경마다 항목을 남기는 관례가 확립되어 있음 | `CHANGELOG.md` (신규 항목 부재) | `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 서술을 근거로 `## Unreleased — chat-channel update dedup 미배선(CCH-SE-02) 을 배선` 항목 추가 |
| 4 | Testing | `hooks.service.ts` 의 재도착 무시 warn 로그(`재도착 무시 (CCH-SE-02, trigger=...)`)가 호출부 테스트(`hooks.service.spec.ts` CCH-SE-02 케이스)에서 단언되지 않음 — `chat-channel-dedup.service.spec.ts` 는 서비스 내부 warn 을 검증하는데(같은 PR 이 명시한 "로그 소실은 반환값만으론 못 잡는다" 원칙) 호출부 자매 warn 에는 미적용 | `codebase/backend/src/modules/hooks/hooks.service.ts:341-343` / `hooks.service.spec.ts:1226-1259` | 기존 CCH-SE-02 `it` 안에 `logger.warn` spy 로 `'재도착 무시'` `stringContaining` 단언 한 줄 추가 (파일 내 기존 warn 검증 패턴 재사용) |
| 5 | Maintainability | `HooksService.handleChatChannelWebhook` 가 이미 436줄(10개 이상 책임)인데 이번 diff 로 dedup 게이트 블록이 하나 더 추가돼 계속 길어짐 (사전 존재 문제, 새 블록 자체는 기존 rate-limit 게이트와 구조 일관) | `codebase/backend/src/modules/hooks/hooks.service.ts:257-692` (함수 전체), 신규 블록 `:328-345` | 즉각 조치 불요. 다음 유사 게이트 추가 시 "파싱 후 게이트 체인"을 별도 private 헬퍼로 추출 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | provider 공급 `idempotencyKey` 에 길이 제한 없이 Redis 키 구성 — 인증 통과 후에만 도달 가능하고 상위 스로틀 가드가 완화하므로 실익스플로잇 표면 좁음 | `chat-channel-dedup.service.ts:9`, 호출부 `hooks.service.ts:339` | 급하지 않음. 필요 시 `idempotencyKey` 상한 길이(예 200자) clamp 고려 |
| 2 | Security | Redis 장애 시 fail-open — 문서화된 의도된 트레이드오프, sibling 서비스와 동일 정책 | `chat-channel-dedup.service.ts:69-73` | 조치 불요 |
| 3 | Architecture | `ChatChannelDedupService` 가 `ChatChannelRateLimiterService`/`PublicWebhookQuotaService` 와 거의 1:1 구조 복제(생성자 패턴·fail-open 래핑) — 동일 골격 클래스 3개째 | `chat-channel-dedup.service.ts:34-76` vs `chat-channel-rate-limiter.service.ts:29-78` | 지금 통합 불요. 4번째 유사 서비스 추가 시 공통 베이스(`RedisFailOpenGuard`) 추출 검토 |
| 4 | Architecture | dedup 키(`cc:dedup:<triggerId>:<idempotencyKey>`)가 실행 엔진 §9.1 Redis 키 레지스트리 규약(`{service}:{workspaceId}:...`)을 따르지 않음 — 신규 이슈 아니고 형제 `cc:rl:` 패턴과 동일한 기존 편차, plan 에 이미 추적 중 | `chat-channel-dedup.service.ts:6-9` | 새 조치 불요(중복 추적 방지) |
| 5 | Requirement | spec 문구 "Redis 미가용 시 fail-open(+warn)" 이 두 갈래(생성자 시점 client 부재=무경고 vs 런타임 에러=warn)를 뭉뚱그림 — 구현은 sibling 클래스와 일관되게 정확히 구현됨, spec 문구만 다소 부정확 | `chat-channel-dedup.service.ts:55` vs `:69-73`; spec `15-chat-channel.md:88` | spec 문구를 두 갈래로 세분화하는 정정 고려 (코드 변경 불요) |
| 6 | Requirement | `claim()` JSDoc `@returns` 가 `true` 반환 3경로 중 "빈 idempotencyKey" 케이스를 언급하지 않음 | `chat-channel-dedup.service.ts:48-53` vs `:58` | `@returns` 문구에 빈 키 케이스 한 줄 추가 |
| 7 | Requirement | CCH-SE-02 에 대한 e2e 레벨 검증 부재 (단위+통합형 단위 테스트만 존재) | N/A (부재 확인) | 후속에서 provider 1개에 동일 raw body 2회 POST 하는 e2e 1건 고려 (우선순위 낮음) |
| 8 | Scope | 핵심 diff 6개 파일은 "CCH-SE-02 dedup 배선" 단일 목적에 정확히 수렴 — drive-by 리팩토링/포맷팅/기능 확장 없음 | 전체 diff | 조치 불요 |
| 9 | Side Effect | `HooksService` 생성자 시그니처 변경 — 위치 인자 직접 생성 호출자 0건 확인(전부 DI/mock), 테스트 provider 배열도 함께 갱신되어 안전 | `hooks.service.ts:79` | 조치 불요 |
| 10 | Side Effect | `ChatChannelModule` providers/exports 양쪽에 신규 서비스 등록 — export 누락 시 DI 실패했을 것이나 정확히 포함됨 확인 | `chat-channel.module.ts:46,61` | 조치 불요 |
| 11 | Side Effect | 재도착 억제 시 하위 부작용(알림·ack)도 전부 스킵 — 최초 요청 처리 중 크래시 시 30초 TTL 동안 무응답 가능한 극단적 실패창. 기존 form_submission lock 과 동일 클래스 트레이드오프 | `hooks.service.ts:338-345` | 조치 불요 (인지 기록) |
| 12 | Maintainability | 새 파일 네이밍·상수화·JSDoc 품질 높음 (`makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 가 자매 파일과 대칭) | `chat-channel-dedup.service.ts` 전체 | 조치 불요 |
| 13 | Testing | 생성자의 `RedisConnectionProvider` 폴백 경로(3번째 분기)가 단위 테스트에서 미실행 — 프로덕션 DI 경로이나 sibling 서비스도 동일하게 미검증 | `chat-channel-dedup.service.ts:39-46` / `chat-channel-dedup.service.spec.ts:23-25` | `redisConn` mock 주입 테스트 1건 추가 고려 (우선순위 낮음) |
| 14 | Testing | 실 ioredis 대상 통합/e2e 테스트 없음 — 모킹 전용, sibling 서비스도 동일 | `chat-channel-dedup.service.spec.ts` 전체 | 조치 불요 (기존 관례와 동일) |
| 15 | Documentation | `HooksService.handleChatChannelWebhook` docstring 파이프라인 요약(5단계)이 신규 dedup·기존 rate-limit 단계를 반영하지 않음 | `hooks.service.ts:243-256` | docstring 목록에 "3.5 CCH-SE-02 dedup" · "3.6 CCH-NF-03 rate-limit" 추가 |
| 16 | Documentation | `ChatChannelDedupService` 생성자가 형제 클래스와 동일 DI 패턴이나, "테스트 전용 토큰" 설명 주석이 옮겨지지 않음 — `'CHAT_CHANNEL_DEDUP_REDIS'` 를 provide 하는 곳이 실제로 없음(grep 확인) | `chat-channel-dedup.service.ts:39-46` | 형제 클래스와 동일한 설명 주석 추가 |
| 17 | Documentation | `ChatChannelModule` 상단 docstring 의 모듈 구조 열거가 기존부터 stale(신규 서비스 미반영) — 이번 diff 로 새로 생긴 문제 아님 | `chat-channel.module.ts:22-32` | 우선순위 낮음. 다음 이 파일 편집 시 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | idempotencyKey 길이 무제한(INFO), fail-open 정책(INFO) — Critical/Warning 없음 |
| architecture | LOW | Redis fail-open 클래스 구조 3중 복제, `handleChatChannelWebhook` 책임 누적, Redis 키 레지스트리 미준수 — 전부 INFO, 신규 이슈 아님 |
| requirement | LOW | spec-구현 line-level 정합 확인, JSDoc 누락·e2e 부재만 INFO |
| scope | MEDIUM | `spec/` 직접 수정이 developer read-only 규약과 충돌 가능(WARNING). 나머지 diff 는 목적에 정확히 수렴 |
| side_effect | LOW | 신규 Redis 쓰기·생성자 시그니처 변경 모두 안전 확인, 실패창 1건 INFO |
| maintainability | LOW | `handleChatChannelWebhook` 길이 누적(WARNING), 생성자 보일러플레이트 반복(INFO) |
| testing | LOW | 뮤테이션 2건 독립 재현 킬 확인, 호출부 warn 로그 미검증(WARNING), 생성자 폴백 분기·e2e 미검증(INFO) |
| documentation | MEDIUM | sibling spec(`telegram.md`) drift(WARNING), CHANGELOG 누락(WARNING), docstring 동기화 갭 다수(INFO) |

## 발견 없는 에이전트

없음 — 8개 에이전트 모두 최소 INFO 이상 발견사항 보고.

## 권장 조치사항

1. `spec/5-system/15-chat-channel.md` CCH-SE-02 직접 수정이 project-planner 절차를 거쳤는지 확인 — 아니라면 사후 승인/기록 또는 별도 턴으로 재처리 (scope WARNING 1).
2. `spec/4-nodes/7-trigger/providers/telegram.md:235` 의 "consumer 없음" stale 문구를 구현 완료 사실로 갱신해 CCH-SE-02 sibling spec 정합 회복 (documentation WARNING 2).
3. `CHANGELOG.md` 에 `Unreleased` 항목 추가 (documentation WARNING 3).
4. `hooks.service.spec.ts` CCH-SE-02 케이스에 재도착 무시 warn 로그 단언 1줄 추가 (testing WARNING 4).
5. (낮은 우선순위) `handleChatChannelWebhook` 게이트 체인 헬퍼 추출은 차기 유사 게이트 추가 시점에 재검토 (maintainability WARNING 5).
6. INFO 항목들(JSDoc 보강, docstring 동기화, 생성자 폴백 분기 테스트, e2e 후속)은 blocking 아님 — 백로그로 남겨도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(성공, 전문 반영 완료). 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련성 낮음 (Redis 원자 연산 1회 추가, 성능 영향 미미) |
  | dependency | 신규 외부 의존성 추가 없음 (ioredis 재사용) |
  | database | SQL/DB 스키마 변경 없음 |
  | concurrency | Redis `SET NX` 자체가 원자 연산이며 별도 동시성 로직 없음 |
  | api_contract | 외부 API 계약 변경 없음 (내부 서비스 신설 + 배선) |
  | user_guide_sync | 사용자 가이드 문서 영향 없음 (내부 dedup 로직) |
