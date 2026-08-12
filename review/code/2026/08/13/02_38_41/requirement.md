# 요구사항(Requirement) 리뷰 — CCH-SE-02 update dedup

## 스코프

`ChatChannelDedupService` 신설(`chat-channel-dedup.service.ts` + spec) + `HooksService.handleChatChannelWebhook` 배선 + `ChatChannelModule` provider/export 등록 + `spec/5-system/15-chat-channel.md` CCH-SE-02 문면 갱신. 관련 spec 은 `spec/5-system/15-chat-channel.md` §3.4 (CCH-SE-02, 이 PR 에서 갱신됨) 로 식별했다.

## 검증한 사실

- `spec/5-system/15-chat-channel.md` L88 CCH-SE-02 신 문면: "어댑터가 provider update id … 를 `ChannelUpdate.idempotencyKey` 로 파싱하고, inbound 진입에서 동일 키 30초 안 재도착을 무시한다 (`ChatChannelDedupService`, Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<updateId>`). Redis 미가용 시 fail-open(+warn)" — 구현과 line-level 로 대조했다.
  - 키 포맷: spec `cc:dedup:<triggerId>:<updateId>` ↔ 구현 `makeChatDedupKey` = `` `cc:dedup:${triggerId}:${idempotencyKey}` `` (`chat-channel-dedup.service.ts:6-9`). 일치.
  - TTL: spec `30초` ↔ `CHAT_DEDUP_WINDOW_SEC = 30`(`chat-channel-dedup.service.ts:12`). 일치.
  - 원자성: spec `SET NX EX 30` ↔ 구현 `this.redis.set(key, '1', 'EX', 30, 'NX')`(`chat-channel-dedup.service.ts:61-67`). 일치.
  - fail-open: Redis 미주입/에러 모두 `true` 반환(`chat-channel-dedup.service.ts:55, 73`). 일치.
- 배선 위치: `HooksService.handleChatChannelWebhook` 에서 `parseUpdate` 직후 · rate-limit(CCH-NF-03) **이전**에 `chatChannelDedup.claim(trigger.id, parsed.idempotencyKey)` 호출(`hooks.service.ts:338-345`). spec 문구("inbound 진입") 및 plan 서술("rate-limit 앞 — 쿼터 미소비")과 일치. 차단 시 `{ executionId: 'ignored' }` 반환 + warn 로그 — 다른 무시 경로(비활성 trigger, group chat 등)와 동일한 202-ignored 관례를 따른다.
- DI 배선: `ChatChannelDedupService` 가 `ChatChannelModule` 의 `providers`/`exports` 양쪽에 추가됐고(`chat-channel.module.ts:46, 61`), `HooksModule` 이 이미 `ChatChannelModule` 을 import 하므로 `HooksService` 생성자에 새 필수 인자로 추가해도 NestJS DI 가 해석 가능함을 확인했다. `RedisConnectionProvider` 는 `@Global()`(`redis.module.ts`)이라 별도 import 불필요.
- 형제 클래스 대조: `ChatChannelRateLimiterService`(`chat-channel-rate-limiter.service.ts`)와 생성자·fail-open 패턴이 동일(`if (!this.redis) return true;` 는 무경고, `catch` 블록만 warn). 신설 서비스가 기존 코드베이스 관례를 그대로 따른다.
- `ChannelUpdate.idempotencyKey` 는 `string`(non-optional, `types.ts:129`)이고 slack/telegram/discord 세 파서 모두 실제 provider id 를 채워 넣는다(빈 문자열이 되는 경로가 파서 레벨에는 없음) — `claim()` 의 빈 키 가드는 방어적 코드이되 도달 불가능한 사문이 아니라 "parser 가 못 준 경우" 를 명시적으로 커버하는 정당한 방어임을 확인했다.
- 뮤테이션 근거(plan 서술 "6/6 사살")를 테스트로 재대조: NX 제거·TTL 제거·triggerId 세그먼트 제거·빈 키 가드 제거는 `chat-channel-dedup.service.spec.ts` 의 통짜 인자 단언(L34-40) 또는 개별 케이스가 잡고, warn 제거는 L78-80, 호출부가 반환값을 버리는 회귀는 `hooks.service.spec.ts` 의 `CCH-SE-02` 테스트(rate-limit 미소비 + interact 미호출 단언)가 잡는다. 각 뮤턴트에 대응하는 단언이 실제로 존재함을 확인했다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "완료" 서술("spec 문면도 고쳤다", "뮤턴트 6/6")은 실제 diff 와 대조해 거짓 진술이 없음을 확인했다.

## 발견사항

- **[INFO]** spec 문구 "Redis 미가용 시 fail-open(+warn)" 은 "미가용"의 두 갈래(①생성자 시점 client 자체가 없음 ②런타임 `set()` 호출 실패)를 구분하지 않고 "+warn" 을 붙였는데, 구현은 ②만 warn 하고 ①(`if (!this.redis) return true;`)은 무경고다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:55` (무경고 분기) vs `:69-73` (warn 분기). spec: `spec/5-system/15-chat-channel.md:88`.
  - 상세: 이 비대칭은 버그로 보기 어렵다 — 같은 파일 docstring 이 "같은 모듈의 rate-limiter · `PublicWebhookQuotaService` 와 동일 정책"이라 명시하고, 실제로 `ChatChannelRateLimiterService.consume()` 도 동일하게 `!this.redis` 분기는 무경고·`catch` 블록만 warn 이다(`chat-channel-rate-limiter.service.ts:47, 68-70`). 즉 기존 코드베이스 관례를 그대로 따른 것이며, "미가용"은 통상 배포 시점에 의도적으로 Redis 를 안 붙인 정상 상태(로그 노이즈 방지)를, "에러"는 이상 상태(가시성 필요)를 가리키는 것으로 읽힌다. spec 의 "(+warn)" 문구가 다소 뭉뚱그려져 있을 뿐 구현이 틀렸다고 보기는 어렵다.
  - 제안: 정정이 필요하다면 코드가 아니라 spec 쪽 — CCH-SE-02 문구를 "Redis 클라이언트 미주입 시 fail-open(무경고), 호출 중 에러 시 fail-open(+warn)" 처럼 두 갈래로 좁히는 것이 codebase 실태 및 형제 클래스와 정합적이다. 사람 판단 필요 사안이라 CRITICAL/WARNING 이 아닌 INFO 로 남긴다.

- **[INFO]** `claim()` 의 JSDoc `@returns` 가 `true` 를 반환하는 세 경로(최초 도착 / Redis 미가용·에러 fail-open / **빈 `idempotencyKey`**) 중 세 번째를 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:48-53` (JSDoc) vs `:58` (빈 키 분기, 별도 인라인 주석만 있음).
  - 상세: 기능 자체는 맞게 구현·테스트됐고 인라인 주석(`:56-57`)이 이유를 설명하지만, 함수 상단 계약 문서에는 누락돼 있어 호출자가 `claim()` 시그니처만 보고 "빈 키도 dedup 대상"으로 오해할 여지가 있다.
  - 제안: `@returns` 문구에 "idempotencyKey 가 빈 문자열이면 dedup 미적용(`true`)" 한 줄 추가. 경미한 문서 보강이라 코드 동작 변경은 불필요.

- **[INFO]** CCH-SE-02 dedup 에 대한 e2e 레벨 검증이 이번 diff 에 없다(telegram/slack/discord e2e-spec 파일 변경 없음). 커버리지는 서비스 단위(`chat-channel-dedup.service.spec.ts`) + `HooksService` 통합형 단위(`hooks.service.spec.ts`)까지다.
  - 위치: N/A (부재 확인 — `git diff` 대상 파일 목록에 `test/chat-channel-*.e2e-spec.ts` 없음).
  - 상세: `spec/5-system/15-chat-channel.md` frontmatter 의 `code:` 목록에 이미 3개 e2e-spec 파일이 등재돼 있으나 이번 PR 이 그것을 건드리지 않았다. 단위+통합 테스트가 뮤테이션 실측까지 뒷받침돼 신뢰도가 높아 blocking 사유는 아니지만, "실제 NestJS 파이프라인(HTTP 핸드셰이크·서명검증·raw body)에서 재도착이 실제로 억제되는지"는 아직 e2e 로 고정되지 않았다는 점만 기록한다.
  - 제안: 후속에서 provider 하나(예: telegram)에 같은 raw body 를 2회 POST 해 두 번째가 202-ignored + execution 미증가임을 확인하는 e2e 1건 추가를 고려.

발견된 CRITICAL/WARNING 은 없다. 기능 완전성·엣지 케이스(빈 키·trigger 스코프·Redis 부재/에러)·에러 시나리오(fail-open+warn)·비즈니스 규칙(rate-limit 보다 앞·쿼터 미소비)·반환값(모든 경로에서 boolean)·spec fidelity(키 포맷·TTL·NX·fail-open 문구) 전부 구현과 일치를 확인했다. TODO/FIXME/HACK/XXX 주석은 신설 파일에 없다.

## 요약

`ChatChannelDedupService` 신설과 `HooksService` 배선은 이번 PR 에서 함께 갱신된 `spec/5-system/15-chat-channel.md` CCH-SE-02 문면과 키 포맷·TTL·NX 원자성·fail-open 정책·삽입 위치(파싱 직후·rate-limit 앞)까지 line-level 로 일치한다. DI 등록(module providers/exports, HooksModule 의 기존 ChatChannelModule import)도 올바르며, 빈 idempotencyKey·Redis 부재·Redis 런타임 에러 세 엣지 케이스가 모두 테스트와 함께 방어돼 있고 서비스 단위·호출부(hooks.service) 양쪽 테스트가 "호출부가 반환값을 버리는" 회귀까지 포착한다. 발견된 사항은 모두 INFO 수준(spec 문구의 "+warn" 이 두 fail-open 갈래를 뭉뚱그린 점 — 기존 형제 클래스 관례와는 일치, JSDoc 의 세 번째 true 경로 누락, e2e 부재)이며 코드 fix 를 요구하는 CRITICAL/WARNING 은 없다.

## 위험도

LOW
