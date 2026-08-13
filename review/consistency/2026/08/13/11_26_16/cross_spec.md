# Cross-Spec 일관성 검토 — CCH-SE-02 (chat-channel update dedup)

## 검토 범위 확인

프롬프트 번들의 실제 target(`spec/5-system/14-external-interaction-api.md`)과 `<git diff origin/main...HEAD -- code_areas>`가 컨텍스트 예산 초과로 절단되어 있었다. 절단분은 원 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접
`git diff origin/main...HEAD` / `Read` / `grep`으로 재확인했다 (CWD가 아니라 절대경로/`git -C`로).

worktree 디렉토리명(`eia-r8-cache-scope`)과 달리, 실제 diff는 **EIA §R8 캐시 스코프 작업이 아니라
CCH-SE-02(chat-channel update dedup) 구현**이다 (branch `claude/cch-se02-dedup`). 변경 spec:
`spec/5-system/15-chat-channel.md`(CCH-SE-02 본문 정정 + R-CC-20 신설 + CCH-NF-03 순서 명시),
`spec/4-nodes/7-trigger/providers/telegram.md`(dedup "미구현→구현됨" 주석 갱신),
`spec/conventions/redis-keys.md`(`cc:dedup:` 인벤토리 등재), `spec/data-flow/14-chat-channel.md`
(`cc:dedup:`/`cc:rl:` source→sink 행 추가). 변경 코드: `ChatChannelDedupService`(신규,
`chat-channel.module.ts` provider/export 등록) + `hooks.service.ts`(`handleChatChannelWebhook`에
dedup 게이트 배선, rate-limit 앞).

이 요청 직전에 동일 코드 상태에 대한 cross_spec 검토(`review/consistency/2026/08/13/09_20_48/cross_spec.md`)가
이미 1회 수행됐고, 그 INFO 2건 중 1건(R-CC-12 앵커 깨짐)은 이후 커밋(`4b46be711`)에서 이미 해소됐다.
아래는 그 갱신 반영 재검토다.

## 발견사항

### 검증 완료 — 충돌 없음 확인 항목

- **EIA-AU-08 in-process trusted caller 전제**: 신규 Rationale `R-CC-20`(`spec/5-system/15-chat-channel.md:710`)이
  "chat-channel inbound는 HTTP `IdempotencyInterceptor`를 통과하지 않는다"는 전제로 별도 dedup 서비스
  도입을 정당화한다. `codebase/backend/src/modules/external-interaction/interaction.controller.ts`
  확인 결과 `IdempotencyInterceptor`는 `@UseInterceptors`로 컨트롤러 HTTP 라우트에만 걸려 있고,
  chat-channel은 `InteractionService.interact()`를 in-process 직접 호출(EIA-AU-08,
  `spec/5-system/14-external-interaction-api.md:96`)해 그 인터셉터를 실제로 우회한다. 전제 사실.
- **Slack/Discord `trigger_id`/`interaction.id`의 dedup key 적합성**: `parseSlashCommand`/
  `parseInteractivity`(`slack-update.parser.ts`)가 `idempotencyKey = trigger_id`를 쓰는 자리를
  처음엔 "워크플로우 Trigger.id와 충돌하는 것 아닌가"로 의심했으나, 이는 Slack API 고유의
  요청별 1회성 토큰(`trigger_id`)이지 우리 도메인의 `Trigger` 엔티티 ID가 아니다.
  `spec/4-nodes/7-trigger/providers/slack.md:164`가 이미 "Slack retry 시 재사용"을 명시해
  30초 dedup window와 정합함을 사전에 문서화해 두었다(이번 diff와 무관한 기존 서술, 재확인만 함).
- **Redis 키 네임스페이스**: 신규 `cc:dedup:{triggerId}:{idempotencyKey}`(TTL 30s)는 기존
  `cc:rl:{triggerId}:{conversationKey}`(rate-limit), EIA의
  `interaction:idempotency:<executionId>:<route>:<key>`(§R8, `14-external-interaction-api.md:1061`)와
  접두사·용도가 모두 달라 충돌 없음. `redis-keys.md` §1 형태 규칙(`{도메인}:{용도}[:{식별자}...]`,
  `#1160`으로 이미 `origin/main`에 병합·정착됨)에도 부합.
- **처리 순서 정합**: spec은 "dedup 게이트가 rate-limit(CCH-NF-03)보다 앞"이라 명시하는데,
  `hooks.service.ts` 실제 배선도 `chatChannelDedup.claim`(L339) → `chatChannelRateLimiter.consume`(L354)
  순서로 일치. `data-flow/14-chat-channel.md`의 신규 두 행(`cc:dedup:` → `cc:rl:`) 순서도 동일.
- **요구사항 ID / Rationale ID 충돌**: `CCH-SE-02`, `R-CC-20` 모두 `spec/` 전체에서 이 변경 위치
  외 재사용처 없음 (grep 전수 확인). `R-CC-20`이 파일 내에서 `R-CC-19`보다 앞에 배치된 순서
  역전이 있으나(번호 자체의 중복/충돌은 아님), intra-document 서술 순서 문제라 cross-spec
  범위보다는 convention/구조 검토 영역에 더 가까움 — 여기서는 참고로만 남긴다.
- **모듈 계층 책임**: `ChatChannelDedupService`는 `chat-channel` 모듈에 상주하고
  providers/exports 양쪽에 등록되어 기존 `ChatChannelRateLimiterService`와 동일 패턴으로
  `HooksModule`에 노출된다 — 기존 계층 분리 결정과 일치. dedup 호출은 `HooksService`(파이프라인
  오케스트레이션)에서, 판정 로직은 `ChatChannelDedupService`(자원 접근)에서 — 기존 rate-limiter
  분리와 동형.
- **파서 순수성 계약 유지**: dedup의 Redis side-effect는 `adapter.parseUpdate()` 내부가 아니라
  `HooksService`가 별도 호출하므로, `conventions/chat-channel-adapter.md` §1.1의 "parseUpdate는
  pure — DB 미접근, 외부 API 미호출" 계약을 깨지 않는다.
- **R-CC-12 앵커 링크**: 이전 검토(`09_20_48`)가 지적했던 `[R-CC-12 (b)](#r-cc-12-telegram-safe-2xx)`
  깨진 앵커는 이후 커밋(`4b46be711`)에서 실제 헤딩 슬러그
  (`#r-cc-12-inbound-http-contract--202-accepted-고정--401-auth--404-endpointpath-예외`)로
  정정되어 현재 HEAD에서는 해소 확인됨 (spec-link-integrity 13/13, 커밋 메시지 기재).
- **Redis 키 인벤토리 등재**: `redis-keys.md` §5 "새 키를 도입하면 등재한다" 의무도 같은 커밋에서
  `cc:dedup:` 행이 인벤토리에 추가되어 이행됨 — 규약 자체 위반 없음.

### [INFO] Slack/Discord provider spec이 동일 구현 완료를 반영하지 않음 — 미해소 (이전 검토와 동일)

- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md:235` (이번 diff — "미구현 (Planned)" →
  "구현됨 (2026-08-13)" + `ChatChannelDedupService` SoT 링크로 갱신)
- 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md:301` ("Events API dedup — 같은 `event_id`가
  30초 안에 두 번 도착하면 두 번째 무시"), `spec/4-nodes/7-trigger/providers/discord.md:324`
  ("interaction.id 기반 dedup — 같은 interaction.id가 30초 안에 두 번 도착하면 두 번째 무시")
- 상세: 신규 dedup 게이트(`ChatChannelDedupService.claim`)는 `HooksService.handleChatChannelWebhook`
  공통 경로에 배선되어 **provider 무관하게(telegram/slack/discord 전부) 적용**된다. 즉 slack.md·
  discord.md의 위 문장은 이번 PR 이전에는 (telegram과 동일한 이유로) **거짓**이었고 — R-CC-20
  본문이 스스로 "파서 3종(telegram·slack·discord)이 채우기만 하고 읽는 곳이 0곳"이라 명시한다 —
  이번 PR로 비로소 참이 됐다. 그런데 diff는 telegram.md에만 구현 완료 주석·SoT 백링크를 추가했고,
  slack.md/discord.md의 동일 취지 문장은 애초에 "미구현" 표기가 없었기에 이번 구현 완료로 그
  문장이 처음 참이 됐다는 사실도 기록되지 않는다. 기능적 모순은 아니다(세 provider 모두 실제로
  동작함) — 세 provider 문서 간 "구현 상태 주석" 관례가 비대칭해졌다는 문서 추적성 문제다.
- 이미 tracked: `plan/in-progress/backend-lint-gate-broken-on-main.md:827-828`에 동일 항목이
  planner 인계 사유("spec/이라 developer 권한 밖")로 이미 등재되어 있음. 새 발견이 아니라
  현재 HEAD 기준으로도 여전히 미해소임을 재확인.
- 제안: 급하지 않음(INFO). `project-planner`가 slack.md:301, discord.md:324에도 telegram.md:235와
  동일한 `ChatChannelDedupService` SoT 백링크 + "구현됨" 주석을 추가해 세 provider 문서의 서술
  정합도를 맞출 것.

## 요약

이번 diff(CCH-SE-02 chat-channel update dedup 구현)는 EIA-AU-08 in-process trusted caller 예외,
EIA §R8 idempotency 캐시 스코프, 기존 rate-limit(CCH-NF-03) 처리 순서, Redis 키 네임스페이스·
인벤토리 등재 의무, 모듈 export 계층, provider별 idempotencyKey 도출 규칙(Slack `trigger_id` 재사용
포함) 모두와 정합하며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC를 침해하는 CRITICAL/WARNING
급 모순을 발견하지 못했다. 직전 검토(`09_20_48`)가 지적한 앵커 링크 깨짐은 후속 커밋에서 이미
해소됐고, 남은 유일한 항목은 slack/discord provider 문서가 telegram 문서만큼 구현 상태를 명시하지
않아 생긴 문서 간 서술 비대칭(INFO, 이미 plan에 planner 인계로 등재됨)뿐이다.

## 위험도
LOW
