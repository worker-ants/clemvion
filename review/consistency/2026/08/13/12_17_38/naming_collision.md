# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토한 실제 diff

Bundle 프롬프트 내 `## 구현 변경 사항` diff 본문은 예산 초과로 생략되어 있어, 워킹트리에서
`git diff origin/main...HEAD` 로 직접 재확인했다 (지시된 절차대로). 실제 변경 파일 7개:

```
plan/in-progress/backend-lint-gate-broken-on-main.md   | 42 (plan 갱신, spec 아님)
spec/4-nodes/4-integration/4-cafe24.md                 |  5 +
spec/4-nodes/7-trigger/providers/discord.md            |  2 (수정)
spec/4-nodes/7-trigger/providers/slack.md              |  6 +
spec/5-system/12-webhook.md                            | 11 +
spec/conventions/redis-keys.md                         |  5 (수정)
spec/data-flow/14-chat-channel.md                      |  4 +
```

커밋 메시지("인벤토리가 가리키는 절에 키가 없었다 — 빈 포인터가 하나가 아니라 둘")와 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트가 명시하듯, 이번 변경은 **신규 식별자 도입이 아니라 기존(이미 구현·테스트된) Redis 키 리터럴을 문서 포인터 사이에 채우고 SoT 포인터를 바로잡는 작업**이다. 아래는 diff 가 건드린 식별자를 전수 대조한 결과다.

## 점검 결과 (관점별)

1. **요구사항 ID 충돌** — diff 에 신규 `WH-*`/`EIA-*`/`CCH-*` 요구사항 ID 행 없음. 해당 없음.
2. **엔티티/타입명 충돌** — `ChatChannelDedupService` 가 discord.md·slack.md 에 처음 등장하지만, `spec/5-system/15-chat-channel.md` CCH-SE-02(88행)·Rationale(725행)·`telegram.md`(235행)에 이미 동일 서비스·동일 Redis 키 패턴(`cc:dedup:<triggerId>:<idempotencyKey>`)으로 정의돼 있다. discord/slack 은 그 패턴에 `idempotencyKey = interaction.id` / `event_id`·`trigger_id` 를 대입하는 것뿐 — 신규 타입 도입도, 기존 타입의 의미 재정의도 아니다. 충돌 없음.
3. **API endpoint 충돌** — diff 에 신규 endpoint(method+path) 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음. 해당 없음.
5. **환경변수·설정키 충돌** — `UNIDENTIFIED_IP_BUCKET`/`__no_client_ip__` sentinel, `wh:rl:min:<ip>`/`wh:rl:hour:<ip>` 키는 이미 `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts`(164행)·`public-webhook-throttle.guard.ts`·해당 spec 테스트에 구현·검증돼 있음을 코드로 직접 확인했다. 12-webhook.md 는 그 기존 코드를 처음으로 문서화한 것 — 신규 도입 아님. `cafe24:install:nonce:<mall_id>:<ts>:<hmac 앞 8자>` 도 기존 키의 서술을 `<hmac>` → `<hmac 앞 8자>` 로 정확화한 것뿐(코드 559행 주석과 일치). 충돌 없음.
6. **파일 경로 충돌** — diff 는 기존 7개 파일만 수정하며 신규 spec 파일을 만들지 않는다. 해당 없음.

## 발견사항

- **[INFO]** 다중 접두 모듈 각주가 `chat-channel` 을 놓치고 있다
  - target 신규 식별자: `spec/conventions/redis-keys.md` §3 인벤토리에 신설된 행 — `chat-channel:<triggerId>:<conversationKey>` · `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` (61행). 이 diff 로 인해 `modules/chat-channel` 이 인벤토리 안에서 **두 개의 서로 다른 접두 계열**(verbose `chat-channel:`/`chat-channel-lock:` vs 약어 `cc:rl:`/`cc:dedup:`, 62행)을 나란히 보유한다는 사실이 처음으로 표면화됐다.
  - 기존 사용처: 같은 파일 67-69행 — "`external-interaction` 이 `iext:`·`interaction:`·`eia:` 를 병용한다 … 다만 넷째가 생기지 않도록 사실을 남긴다" 라는 각주가 있는데, 이 각주는 `external-interaction` 만 지목하고 지금 diff 가 나란히 등재한 `chat-channel` 의 2-계열 상황은 언급하지 않는다.
  - 상세: 두 접두가 실제로 충돌하는 것은 아니다(문자열이 겹치지 않는다) — 다만 규약 문서가 "다중 접두 모듈"을 명시적으로 추적하겠다고 선언해 놓고 이번에 새로 나란히 보이게 된 `chat-channel` 사례를 그 추적 목록에서 빠뜨렸다. 향후 세 번째 chat-channel 접두가 생겨도 이 각주만 보고는 "이미 다중 접두였다"는 사실을 놓치기 쉽다.
  - 제안: 67-69행 각주에 `chat-channel`(verbose/약어 병용) 한 줄을 추가하거나, "다중 접두 모듈: external-interaction, chat-channel" 로 목록화한다. 코드 변경 불필요 — 문서 각주 확장만으로 충분.

- **[INFO]** `chat-channel:` 계열이 §1 키 형태 규칙(`{도메인}:{용도}[:{식별자}...]`)의 "용도" 세그먼트를 생략한다
  - target 신규 식별자: 위와 동일 행(61행)의 `chat-channel:<triggerId>:<conversationKey>` — 도메인(`chat-channel`) 바로 뒤에 "용도" 세그먼트 없이 식별자(`triggerId`)가 온다. 자매 `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` 은 반대로 "용도"에 해당하는 `formsubmit` 을 **꼬리**에 둔다.
  - 기존 사용처: `spec/conventions/redis-keys.md` §1(31-42행) — "머리 2세그먼트 고정(도메인:용도) + 꼬리 가변"을 규칙으로 선언하고, `cc:rl:<triggerId>:...`/`cc:dedup:<triggerId>:...`(62행)·`eia:rl:interact:<executionId>`(60행) 등 다른 모든 인벤토리 행은 이 규칙을 따른다.
  - 상세: 이 키 자체는 이번 diff 신규가 아니라 기존 구현(`channel-conversation.service.ts` 179·183행)을 처음 인벤토리에 등재한 것이라 "충돌"은 아니지만, 규약 문서 §1 이 스스로 세운 형태 규칙에 새로 등재된 자기 항목이 어긋나는 상태로 병기된다.
  - 제안: 문서적 각주만으로 처리 가능("레거시 예외"로 표시) — 키 형태 자체를 바꾸는 코드 변경은 배포 전환기 고아 엔트리를 만들어 규약 문서 §Rationale 이 이미 명시적으로 기각한 접근이므로 권장하지 않는다.

## 요약

이번 diff(`spec/5-system/12-webhook.md`, `spec/conventions/redis-keys.md`, `spec/data-flow/14-chat-channel.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/7-trigger/providers/{discord,slack}.md`)는 신규 식별자를 도입하지 않는다 — 전부 이미 코드에 구현·테스트된 Redis 키(`wh:rl:min/hour:<ip>`, `UNIDENTIFIED_IP_BUCKET`, `chat-channel:*`, `chat-channel-lock:*`, `cc:dedup:<triggerId>:<idempotencyKey>`, `cafe24:install:*`)와 서비스(`ChatChannelDedupService`)를 문서 간 누락된 포인터·서술 비대칭을 메우는 데 사용한다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 6개 관점 전부에서 기존 사용처와의 의미 충돌은 발견되지 않았다. 유일한 관찰은 규약 문서(`redis-keys.md`) 자신의 "다중 접두 각주"·"머리 2세그먼트 규칙"이 이번에 처음 나란히 노출된 `chat-channel` 사례를 완전히 커버하지 못한다는 문서 일관성 수준의 INFO 2건이며, 둘 다 코드나 spec 의 의미를 바꾸지 않는 각주 보완 수준이다.

## 위험도
NONE
