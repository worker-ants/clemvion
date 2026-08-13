# 신규 식별자 충돌 검토 — CCH-SE-02 dedup (chat-channel)

## 검토 범위 확인

`_prompts/naming_collision.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md` 본문과 `<git diff origin/main...HEAD -- code_areas>` 섹션이 절단되어 있었다. 이 두 섹션이 target 의 실제 diff 를 담고 있어 번들만으로는 "무엇이 새로 도입됐는지" 판단 불가능 — 절단을 신뢰하지 않고 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 `git diff origin/main...HEAD` 를 직접 재실행해 실제 diff 를 확보한 뒤 분석했다.

실제 diff 는 `spec/5-system/` 범위 안에서 **CCH-SE-02 (chat-channel inbound update dedup)** 1건이다: `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/conventions/redis-keys.md`, `spec/data-flow/14-chat-channel.md` 문서 변경 + `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts`(신규) 등 구현.

## target 이 새로 도입한 식별자 목록

| 종류 | 식별자 |
|---|---|
| Rationale ID | `R-CC-20` |
| 클래스 | `ChatChannelDedupService` |
| 함수 | `makeChatDedupKey` |
| 상수 | `CHAT_DEDUP_WINDOW_SEC` (=30) |
| DI 토큰 | `'CHAT_CHANNEL_DEDUP_REDIS'` |
| Redis 키 패턴 | `cc:dedup:<triggerId>:<updateId>` |
| 파일 경로 | `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (+`.spec.ts`) |

## 점검 결과 (관점별)

1. **요구사항 ID 충돌** — `R-CC-20` 은 `spec/5-system/15-chat-channel.md` 전체에서 유일하게 1회 등장 (`grep -rn "R-CC-20" spec/ codebase/` → 1건). 기존 최대 번호는 `R-CC-19` 였으므로 다음 번호로 정상 채번, 재사용 아님. `CCH-SE-02` 자체는 새 ID 가 아니라 기존 ID 의 요구사항 본문 개정(EIA `Idempotency-Key` 자동발급 서술 → 전용 dedup 서비스 서술)이며, 개정 후 참조처(`spec/4-nodes/7-trigger/providers/telegram.md`, `spec/data-flow/14-chat-channel.md`)가 모두 새 서술과 일치 — stale 참조 없음. 충돌 없음.

2. **엔티티/타입명 충돌** — `ChatChannelDedupService` 는 codebase 전체에서 신규 파일 3곳(서비스 본체·spec·module 등록)과 `hooks.service.ts`/`hooks.service.spec.ts` 참조 외 다른 의미로 쓰인 곳 없음. `makeChatDedupKey` 도 마찬가지로 신규 정의 1곳 + 자신의 테스트에서만 import. 자매 서비스 `ChatChannelRateLimiterService` 의 `makeChatRateLimitKey` / `CHAT_RATE_LIMIT_WINDOW_SEC` / `'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 명명 패턴과 대조해도 접두사(`Dedup` vs `RateLimit`)로 명확히 분리되어 혼동 가능성 낮음. 충돌 없음.

3. **API endpoint 충돌** — 이번 변경은 신규 endpoint 를 추가하지 않는다 (기존 `POST /api/hooks/:endpointPath` 내부 처리 흐름에 dedup 게이트를 삽입한 것). 검토 대상 없음.

4. **이벤트/메시지명 충돌** — webhook/queue/SSE 이벤트 신설 없음. 로그 메시지 문자열(`"chat-channel update dedup 실패 — fail-open..."`, `"chat-channel update 재도착 무시 (CCH-SE-02, ...)"`)도 다른 모듈의 로그 문자열과 겹치지 않음(자체 module 접두 포함). 검토 대상 없음.

5. **환경변수·설정키 충돌** — `'CHAT_CHANNEL_DEDUP_REDIS'` 는 실제 ENV var 가 아니라 NestJS DI 토큰(테스트 주입용) 문자열이며, `.env`/config 어디에도 동일 키로 등록된 바 없다. 자매 토큰 `'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 와도 이름이 명확히 분리. 충돌 없음.

6. **파일 경로 충돌** — `chat-channel-dedup.service.ts`(+ `.spec.ts`) 경로는 기존 `chat-channel-rate-limiter.service.ts` 명명 컨벤션(`chat-channel-<역할>.service.ts`)을 그대로 따른다. 동일 경로에 기존 파일 없음(신규 생성). `spec/5-system/15-chat-channel.md` frontmatter 의 `code:` glob (`codebase/backend/src/modules/chat-channel/**`)이 이미 신규 파일을 포함하므로 frontmatter 갱신 누락도 없음. 충돌 없음.

## 발견사항

- **[INFO]** Rationale 섹션의 읽기 순서와 번호가 어긋남
  - target 신규 식별자: `R-CC-20` (`spec/5-system/15-chat-channel.md:710`)
  - 기존 사용처: 바로 다음 섹션인 `R-CC-19` (`spec/5-system/15-chat-channel.md:720`, 기존 항목·CCH-NF-03 관련)
  - 상세: 문서 본문에서 `### R-CC-18` → `### R-CC-20` → `### R-CC-19` 순서로 배치되어, 번호가 더 큰 `R-CC-20` 이 번호가 더 작은 `R-CC-19` 보다 먼저 등장한다. 식별자 자체의 재사용·의미 충돌은 아니지만(각 ID 는 1회씩만 쓰임), 위에서 아래로 훑는 독자나 "다음 빈 번호"를 눈으로 찾는 향후 작성자에게는 순서-번호 불일치가 혼동 요인이 될 수 있다.
  - 제안: `R-CC-20` 절을 `R-CC-19` 절 뒤로 옮기거나(번호·순서 일치), 혹은 신규 절을 `R-CC-18`과 기존 `R-CC-19` 사이에 두고 싶다면 번호를 `R-CC-18a` 류가 아니라 기존 `R-CC-19`를 뒤로 밀어 `R-CC-20`으로, 신규를 `R-CC-19`로 재번호(연쇄 변경 필요해 실익 낮음) — 실무적으로는 **위치만 이동**하는 편이 가장 저비용. 비차단.

## 요약

target(CCH-SE-02 chat-channel dedup, `spec/5-system/` 범위)이 새로 도입한 식별자 — Rationale ID `R-CC-20`, 클래스 `ChatChannelDedupService`, 함수 `makeChatDedupKey`, 상수 `CHAT_DEDUP_WINDOW_SEC`, DI 토큰 `'CHAT_CHANNEL_DEDUP_REDIS'`, Redis 키 `cc:dedup:<triggerId>:<updateId>`, 파일 `chat-channel-dedup.service.ts` — 전부 codebase/spec 전역에서 유일하게 1회씩만 정의·사용되며, 기존 자매 서비스(`ChatChannelRateLimiterService` 계열)의 명명 패턴과도 접두사로 명확히 분리되어 있어 실질적 충돌은 없다. `CCH-SE-02` 요구사항 본문이 개정됐지만 참조처 전체(telegram provider spec, data-flow 문서, redis-keys.md)가 동일하게 갱신되어 stale 서술도 없다. 유일한 지적사항은 Rationale 절 배치 순서(R-CC-20 이 R-CC-19 보다 먼저 등장)로, 이는 식별자 충돌이 아니라 가독성 수준의 INFO.

## 위험도
NONE
