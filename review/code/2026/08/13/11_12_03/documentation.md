# 문서화(Documentation) 리뷰 — CCH-SE-02 chat-channel update dedup (라운드 `11_12_03`)

## 컨텍스트

이 diff(`origin/main...HEAD`)는 신규 `ChatChannelDedupService` + `HooksService` 배선 본체(파일
1~6)와, 그 앞선 3회 리뷰 라운드(`02_38_41`·`02_50_38`·`09_09_58`)및 2회 consistency 라운드
(`02_38_42`·`02_50_39`·`09_20_48`)의 산출물·조치 결과(파일 7~63), 그리고 spec 문서 갱신(파일
64~67: `telegram.md`·`15-chat-channel.md`·`redis-keys.md`·`data-flow/14-chat-channel.md`)로
구성된다. 실제 소스(`chat-channel-dedup.service.ts`, `hooks.service.ts`,
`chat-channel.module.ts`, `spec/5-system/15-chat-channel.md` 등)를 `Read`/`grep`/`git diff` 로
직접 재대조했다.

## 재검증 — 이전 라운드가 지적·조치한 항목이 현재 상태에서도 유지되는지

- `CHANGELOG.md` — "provider 파서 3종(telegram·slack·discord)" 로 정정된 상태를 유지(파일 실측
  재확인). `202 ignored` 서술도 `hooks.controller.ts:97` `@HttpCode(HttpStatus.ACCEPTED)` 와 일치.
- `chat-channel-dedup.service.ts` 의 클래스/함수 JSDoc — "왜 이 자리에 별도 dedup 이 필요한가"
  (HTTP `IdempotencyInterceptor` 미경유 이유), 배치 근거(rate-limit 앞), fail-open 근거가 모두
  구체적으로 서술되어 있고 실제 구현과 line-level 로 일치함을 확인.
- `hooks.service.ts:328-345` 의 dedup 게이트 인라인 주석이 "이 파일의 §7.5.1 주석이 이미 재시도를
  전제로 한다" 고 인용하는데, 실제로 `hooks.service.ts:738` (`forwardToInteractionService` JSDoc,
  §7.5.1 참조)에 "거부를 그대로 throw 하면 webhook 이 5xx 를 반환해 provider 가 같은 update 를
  무한 재시도한다" 는 문장이 있어 인용이 정확함을 확인.
- `spec/5-system/15-chat-channel.md` — CCH-SE-02 표 행(`ChatChannelDedupService`·키 형식·
  fail-open)과 신설 `### R-CC-20` Rationale(EIA `Idempotency-Key` 재사용이 아니라 전용 서비스로
  전환한 배경)이 구현과 일치. R-CC-20 본문의 `[R-CC-12](#r-cc-12-inbound-http-contract--202-accepted-고정--401-auth--404-endpointpath-예외)`
  앵커를 `github-slugger` 로 직접 계산해 실제 헤딩(`### R-CC-12. Inbound HTTP Contract — ...`)
  슬러그와 정확히 일치함을 확인 — 이전 consistency 라운드(`09_20_48`)가 지적했던 깨진 앵커는
  이번 diff 에서 실제로 고쳐져 있다.
- `spec/data-flow/14-chat-channel.md:196` — `cc:dedup:{triggerId}:{idempotencyKey}` 키 행이
  Redis 키 흐름 표에 추가되어 TTL·배선 지점(rate-limit 앞)·fail-open 을 정확히 기술.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:720` — 체크박스가 `[x]` 로 실제 완료
  상태와 일치.

새로 발견한 CRITICAL/WARNING 은 없다.

## 발견사항 (전부 INFO — 이전 라운드에서 이미 확인·유예된 항목의 재확인, 새 결함 아님)

- **[INFO]** `slack.md`/`discord.md` 의 dedup 서술이 여전히 `telegram.md` 수준으로 갱신되지
  않았다 — provider 문서 3종 간 비대칭이 이번 최종 diff 에서도 남아 있다.
  - 위치: `spec/4-nodes/7-trigger/providers/slack.md:301` (`Events API dedup — 같은 event_id 가
    30초 안에 두 번 도착하면 두 번째 무시`), `spec/4-nodes/7-trigger/providers/discord.md:324`
    (`interaction.id 기반 dedup — ...`). (이번 diff 대상 파일 목록 밖 — `Read` 로 직접 확인한
    실제 소스 라인, 게이트 없음)
  - 상세: 두 줄 다 사실관계 오류는 아니다(`ChatChannelDedupService` 는 provider 비의존적으로
    배선돼 실제로 슬랙·디스코드에도 적용된다). 다만 `telegram.md:235` 만 "**구현됨
    (2026-08-13)**" + 메커니즘(Redis `SET NX EX 30`, 키 형식, fail-open) + SoT 링크
    (`CCH-SE-02`)를 얻었고, 형제 두 문서는 여전히 근거·상태표시 없는 한 줄 서술로 남아 있다.
    이 갭은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미 미체크(`- [ ]`)
    planner 항목("dedup 서술이 provider 3종 중 telegram 에만 반영됐다", `09_20_48` INFO 2 근거)
    으로 정확히 등재돼 있고 `spec/` 이라 developer 권한 밖이므로, 이 리뷰가 새로 요구할 조치는
    없다 — 등재 상태가 실제 상태와 일치함만 확인한다.
  - 제안: 조치 불요(이미 planner 백로그에 등재·추적 중). 다음 planner 턴에서 slack.md/discord.md
    에도 동일한 SoT 백링크 한 줄을 추가할 것.

- **[INFO]** `spec/conventions/redis-keys.md` 인벤토리에 chat-channel 소유 키 중
  `chat-channel:<triggerId>` / `chat-channel-lock:<triggerId>` 두 계열이 여전히 빠져 있다
  (`cc:rl:`/`cc:dedup:` 만 등재).
  - 위치: `spec/conventions/redis-keys.md:61` (이번 diff 가 `cc:dedup:` 을 이 행에 추가했으나
    verbose 접두사 두 계열은 손대지 않음)
  - 상세: 이 갭은 이번 diff 가 새로 만든 것이 아니라 `cc:rl:` 도입 시점부터 있던 선재 갭이며,
    `plan/in-progress/backend-lint-gate-broken-on-main.md:809` 에 미체크 planner 항목으로 이미
    등재돼 있다(실측 grep 명령까지 포함).
  - 제안: 조치 불요(추적 중). planner 턴에서 4계열 함께 정리.

- **[INFO]** `HooksService.handleChatChannelWebhook` 상단 JSDoc 의 파이프라인 요약(1~5단계)이
  dedup 단계(및 rate-limit 단계)를 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243`-`256` (메서드 상단 JSDoc,
    이번 diff 는 그 아래 코드에만 게이트 블록을 추가했을 뿐 이 JSDoc 자체는 diff 밖이라 게이트
    없음)
  - 상세: 직접 `Read` 로 재확인 — 1~5단계 나열에 "3. parseUpdate" 다음 바로 "4. ChannelConversation
    조회…" 로 건너뛰어 dedup·rate-limit 게이트가 여전히 목록에 없다. 이전 라운드(`09_09_58/documentation.md`,
    `02_50_38/documentation.md`)가 이미 지적·유예한 것과 동일 상태 — 새 결함 아님.
  - 제안: 기존 유예 유지. 다음에 이 docstring 을 만질 때 "dedup(rate-limit 보다 먼저) → rate-limit"
    두 단계를 목록에 추가.

- **[INFO]** `ChatChannelDedupService` 생성자에 형제 클래스(`ChatChannelRateLimiterService`)와
  달리 `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰이 프로덕션에서 provide 되지 않는 테스트 전용 훅이라는
  설명 주석이 없다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`46`
  - 상세: `chat-channel-rate-limiter.service.ts` 의 동일 위치에는 "테스트 주입 우선, 아니면 공유
    command connection, 미가용 시 null (fail-open)." 한 줄 주석이 있는데 신규 클래스는 구조는
    복제했지만 주석은 옮기지 않았다. 이전 라운드에서 이미 INFO 로 유예된 항목과 동일.
  - 제안: 조치 불요(유예 유지). 다음에 이 파일을 만질 때 형제 클래스와 동일한 한 줄 주석 추가.

- **[INFO]** `ChatChannelModule` 상단 docstring 의 "모듈 구조" 열거가 `ChatChannelRateLimiterService`
  ·`ChatChannelDedupService`·`ChatChannelInboundAuthenticator` 를 여전히 반영하지 않는다
  (`ChannelAdapterRegistry`·`ChannelConversationService`·`ChatChannelDispatcher`·
  `providers/telegram` 4개만 나열).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:22`-`31`
    (클래스 docstring, diff 밖 컨텍스트)
  - 상세: rate-limiter 도입 시점부터 이미 있던 선재 stale 목록이며 이번 diff 가 새로 만든 문제가
    아니다.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 목록 갱신 또는 "Spec §7 참조"로 단순화.

## README / API 문서 / CHANGELOG / 예제 코드

- README: `chat-channel/`·`hooks/` 모듈 트리에는 애초에 README 가 없다(이 저장소는 `spec/` 이
  모듈 문서의 단일 진실). 신규 README 요구 없음.
- API 문서: 신규 HTTP 엔드포인트 없음(기존 `POST /api/hooks/:endpointPath` 내부 분기 삽입) — 별도
  OpenAPI/API 문서 갱신 불필요.
- CHANGELOG: `CHANGELOG.md` 신규 항목(증상·사용자 영향·메커니즘·fail-open)이 이미 정확하게
  추가돼 있음을 재확인. 추가 조치 없음.
- 예제 코드: `chat-channel-dedup.service.spec.ts`·`hooks.service.spec.ts` 신규 케이스가 `claim()`
  호출 방식·반환값 의미·fail-open 두 경로·빈 키 처리·호출부 반환값 소비를 각각 `it` 로 명시적으로
  보여줘 사용 예제 역할을 겸한다. 별도 예제 필요 없음.

## 요약

이 diff 의 핵심 신규 코드(`ChatChannelDedupService`·spec·`HooksService` 배선)와 문서 산출물
(CHANGELOG, spec CCH-SE-02 표 행, `R-CC-20` Rationale, `data-flow/14-chat-channel.md` 키 표,
`telegram.md` 상태 갱신)은 "왜"까지 구체적으로 설명하는 높은 품질을 유지하며, 소스와 직접
재대조한 결과 이전 3회 리뷰·2회 consistency 라운드가 발견한 documentation 급 CRITICAL/WARNING
(CHANGELOG 파서 수 오류·telegram.md stale·CCH-NF-03 spec drift·R-CC-20 부재·R-CC-12 앵커 깨짐·
plan 절차 기록 누락)은 전부 정확히 조치되었음을 확인했다. 이번 라운드에서 새로 발견한
CRITICAL/WARNING 은 없다. 잔존 항목 5건(slack/discord provider 문서 비대칭, redis-keys.md
인벤토리 누락, 호출부 JSDoc 파이프라인 미동기화, DI 토큰 설명 주석 누락, 모듈 docstring 목록
누락)은 모두 이전 라운드에서 이미 INFO 로 확인·유예되었거나 planner 백로그에 등재된 상태이며,
이번 재확인 결과 그 처분이 현재 코드 상태와 정확히 일치함을 검증했다 — 재조치를 요구하지 않는다.

## 위험도

LOW
