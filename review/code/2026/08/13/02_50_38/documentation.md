# 문서화(Documentation) 리뷰 — CCH-SE-02 update dedup (재검토, `02_50_38`)

이 diff 는 `ChatChannelDedupService` 신설 + `HooksService` 배선(CCH-SE-02) 본체와, 직전 리뷰 라운드
(`review/code/2026/08/13/02_38_41/`)가 지적한 documentation WARNING 2건(telegram.md stale,
CHANGELOG 누락)에 대한 수정분, 그리고 그 라운드의 리뷰 산출물 자체(RESOLUTION.md·SUMMARY.md 등)를
함께 담고 있다. 아래는 그 수정이 실제로 정확한지 재검증하고, 남은 문서 갭을 다시 평가한 결과다.

## 확인된 수정 (재검증 — 문제 없음)

- `CHANGELOG.md` — `## Unreleased — chat-channel 이 \`필수\` 로 약속한 update dedup 이 통째로
  미구현이었다 (CCH-SE-02)` 항목이 신규 추가됐다(`CHANGELOG.md:3-22`). 증상(dead field) · 사용자
  영향(중복 dispatch) · 메커니즘(`SET NX EX 30`, 키 포맷) · HTTP 인터셉터 미경유 이유 · fail-open
  정책까지 이 저장소의 기존 `Unreleased` 항목 관례(증상→원인→영향→메커니즘)를 그대로 따른다.
  `IdempotencyInterceptor` 클래스명(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:76`)과
  `scope: 'in_process_trusted'` 문자열(`chat-channel-dedup.service.ts:22`, `hooks.service.ts:336`)을
  실제 코드와 대조해 정확함을 확인했다.
- `spec/4-nodes/7-trigger/providers/telegram.md:235` — "미구현 (Planned): … consumer 가 없다" →
  "구현됨 (2026-08-13): … `ChatChannelDedupService` 가 소비한다 … SoT: [chat-channel
  CCH-SE-02](../../../5-system/15-chat-channel.md)" 로 정정됐다. 상대경로(`providers/` →
  `7-trigger/` → `4-nodes/` → `spec/` 3단계 후 `5-system/15-chat-channel.md`)를 직접 계산해
  `spec/5-system/15-chat-channel.md` 로 정확히 귀결됨을 확인했다. 종전 문구가 정확했다는 점을
  남긴 인용문(`> 종전 이 자리는 …`)도 사실과 일치한다.
- `spec/5-system/15-chat-channel.md:88` CCH-SE-02 행 — 신 문구(서비스명·Redis 커맨드·키 포맷·
  fail-open)가 구현(`chat-channel-dedup.service.ts`)과 line-level 로 일치함을 대조했다(TTL 30,
  `SET NX EX 30`, `cc:dedup:<triggerId>:<updateId>`).

이 세 건은 직전 라운드 WARNING #2/#3 에 대한 정확한 조치로 판단하며, 이번 라운드에서 재차 지적할
결함을 찾지 못했다.

## 발견사항 (신규/잔존)

- **[INFO]** `slack.md`/`discord.md` 의 동일 계열 dedup 서술이 `telegram.md` 만큼 갱신되지 않았다 —
  다만 사실관계 오류는 아니다
  - 위치: `spec/4-nodes/7-trigger/providers/discord.md:324` ("interaction.id 기반 dedup — 같은
    interaction.id 가 30초 안에 두 번 도착하면 두 번째 무시"), `spec/4-nodes/7-trigger/providers/slack.md:301`
    ("Events API dedup — 같은 `event_id` 가 30초 안에 두 번 도착하면 두 번째 무시") — 둘 다 이번
    diff 대상 목록에 없어 게이트가 없는 파일이라 `Read` 로 직접 확인한 실제 소스 라인.
  - 상세: 이 두 줄은 telegram.md 와 달리 애초에 "미구현 (Planned)" 마커 없이 **사실인 것처럼**
    서술돼 있었다. `chat-channel-dedup.service.spec.ts` 헤더의 "provider 파서 4종이 채우기만 하고
    읽는 곳이 0곳" 진술을 보면 이 PR 이전엔 슬랙·디스코드도 dedup 이 실제로는 동작하지 않았을
    것이므로, 이 두 줄은 이번 구현 전에는 (telegram.md 처럼 정직하게 갭을 인정하는 대신) 사실과
    다른 서술이었을 가능성이 있다. 다만 이번 PR 로 `ChatChannelDedupService` 가 provider 비의존적
    (trigger.id + idempotencyKey 로만 스코프)으로 배선되어 지금은 슬랙·디스코드에도 실제로
    적용되므로, 현재 시점에서는 두 줄 모두 **사실과 부합**한다 — 즉 새로 만들어진 오류는 아니고
    긴급한 정정 대상도 아니다. 다만 `telegram.md` 만 SoT 백링크(`[chat-channel
    CCH-SE-02](../../../5-system/15-chat-channel.md)`)와 구현일자·메커니즘 각주를 얻었고, 형제
    provider 문서 두 곳은 여전히 근거·SoT 링크 없는 한 줄짜리 서술로 남아 있어 provider 문서 3종
    간 상세도가 불균일해졌다.
  - 제안: 급하지 않음. 다음에 이 세 provider 문서를 함께 만질 기회에 `slack.md:301`,
    `discord.md:324` 에도 `telegram.md:235` 와 동일한 SoT 백링크 한 줄을 추가해 상세도를 맞추는
    것을 고려.

- **[INFO]** (직전 라운드에서 이미 지적·유예됨, 재확인만) `HooksService.handleChatChannelWebhook`
  상단 JSDoc 의 파이프라인 요약(1~5단계)이 이번 PR 로 추가된 CCH-SE-02 dedup 단계를 여전히
  반영하지 않는다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243-256`(JSDoc), 신규 게이트는
    `hooks.service.ts:328-345` 부근(diff 밖 컨텍스트라 게이트 없음 — 실제 소스로 확인)
  - 상세: `RESOLUTION.md`(`review/code/2026/08/13/02_38_41/RESOLUTION.md`)의 INFO 15 로 이미
    "유예"(다음 문서 갱신 기회에 반영) 처분이 기록돼 있다. 실제 코드를 다시 열어 그 처분 이후에도
    docstring 이 갱신되지 않았음을 확인했다 — 처분과 실제 상태가 일치하므로 새 결함은 아니다.
  - 제안: 기존 처분(유예) 유지. 재조치 불요.

- **[INFO]** (직전 라운드에서 이미 지적·유예됨, 재확인만) `ChatChannelDedupService` 생성자에
  `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰이 테스트 전용이라는 설명 주석이 여전히 없다(형제
  `ChatChannelRateLimiterService` 에는 있음)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39-46`
  - 상세: `RESOLUTION.md` INFO 6 이 "본문 주석에는 이유가 적혀 있다"는 사유로 유예했다. 확인
    결과 클래스 상단 JSDoc(`chat-channel-dedup.service.ts:14-33`)에 fail-open 정책·배선 이유는
    상세히 적혀 있으나, "이 DI 토큰이 프로덕션에서 provide 되지 않는 테스트 전용 훅"이라는
    사실 자체는 여전히 어디에도 명시돼 있지 않다 — 유예 사유가 가리키는 주석과 실제로 빠진
    정보가 정확히 일치하지는 않는다. 다만 영향은 낮다(오독 시 최악의 결과가 죽은 provider 등록
    시도 정도).
  - 제안: 재조치 불요(이미 유예 결정됨). 다만 다음에 이 파일을 만질 때는 유예 사유가 실제로
    다루는 정보와 정확히 일치하는지 한 번 더 확인할 가치가 있음을 참고로 남김.

## 요약

핵심 구현(`ChatChannelDedupService`, spec, `HooksService` 배선)의 독스트링·인라인 주석 품질은
직전 라운드 평가대로 높고, 그 라운드가 지적한 documentation WARNING 2건(telegram.md stale,
CHANGELOG 누락)은 이번 diff 에서 정확하게 조치됐음을 재검증했다 — SoT 상대경로·클래스명·스펙
ID(EIA-AU-08)까지 실제 코드/파일과 대조해 확인. 새로 발견한 사안은 슬랙·디스코드 provider 문서가
telegram.md 만큼 SoT 백링크를 갖추지 못해 provider 문서 3종의 상세도가 불균일해졌다는 것뿐이며,
이는 사실 오류가 아니라 경미한 일관성 갭(INFO)이다. 직전 라운드가 유예한 나머지 INFO 항목(호출부
docstring 파이프라인 미동기화, 생성자 설명 주석 누락)은 재확인 결과 처분과 실제 상태가 부합해
재지적할 필요가 없다. CRITICAL·WARNING 신규 발견 없음.

## 위험도

LOW
