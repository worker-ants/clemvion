### 검토 개요

target: `spec/5-system/` (impl-done, diff-base `origin/main`). 프롬프트 번들은 `spec/5-system/14-external-interaction-api.md` 를 포함해 16개 파일과 코드 diff 본문이 컨텍스트 예산 초과로 생략되어 있어, 실제 PR 의 diff·변경 파일은 별도로 `git diff origin/main...HEAD` 와 절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)로 직접 확인했다. 실제 변경 범위는 좁다 — CCH-SE-02 (chat-channel update dedup) 구현 1건:

- 코드: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규) + spec/테스트, `chat-channel.module.ts`, `hooks/hooks.service.ts`(+spec)
- spec: `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/conventions/redis-keys.md`, `spec/data-flow/14-chat-channel.md`

### 발견사항

- **[INFO]** Redis 키 placeholder 이름이 문서 3곳에서 다르게 표기됨
  - target 위치: `spec/5-system/15-chat-channel.md` CCH-SE-02 항목 및 `spec/conventions/redis-keys.md` §3 인벤토리는 `cc:dedup:<triggerId>:<updateId>` 로, `spec/data-flow/14-chat-channel.md` §2 표는 `cc:dedup:{triggerId}:{idempotencyKey}` 로 표기
  - 위반 규약: `spec/conventions/redis-keys.md` §1 (키 형태 — 도메인:용도:식별자). 형태 자체는 두 표기 모두 규약을 만족하지만, 같은 키를 가리키는 placeholder 명이 문서마다 다르다
  - 상세: 실제 필드명(`ChannelUpdate.idempotencyKey`, 코드의 `claim(triggerId, idempotencyKey)` 파라미터)은 `idempotencyKey` 인데, chat-channel spec 본문과 redis-keys 인벤토리는 `updateId` 를 쓴다. 기능상 영향은 없으나 문서 간 SoT 대조 시 사소한 혼동 소지
  - 제안: `15-chat-channel.md` CCH-SE-02·`redis-keys.md` §3 의 `<updateId>` 를 `<idempotencyKey>` 로 통일 (코드·data-flow 문서와 정렬)

- **[INFO]** 신규 Rationale `R-CC-20` 이 기존 `R-CC-19` 보다 문서상 앞에 삽입되어 번호가 읽는 순서와 어긋남
  - target 위치: `spec/5-system/15-chat-channel.md` — `### R-CC-18` 다음 `### R-CC-20`(신규) 다음 `### R-CC-19`(기존) 순서로 배치됨 (origin/main 에는 R-CC-19 가 이미 최종 항목이었음)
  - 위반 규약: 엄밀히는 `spec/conventions/**` 항목이 아니라 target 문서 자체가 선언한 로컬 컨벤션(`### Rationale ID 컨벤션`, 15-chat-channel.md L604-606) — "신규 항목은 R-CC-N prefix" 라고만 명시하고 물리적 순서까지는 규정하지 않아 엄밀한 위반은 아니다. 다만 그 컨벤션의 채택 취지 자체가 "검토자의 혼동 방지"이므로, 20 이 19 보다 앞에 나오는 배치는 그 취지와 결이 어긋난다
  - 상세: 참고로 origin/main 시점에 이미 `R-CC-13`→`R-CC-15`(14 결번)의 기존 갭이 있었으나 이는 본 PR 이전부터 존재했고 본 PR 이 만든 문제가 아니다. 본 PR 이 새로 만든 것은 "20이 19보다 먼저 나오는" 배치 하나
  - 제안: 최소 조치로 새 항목을 `R-CC-19` 뒤(문서 최말단)에 위치시키거나, 번호를 다음 여석에 맞게(`R-CC-20`을 그대로 두되 R-CC-19 뒤로 이동) 재배치. 이 항목은 `rationale_continuity`/`cross_spec` 리뷰어 관점과도 겹칠 수 있어 중복 지적이면 무시 가능

### 준수 확인 (참고 — 위반 아님)

다음은 결함이 아니라 규약을 정확히 지킨 사례로, 반대 방향(누락 오탐)을 배제하기 위해 기록한다:

- `chat-channel-dedup.service.ts` 의 클래스명·함수명·상수명·DI 토큰명(`ChatChannelDedupService`/`makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC`/`'CHAT_CHANNEL_DEDUP_REDIS'`)이 형제 서비스 `chat-channel-rate-limiter.service.ts`(`ChatChannelRateLimiterService`/`makeChatRateLimitKey`/`CHAT_RATE_LIMIT_WINDOW_SEC`/`'CHAT_CHANNEL_RATE_LIMIT_REDIS'`)와 정확히 대칭 — 모듈 내 명명 패턴 일관
- 신규 Redis 키 `cc:dedup:<triggerId>:<updateId>` 는 `spec/conventions/redis-keys.md` §1 형태 규칙(`{도메인}:{용도}[:{식별자}...]`)을 만족하고, §5("새 키를 도입하면 등재") 의무에 따라 §3 인벤토리에 실제로 등재됨
- `spec/5-system/15-chat-channel.md`·`spec/4-nodes/7-trigger/providers/telegram.md`·`spec/conventions/redis-keys.md` 프론트매터 `code:` 글로브가 신규 파일(`chat-channel/chat-channel-dedup.service.ts` 등)을 이미 포괄해, `spec/conventions/spec-impl-evidence.md` §4 가드(`spec-code-paths.test.ts`) 재통과 조건을 깨지 않음. `status: partial` 유지도 남은 `pending_plans` 존재와 일치해 라이프사이클 규칙(§3.1) 위반 없음
- 테스트 파일명(`chat-channel-dedup.service.spec.ts`)·DI mock 등록 패턴이 기존 형제 서비스 테스트와 동일 스타일

### 요약

이번 diff 는 스코프가 CCH-SE-02 dedup 서비스 1건으로 매우 좁고, 명명(클래스/함수/상수/DI 토큰)·Redis 키 형태·frontmatter evidence·Rationale ID prefix 등 핵심 정식 규약 항목을 모두 기존 형제 코드/문서 패턴과 정확히 대칭되게 준수했다. 발견된 두 건은 모두 INFO 수준의 문서 표기 일관성 문제(placeholder 이름 불일치, Rationale 번호 배치 순서)로, 기능·계약에 영향이 없고 CRITICAL/WARNING 급 정식 규약 위반은 확인되지 않았다.

### 위험도
LOW
