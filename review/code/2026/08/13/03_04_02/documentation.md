# 문서화(Documentation) 리뷰 — CCH-SE-02 update dedup (3차 라운드, `03_04_02`)

## 범위 확인

이번 diff 는 `ChatChannelDedupService` 신설(CCH-SE-02) 본체 + 그에 대한 **두 차례 코드 리뷰
(`02_38_41`, `02_50_38`)와 한 차례 consistency check(`02_50_39`)의 산출물**, 그리고 그 라운드들이
지적한 documentation/문서정합 WARNING 에 대한 실제 수정분(CHANGELOG 수치 정정, spec `## Rationale`
R-CC-20 신설, `spec/data-flow/14-chat-channel.md` 미러 추가, plan 절차 이탈 기록, RESOLUTION 오처분
정정)을 함께 담고 있다. 핵심 코드(`chat-channel-dedup.service.ts`, `hooks.service.ts` 등)는 이번
라운드에서 추가 변경이 없어(직전 두 라운드가 이미 검증), 아래는 (a) 앞선 라운드가 지적한 WARNING 이
실제로 정확히 닫혔는지 워크트리에서 직접 재대조하고, (b) 이번에 **새로 추가된 문서 hunk 자체**에
새 결함이 없는지를 중점 검토한 결과다.

## 확인된 수정 (재검증 — 문제 없음)

- `CHANGELOG.md:5` — "provider 파서 **4종**" → "**3종**(telegram·slack·discord)" 정정. `idempotencyKey`
  를 채우는 파서 파일을 직접 grep 해 정확히 3개(`telegram-update.parser.ts`,
  `slack-update.parser.ts`, `discord-update.parser.ts`)임을 재확인했다 — 수치 일치.
- `spec/5-system/15-chat-channel.md` `R-CC-20`(§Rationale, L710-718 부근) 신설 — in-process trusted
  caller(EIA-AU-08)가 `IdempotencyInterceptor` 를 우회하는 구조적 이유·전용 서비스 채택·게이트
  위치·fail-open 을 canonical `## Rationale` 위치에 정확히 담았다. `rationale_continuity`
  WARNING(`02_50_39`)에 대한 정확한 조치.
- `spec/5-system/15-chat-channel.md` CCH-NF-03 행(§3.6) — "`HooksService.handleChatChannelWebhook`
  이 parseUpdate 직후(**CCH-SE-02 dedup 게이트를 통과한 뒤** — 재도착은 같은 트래픽이라 쿼터를
  소비하지 않는다)" 로 새 게이트 순서를 정확히 반영했다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 체크리스트 항목에 "⚠️ 절차 이탈 기록"
  단락이 실제로 추가돼 `RESOLUTION.md` WARNING #1 로 연결된다 — `plan_coherence` WARNING(`02_50_39`
  #4)에 대한 정확한 조치.
- `review/code/2026/08/13/02_38_41/RESOLUTION.md` INFO 4 — "#1160 이 해소했다"는 근거 없는 처분을
  `gh pr view 1160` 실측(`state=OPEN`, `mergedAt=null`) 기반으로 "#1160 병합 전까지 위반 유지"로
  정정. 실측 근거를 남기고 스스로 "이 세션 두 번째 거짓 처분"이라 자인한 점도 감사 추적으로서
  적절하다.

이 네 건은 직전 라운드 WARNING 에 대한 정확한 조치로 판단하며 재지적할 결함을 찾지 못했다.

## 발견사항 (이번 라운드 신규)

- **[WARNING]** `spec/data-flow/14-chat-channel.md` 신규 `cc:dedup:` 행의 producer 귀속이 틀렸다 —
  실제 `SET NX EX 30` 호출부가 아닌 그 호출자를 명시
  - 위치: `spec/data-flow/14-chat-channel.md:196` (§2.2 Redis 표, `cc:dedup:{triggerId}:{idempotencyKey}` 행)
  - 상세: 이 행은 producer 를 `` `HooksService.handleChatChannelWebhook` (`SET NX EX 30`) `` 로
    적는다. 그러나 `this.redis.set(...)` 호출은 `ChatChannelDedupService.claim()`
    (`codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61-67`) 내부에서
    일어나고, `HooksService.handleChatChannelWebhook` 은 그 결과를 `await
    this.chatChannelDedup.claim(trigger.id, parsed.idempotencyKey)` 로 **호출만** 한다
    (`codebase/backend/src/modules/hooks/hooks.service.ts:338-340`). 바로 아래 형제 행
    `cc:rl:{triggerId}:{conversationKey}` (`spec/data-flow/14-chat-channel.md:197`)는 같은 표에서
    정확히 `` `ChatChannelRateLimiterService.consume` (`INCR`+`EXPIRE NX`) `` 로 — 호출자
    (`HooksService`)가 아니라 **실제 Redis 연산을 수행하는 서비스 메서드**를 producer 로 적어
    이 표의 일관된 관례임을 보여준다. `cc:dedup:` 행만 그 관례를 어기고 호출자를 producer 로
    적었다. 이 행 자체가 바로 이전 라운드의 consistency check(`02_50_39` cross_spec WARNING 2,
    "data-flow 미러 문서가 새 dedup 게이트를 반영하지 않음")를 닫기 위해 **이번 커밋에서 처음
    추가된** 줄이라, 사전 존재 결함이 아니라 이번 수정 자체가 새로 들여온 부정확성이다 — 이
    Redis 키를 추적하려는 다음 엔지니어가 `HooksService` 를 열어보고 `SET` 호출을 못 찾게 만든다.
  - 제안: producer 를 `` `ChatChannelDedupService.claim` (`SET NX EX 30`) `` 로 정정해 바로 아래
    `cc:rl:` 행과 동일한 "실제 연산 수행자" 관례를 맞춘다.

- **[INFO]** 내용 없는 consistency-check 세션 디렉터리가 그대로 커밋됨
  - 위치: `review/consistency/2026/08/13/02_38_42/` (`meta.json`, `_retry_state.json` 만 존재)
  - 상세: 이번 커밋(`6d4d019ae`)이 `review/consistency/2026/08/13/02_38_42/meta.json` 과
    `_retry_state.json` 을 신규 추가했는데, 같은 디렉터리에 `SUMMARY.md` 나 개별 checker 결과
    파일(`cross_spec.md` 등)은 전혀 없다 — 즉 이 라운드는 리포트를 남기지 못한 채(아마도 최초
    `--impl-done` 시도가 예산/타이밍 문제로 중단되고 `02_50_39` 로 재시도된 것으로 보인다)
    메타데이터만 저장소에 박제됐다. `grep -rln "02_38_42"` 결과 이 경로를 참조하는 plan/RESOLUTION
    문서가 하나도 없어, 실제로 쓰이는 감사 추적이 아니라 고아 아티팩트다. 기능에는 영향이 없지만
    "리포트 없는 리뷰 세션 디렉터리"가 저장소에 남으면 다음에 이 경로를 보는 사람이 "이 시각에
    consistency check 를 돌렸는데 결과가 왜 없지"라고 헷갈릴 수 있다.
  - 제안: 급하지 않음. 실질적 피해가 없으므로 이번 PR 을 막을 사유는 아니다. 다음에 이 디렉터리를
    정리할 기회가 있으면 삭제하거나, 최소한 RESOLUTION/plan 에 "02_38_42 는 예산 초과로
    02_50_39 로 재시도됨" 한 줄을 남겨 의도된 상태임을 표시하는 편이 낫다.

## 확인만 하고 재지적하지 않은 항목 (직전 라운드에서 이미 유예 처분됨, 상태 불변)

- `HooksService.handleChatChannelWebhook` 상단 JSDoc 파이프라인 요약이 여전히 CCH-SE-02 dedup
  단계를 반영하지 않음(`hooks.service.ts:243-256` 부근) — `02_38_41`/`02_50_38` documentation 라운드가
  각각 INFO 로 지적·재확인·유예했고, 이번 라운드도 코드 변경이 없어 상태가 그대로다. 재조치 불요.
- `spec/5-system/15-chat-channel.md` CCH-SE-02 표 행(L88)이 형제 행(CCH-NF-03 등)의
  `<br>구현: [file.ts](path)` 링크 패턴을 여전히 쓰지 않음 — `convention_compliance`(`02_50_39`)가
  강제 규약 아님으로 INFO 처분했고 이번 라운드도 변경 없음.
- `ChatChannelDedupService` 생성자의 `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰이 테스트 전용이라는 설명
  주석 부재 — `02_38_41` RESOLUTION INFO 6 으로 유예, 이번 라운드도 코드 변경 없어 상태 불변.

## 요약

직전 두 코드 리뷰 라운드와 한 consistency-check 라운드가 지적한 documentation 관련 WARNING(수량
오기, spec Rationale 미기재, data-flow 미러 누락, plan 절차 이탈 미기록, RESOLUTION 근거 없는
처분)은 이번 diff 에서 대부분 정확하게 조치됐음을 실측으로 재확인했다 — 파서 개수 grep, `R-CC-20`
내용 대조, `gh pr` 상태 재확인까지 직접 수행. 다만 그 조치 과정에서 새로 추가된
`spec/data-flow/14-chat-channel.md` 의 `cc:dedup:` 행 자체가 producer 를 실제 Redis 연산 수행자
(`ChatChannelDedupService.claim`) 대신 호출자(`HooksService.handleChatChannelWebhook`)로 잘못
적어, 바로 아래 형제 행과의 일관성을 깨는 새 부정확성을 들여왔다(WARNING) — "문서 갭을 메우려던
수정 자체가 작은 오류를 새로 만든" 경우라 반드시 정정할 가치가 있다. 그 외 내용 없는
consistency-check 세션 디렉터리가 참조 없이 커밋된 점(INFO)을 제외하면, 핵심 구현·CHANGELOG·spec
Rationale·plan 감사 추적의 문서 품질은 전반적으로 높다.

## 위험도

LOW
