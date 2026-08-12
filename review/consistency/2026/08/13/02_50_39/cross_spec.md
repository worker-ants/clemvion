# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

검토 대상 실제 diff: `spec/5-system/15-chat-channel.md` CCH-SE-02 재작성 + `spec/4-nodes/7-trigger/providers/telegram.md` 동기화 (`ChatChannelDedupService` 신설, commits `312d1d990`/`faf6a7b1e`). "eia-r8-cache-scope" 워크트리 이름과 달리 실제 diff 는 EIA §R8(Idempotency-Key 캐시 스코프)과 무관 — chat-channel CCH-SE-02 update-dedup 구현이다. 이 사실을 확인한 뒤 그 diff 를 `spec/**` 전역과 대조했다.

## 발견사항

- **[WARNING]** Redis 키 네이밍 컨벤션(§9.1) 미해소 — 처분 근거(PR #1160)가 아직 미병합
  - target 위치: `spec/5-system/15-chat-channel.md:88` (CCH-SE-02 — 신규 키 `cc:dedup:<triggerId>:<updateId>`)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §9.1/§9.2 (Redis 키 네이밍 컨벤션 SoT — "모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 따른다")
  - 상세: §9.1 은 "모든 Redis 키" 가 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 따른다고 선언한다. §9.2 하단에 워크스페이스 비종속 전역 키 예외(`exec:recover:lock`, `exec:cont:seq:<executionId>`, `exec:seq:<executionId>`)가 명시돼 있지만, chat-channel 계열 키(`cc:dedup:`, `cc:rl:`, `chat-channel:`, `chat-channel-lock:`)는 이 문서 어디에도 등장하지 않는다(`grep "cc:\|chat-channel:" spec/5-system/4-execution-engine.md` → 0건, 직접 확인). 이번 diff 가 CCH-SE-02 로 신설한 `cc:dedup:<triggerId>:<updateId>` 는 기존 `cc:rl:<triggerId>:<conversationKey>` 와 동형이라 "새로운 종류의" 위반은 아니지만, 미등재 패턴의 표면을 하나 더 늘린다.
    같은 세션의 `review/code/2026/08/13/02_38_41/RESOLUTION.md` (항목 4)는 이 위반을 "조치 불요 — [#1160](https://github.com/worker-ants/clemvion/pull/1160) 이 그 규칙 자체를 사실에 맞게 고쳤다. `cc:` 접두는 이제 규약에 등재된 정상 형태다" 로 처분했다. 그러나 `gh pr view 1160` 로 직접 확인한 결과 **PR #1160 은 `state: OPEN` (미병합)** 이고 base=`main`, head=`claude/eia-redis-key-registry` 인 **별도 브랜치의 아직 오픈된 PR** 이다 (title: `docs(spec): "모든 Redis 키는 이 패턴" 이라 선언했는데 따르는 키가 하나도 없었다` — 정확히 이 문제를 다루는 PR 이지만 아직 main 에 반영되지 않았다). 즉 현재 워크트리(`spec/5-system/4-execution-engine.md`)의 실제 내용 기준으로는 이 WARNING 의 근거가 **아직 사실이 아니며**, target 이 이 상태로 머지되면 §9.1 규약과의 충돌은 미해소인 채로 남는다.
  - 제안: PR #1160 이 실제로 병합되기 전까지는 RESOLUTION 의 "조치 불요" 처분 문구를 "PR #1160 병합 후 해소 예정(그 전까지는 §9.1 위반 상태 유지)" 으로 정정하거나, §9.1/§9.2 에 chat-channel 전역(워크스페이스 비종속, per-trigger 스코프) 키 예외 카테고리를 `exec:recover:lock` 등과 동일한 방식으로 즉시 명시할 것. 두 PR 중 하나를 다른 하나보다 먼저 머지해야 하는 순서 의존성이 실질적으로 존재한다.

- **[WARNING]** data-flow 미러 문서가 새 dedup 게이트를 반영하지 않음
  - target 위치: `spec/5-system/15-chat-channel.md:88` (CCH-SE-02) + `codebase/backend/src/modules/hooks/hooks.service.ts:328-345` (parseUpdate → dedup → rate-limit 순서)
  - 충돌 대상: `spec/data-flow/14-chat-channel.md` §1.1 (inbound sequence diagram + `command` 별 sink 표) / §2.2 (Redis 스키마 매핑 표)
  - 상세: `data-flow/14-chat-channel.md` 는 스스로 "본 문서는 그 분기 이후의 source→sink 를 단일 진실로 둔다"(L15-16) 고 선언하고, §2.2 에 Redis 키 인벤토리 표(`chat-channel:{triggerId}:{conversationKey}`, `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit`, `chat-channel-token-rotator`)를 유지한다. 그러나 이번 diff 가 신설한 `cc:dedup:<triggerId>:<updateId>` (Redis `SET NX EX 30`) 키는 이 표에 없고, §1.1 의 inbound sequence mermaid 다이어그램(검증→활성 확인→handshake→parseUpdate→enrichInbound→lookup→interact/execute)에도 dedup 단계가 전혀 등장하지 않는다 — CCH-SE-02 가 명시하는 "parseUpdate 뒤 · rate-limit 앞" 순서가 이 미러 문서에는 반영돼 있지 않다. rate-limiter 키(`cc:rl:{triggerId}:{conversationKey}`, CCH-NF-03)도 §1.1 인라인 콜아웃(L88-94)에만 있고 §2.2 표에는 없어 동일 갭이 이미 있었다(신규 위반은 아니지만 이번 PR 이 그 갭 옆에 두 번째 미반영 키를 추가했다).
    이는 같은 PR 체인의 두 번째 커밋(`faf6a7b1e`)이 스스로 잡아 고친 W2 ("`providers/telegram.md` 가 아직 '미구현' 이라 적고 있었다")와 **정확히 같은 클래스의 갭** 이 다른 미러 문서(`data-flow/14-chat-channel.md`)에는 여전히 남아있는 사례다.
  - 제안: `spec/data-flow/14-chat-channel.md` §1.1 sequence diagram 에 dedup 단계(parseUpdate 이후, lookup 이전 — 또는 최소 인라인 콜아웃)를 추가하고, §2.2 Redis 표에 `cc:dedup:{triggerId}:{idempotencyKey}` (TTL 30s, CCH-SE-02) 행과 (기왕이면) `cc:rl:{triggerId}:{conversationKey}` (CCH-NF-03) 행을 추가해 매핑을 완전하게 할 것.

- **[INFO]** `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" 코드 트리에 신규 파일 누락
  - target 위치: `spec/5-system/15-chat-channel.md:471-493`
  - 상세: 이번 diff 가 신설한 `chat-channel-dedup.service.ts` 가 이 트리에 없다. 기존 `chat-channel-rate-limiter.service.ts` 도 이미 빠져 있던 pre-existing gap 이라 이번 PR 이 새로 만든 문제는 아니지만, 신규 파일도 같은 누락 패턴을 반복했다.
  - 제안: 트리에 두 파일(`chat-channel-rate-limiter.service.ts`, `chat-channel-dedup.service.ts`) 추가.

- **[INFO]** developer 턴에서의 `spec/` 직접 수정 — 이미 자체 인지·수용됨
  - target 위치: `spec/5-system/15-chat-channel.md` (commit `312d1d990`), `spec/4-nodes/7-trigger/providers/telegram.md` (commit `faf6a7b1e`)
  - 상세: `CLAUDE.md` 는 `developer` 스킬을 `spec/` read-only 로 규정하는데, 이번 두 커밋은 코드 구현과 같은 턴에서 `spec/` 파일을 직접 고쳤다 — 계층 책임(§6 검토 관점) 상 원칙적 이탈이다. 다만 커밋 메시지(`faf6a7b1e` W1)가 이 이탈을 스스로 명시하고 "새 결정이 아니라 기존 `필수` 요구사항의 메커니즘 서술 정정" 이라는 근거와 함께 인정했으며, `review/code/.../RESOLUTION.md` 에도 기록돼 있다 — 이미 처리된 사안이라 재차단할 근거는 아니지만 기록 차원에서 남긴다.
  - 제안: 조치 불요(이미 자체 처분·기록됨). 다만 언급된 "세션에서 planner 턴을 세 번 분리해 놓고 여기서만 합친 일관성 결여"는 이후 세션에서 습관화하지 않도록 참고.

- 확인했으나 문제 없음(참고): CCH-SE-02 신 문면의 `EIA-AU-08`(in-process trusted caller 예외) 인용은 `spec/5-system/14-external-interaction-api.md:96` 의 정의와 정확히 일치 — HTTP `IdempotencyInterceptor` 우회 근거로 타당하다. Slack `idempotencyKey`(= Slack 자체의 `trigger_id`, interaction 별 고유 nonce)는 Clemvion 의 `Trigger.id`(dedup 키의 첫 세그먼트)와 이름만 같을 뿐 별개 값이라 dedup 키 충돌 우려는 기각(코드 확인: `slack-update.parser.ts` 각 interactivity 이벤트가 서로 다른 `payload.trigger_id` 를 받음).

## 요약

이번 target 의 실질 변경은 `spec/5-system/15-chat-channel.md` CCH-SE-02(update dedup)의 요구사항 문면 재작성과 그 사실을 반영한 `providers/telegram.md` 동기화이며, EIA/RBAC/상태-머신/API 계약 차원에서는 다른 영역과 직접 모순되지 않는다(EIA-AU-08 인용도 정확). 다만 두 갈래의 실질적 cross-spec 갭이 확인됐다: (1) 신규 Redis 키가 `4-execution-engine.md §9.1` 이 선언한 "모든 Redis 키" 네이밍 규약을 계속 벗어나며, 이를 "이미 해소됨"으로 처분한 code-review RESOLUTION 의 근거(PR #1160)가 실측 결과 아직 **미병합 상태**라 그 처분 자체가 시기상조다. (2) `spec/data-flow/14-chat-channel.md` 가 스스로 선언한 source→sink 단일 진실 범위 안에서 새 dedup 게이트(Redis 키 + 파이프라인 순서)를 반영하지 않아, 같은 PR 이 다른 미러 문서(`providers/telegram.md`)에서는 스스로 고친 것과 동일 클래스의 드리프트가 이 문서에는 남아 있다. 둘 다 기능을 깨는 CRITICAL 은 아니지만, 우선순위 결정(§9.1 예외 등재 시점 vs PR #1160 머지 순서)과 문서 갱신이 필요하다.

## 위험도

MEDIUM
