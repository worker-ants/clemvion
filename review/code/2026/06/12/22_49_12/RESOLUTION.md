# RESOLUTION — CCH-NF-03 rate-limit 구현 (ai-review 22_49_12)

> 대상: `review/code/2026/06/12/22_49_12/SUMMARY.md` — **MEDIUM · Critical 0 · WARNING 17 · INFO 15** (router fallback → 전 reviewer 실행).

## 요약
Critical 0. SPEC-DRIFT WARNING 4건 중 3건은 false positive(spec 이미 갱신됨), 1건은 draft 문구 fix. 코드 측 실질 findings(원자성·placement·clamp·XSS·테스트 갭)은 fix. 나머지는 disposition.

## SPEC-DRIFT (W1–W4)
- **W1/W2/W3 — false positive(반증)**: 본 PR 의 spec 갱신이 이미 반영돼 있다 — `15-chat-channel.md` §3.6 CCH-NF-03 = "구현"(`grep '구현: \`ChatChannelRateLimiterService'` = 1건), §5.5 "분당 rate-limit 초과 (per-chat)" 행 존재(1건), `### R-CC-19` 존재(1건). 리뷰어가 spec 커밋+impl 커밋의 multi-commit diff(중간 "Planned"→최종 "구현")를 net 으로 못 읽은 오탐. 코드/spec 변경 불요.
- **W4 — fix**: spec-draft 의 "key = … + 분 버킷" 표현이 minute-aligned 로 오해될 소지 → "first-request-anchored(EXPIRE 60s NX), key `cc:rl:{triggerId}:{conversationKey}`" 로 정정.

## 코드 실질 findings — fix
- **W16 (동시성, 중요)**: `INCR` 후 별도 `expire()` 사이 크래시 시 TTL 미설정 키 영구 잔류(영구 차단) → `INCR` + `EXPIRE key 60 NX` 를 **단일 pipeline** 으로 변경 (Redis 7 NX). race·crash-gap 제거, NX 로 기존 TTL 보존.
- **W17 (placement)**: rate-limit 검사를 `enrichInbound`(Slack files.info 등 외부 API) **이전**(parseUpdate 직후, `parsed.conversationKey`)으로 이동 — 한도 초과분에 불필요한 외부 호출 안 함. spec-draft "parseUpdate 직후" 와 일치.
- **W5 (입력 검증)**: `consume` 에서 `limitPerMinute` 를 `[1,600]` clamp + `|| 60` — config 우회/0·음수 방어(전체 차단 방지).
- **W15 (보안/XSS)**: `chatChannelLastError` 에서 외부 입력 `conversationKey` 제거 — 한도만 기록(`Inbound rate limit exceeded (60/min)`). 관리자 UI stored-XSS 표면 축소.
- **테스트 갭 (W6/W7/W8/W9/W10/W11)**: 추가/보강 — 이미 degraded → update 미호출(W6), exec null·빈배열 fail-open(W7), incrErr fail-open(W8), incr 키 assertion(W9), lastError 내용 assertion(W10), degraded DB-fail swallow(W11). (rate-limiter 9 + hooks rate-limit 4 케이스, 전 46 pass.)

## disposition (비차단)
- **W12 (DRY health 갱신 2경로)**: HooksService·Dispatcher 두 곳 degraded 갱신 — 3번째 경로 추가 시 전용 서비스 추출. 현 2경로는 수용(SUMMARY 도 "즉각 조치 불필요").
- **W13 (default 상수 import)**: 테스트 가시성 trade-off — 현행 유지.
- **W14 (Redis 키 collision)**: `triggerId` 가 UUID(콜론 없음)라 `cc:rl:{uuid}:{conversationKey}` 는 conversationKey 콜론 유무와 무관하게 unambiguous — 실질 collision 불가. 비차단.
- **INFO**: I11/I12("1-auth·6-websocket 삭제")는 **본 PR 변경 아님** — origin/main 이 #571 로 이동(Rationale 보강 추가)해 구버전 base 인 본 branch 와의 diff 가 그렇게 보인 것. **리베이스로 해소**(아래). I14(data-flow callout) → "구현 완료" 갱신. 나머지 INFO(매직넘버 상수화·테스트 캐스팅 등)는 비차단 품질, 기록만.

## 후속 (rebase)
origin/main 이 #571/#573 으로 이동 → 본 branch 를 최신 origin/main 으로 rebase 후 재-TEST + 최종 ai-review 로 freshness 확정.

## TEST
review fix 후 rate-limiter 9 + hooks 37 (rate-limit 4 포함) PASS. 전체 lint·unit·build·e2e 는 rebase 후 재수행.
