# 신규 식별자 충돌 검토 — CCH-SE-02 (`ChatChannelDedupService`)

## 검토 범위 확정

`_prompts/naming_collision.md` 의 target 섹션(`spec/5-system/`) 본문 다수와 code diff 섹션이
컨텍스트 예산 초과로 절단되어 있어, 실제 target 변경분을 HEAD 워킹트리에서 직접
`git diff origin/main...HEAD` 로 재확인했다. 실질 diff 는 다음으로 좁혀진다 (spec 프롬프트에
번들된 `15-chat-channel.md`/`4-execution-engine.md` 전문은 기존 원문과 CCH-SE-02 한 행 재작성을
제외하면 origin/main 대비 신규가 아니다):

- `spec/5-system/15-chat-channel.md` — CCH-SE-02 행 재서술 (기존 ID, 신규 아님)
- `spec/4-nodes/7-trigger/providers/telegram.md` — 동일 갭 서술 정정
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규 파일)
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` (신규 파일)
- `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` (provider/export 등록)
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts` (배선)
- `CHANGELOG.md` (Unreleased 항목 추가)

이번 target 이 새로 도입하는 식별자는: 클래스 `ChatChannelDedupService`, 함수
`makeChatDedupKey`, 상수 `CHAT_DEDUP_WINDOW_SEC`, Redis 키 네임스페이스 `cc:dedup:<triggerId>:<idempotencyKey>`,
DI 토큰 문자열 `'CHAT_CHANNEL_DEDUP_REDIS'`, 파일 `chat-channel-dedup.service.ts`(`.spec.ts`) 6종.
요구사항 ID `CCH-SE-02` 자체는 기존 ID 재서술이라 "신규 부여" 대상이 아니다(신규 ID 충돌 관점
비해당).

## 점검 결과 (관점별)

### 1. 요구사항 ID 충돌 — 해당 없음
`CCH-SE-02` 는 이미 존재하던 ID 의 문면 정정이며, 이번 diff 가 새로 부여한 ID 는 없다.

### 2. 엔티티/타입명 충돌 — 충돌 없음
- `ChatChannelDedupService`: repo 전체(`spec/`, `codebase/`, `review/`, `CHANGELOG.md`) grep 결과
  이번 diff 이전에는 어디에도 존재하지 않았다. 형제 클래스 `ChatChannelRateLimiterService` /
  `PublicWebhookQuotaService` 와 이름 패턴이 겹치지 않고 오히려 명명 컨벤션(`ChatChannel<책임>Service`)
  을 그대로 따른다.
- `makeChatDedupKey` / `CHAT_DEDUP_WINDOW_SEC`: 형제 파일의 `makeChatRateLimitKey`(추정) /
  `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 패턴과 동일 명명 관례를 따르고, 다른 곳에서 재사용되는
  이름이 아니다.
- 메서드명 `claim()`: 실행 엔진 쪽에 "원자 claim"(`reclaimStuckRunningExecution`,
  `tryLockActiveExecutionAndSaveNodeExec` 등 §7.5) 이라는 도메인 용어가 이미 널리 쓰이지만,
  실제 메서드 심벌로서의 `claim(...)` 은 `ChatChannelDedupService` 에만 존재한다(grep 확인,
  execution-engine 쪽은 주석 텍스트에서만 "claim" 을 사용). 의미도 "무언가를 선점해 중복을
  막는다"로 상통해 혼동 유발보다는 의도적 관용구 일관성에 가깝다 — 충돌 아님(INFO 수준으로도
  보고하지 않음).

### 3. API endpoint 충돌 — 해당 없음
이번 diff 는 신규 HTTP endpoint 를 추가하지 않는다(기존 `POST /api/hooks/:endpointPath` 내부
분기 삽입).

### 4. 이벤트/메시지명 충돌 — 해당 없음
신규 webhook/queue/SSE 이벤트명 도입 없음. 응답 sentinel `{ executionId: 'ignored' }` 은
CCH-NF-03(rate-limit)에서 이미 쓰던 값의 재사용이며 의미도 "이 update 는 처리 생략" 으로
동일해 문제없다.

### 5. 환경변수·설정키 충돌 — 충돌 없음
`CHAT_DEDUP_WINDOW_SEC` 는 하드코드 TS 상수(값 30)이며 `process.env` 로 노출되는 실제 환경변수가
아니다(grep 확인 — `.env`/docker 설정 어디에도 없음). DI 토큰 문자열 `'CHAT_CHANNEL_DEDUP_REDIS'`
도 `CHAT_CHANNEL_RATE_LIMIT_REDIS` / `INTERACTION_TOKEN_REDIS` / `IDEMPOTENCY_REDIS` 등 기존
토큰 목록과 겹치지 않는 고유 문자열이다(전 서비스가 각자 고유 접두 토큰을 쓰는 기존 관례 그대로).

### 6. 파일 경로 충돌 — 충돌 없음
`chat-channel-dedup.service.ts` / `.spec.ts` 는 같은 디렉터리의 `chat-channel-rate-limiter.service.ts`
와 동일한 kebab-case `<domain>-<책임>.service.ts` 컨벤션을 따르고, 기존 파일과 경로가 겹치지
않는다.

### 부수 확인 — Redis 키 네임스페이스
새 키 접두 `cc:dedup:` 는 같은 모듈의 기존 `cc:rl:`(rate-limiter) 와 하위 네임스페이스만 다르고
공통 `cc:` prefix 를 공유해 일관적이다. `spec/5-system/4-execution-engine.md §9.1` 이 선언하는
전역 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴과는 형식이 다르지만(트리거 스코프,
워크스페이스 미포함), 이는 이번 diff 가 새로 만든 이탈이 아니라 기존 `cc:rl:` 부터 이미 있던
사전 존재 상태이므로 "신규 식별자 충돌" 범위 밖이다.

## 요약

이번 target 변경(CCH-SE-02, `ChatChannelDedupService` 신설)이 도입하는 신규 식별자
6종(클래스·함수·상수·Redis 키 네임스페이스·DI 토큰·파일 경로 2건)을 모두 저장소 전체
grep 으로 대조한 결과, 기존 사용처와 다른 의미로 충돌하는 사례는 발견되지 않았다. 신규
심벌은 형제 서비스(`ChatChannelRateLimiterService`, `PublicWebhookQuotaService`)의 명명·DI
토큰·Redis 키 네임스페이스 관례를 그대로 재사용해 오히려 일관성이 높다. 요구사항 ID
재서술(CCH-SE-02)도 신규 ID 부여가 아니라 기존 ID 의 정정이라 ID 충돌 관점에서 해당 없음.

## 위험도

NONE
