# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 조사 범위 정정

prompt_file 이 조립한 `spec/5-system/` 번들은 컨텍스트 예산 초과로 대부분(`14-external-interaction-api.md` 포함 17개 파일)과 실제 `git diff origin/main...HEAD -- code_areas` 섹션이 **절단**되어 있었다. 절단된 프롬프트만으로는 이번 turn 이 실제로 무엇을 바꿨는지 알 수 없어, 지시된 절차대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접 `git diff origin/main...HEAD`를 재구성해 대상을 확정했다.

실제 diff 는 `CCH-SE-02`(chat-channel update dedup) 구현 1건이다:

- 신규 코드: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts`(+ `.spec.ts`)
- 배선 변경: `chat-channel.module.ts`, `hooks/hooks.service.ts`(+ `.spec.ts`)
- spec 변경: `spec/5-system/15-chat-channel.md`(CCH-SE-02 행 재작성 + `R-CC-20` rationale 신설), `spec/4-nodes/7-trigger/providers/telegram.md`(Planned→구현됨 갱신), `spec/data-flow/14-chat-channel.md`(Redis 키 테이블에 `cc:dedup:*` 행 추가, 및 기존 `cc:rl:*` 행 backfill)

이 turn 이 새로 도입하는 식별자를 전수 grep 하여 기존 사용처와 대조했다.

## 발견사항

이번 diff 가 도입하는 신규 식별자(클래스 `ChatChannelDedupService`, 함수 `makeChatDedupKey`, 상수 `CHAT_DEDUP_WINDOW_SEC`, DI 토큰 `'CHAT_CHANNEL_DEDUP_REDIS'`, Redis 키 네임스페이스 `cc:dedup:{triggerId}:{idempotencyKey}`, Rationale ID `R-CC-20`) 는 워킹트리 전수 검색(`git grep -n <식별자> HEAD`) 결과 **모두 이 diff 이전에 존재하지 않았고, 이 diff 가 도입한 위치 외에는 나타나지 않는다** — 다른 의미로 이미 쓰이고 있는 충돌 사례를 찾지 못했다.

- **[INFO]** Redis 키 네임스페이스 표기 스타일 불일치 (충돌 아님, 일관성 참고)
  - target 신규 식별자: `cc:dedup:{triggerId}:{idempotencyKey}` (`spec/data-flow/14-chat-channel.md:196`, `chat-channel-dedup.service.ts:6`)
  - 기존 사용처: 같은 표(`spec/data-flow/14-chat-channel.md`)의 다른 두 행 — `chat-channel:{triggerId}:{conversationKey}`, `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit` (verbose 접두사) 대비, 신규/기존 rate-limit 키는 `cc:rl:{triggerId}:{conversationKey}` (약어 접두사, `chat-channel-rate-limiter.service.ts:9`, 이 diff 이전인 PR #572 부터 존재)
  - 상세: 같은 Redis keyspace 문서 안에 `chat-channel(-lock):` 계열과 `cc:` 계열 두 네이밍 스타일이 공존한다. `cc:dedup:` 는 선례(`cc:rl:`)를 그대로 따른 것이라 새로 만든 불일치는 아니며, 문자열 자체가 겹치지 않아(세그먼트 2 가 `dedup` vs `rl` 로 분기) 실제 키 충돌 가능성은 없다.
  - 제안: 조치 불요. 스타일 통일은 이번 diff 단독 책임 밖(선행 PR 부터의 기존 관행)이라 별도 정리 PR 사안이면 충분.

## 요약

이번 turn 이 실제로 도입한 신규 식별자(요구사항 ID 는 신설이 아니라 기존 `CCH-SE-02` 문면 재작성; 신규 엔티티는 `ChatChannelDedupService`/`makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC`/DI 토큰 `CHAT_CHANNEL_DEDUP_REDIS`/Redis 키 `cc:dedup:*`/Rationale `R-CC-20`)를 codebase·spec·plan 전수와 대조한 결과, 다른 의미로 이미 사용 중인 이름과 겹치는 CRITICAL/WARNING 급 충돌은 없다. API endpoint·webhook/queue/sse 이벤트명·환경변수·파일 경로 신설도 이번 diff 범위에 없다(`ChatChannelDedupService` 는 기존 sibling 서비스(`ChatChannelRateLimiterService`, `PublicWebhookQuotaService`)와 동일한 명명 컨벤션·DI 토큰 패턴을 그대로 따라 확장했을 뿐, 겹치는 이름을 만들지 않았다). 유일하게 언급할 사항은 Redis 키 표기 스타일(`cc:` 약어 vs `chat-channel(-lock):` verbose)의 문서 내 공존인데, 이는 이번 diff 가 새로 만든 불일치가 아니고 문자열 충돌도 없어 INFO 수준이다. 참고로 동일 대상에 대해 이미 3라운드의 `/ai-review` 코드 리뷰(`review/code/2026/08/13/{02_38_41,02_50_38,09_09_58}/`)가 architecture/maintainability 축에서 "형제 클래스와 생성자 골격이 거의 동일하다"는 지적을 INFO 로 남긴 바 있으나, 이는 구조적 중복이지 식별자 충돌은 아니다.

## 위험도
NONE
