# 문서화(Documentation) 리뷰 — CCH-SE-02 chat-channel update dedup (라운드 `09_09_58`)

## 컨텍스트

이번 diff(`origin/main...HEAD`, 44개 파일)는 `ChatChannelDedupService` 신설 + `HooksService` 배선
본체와, 이전 두 리뷰 라운드(`02_38_41`, `02_50_38`)의 산출물·그 라운드가 지적한 WARNING 에 대한
조치분(CHANGELOG 추가, `telegram.md` 정정, `15-chat-channel.md` CCH-NF-03 절 갱신, `R-CC-20`
Rationale 추가, plan 절차 이탈 기록)을 함께 담고 있다. 아래는 소스를 직접 `Read`/`grep` 으로 재대조해
그 조치들이 실제로 정확한지, 그리고 남은 문서 갭이 있는지 독립적으로 재확인한 결과다.

## 재검증 — 이전 라운드가 지적한 WARNING 은 모두 실제로 해소됨

- `CHANGELOG.md:5` — "provider 파서 4종" → "provider 파서 3종"으로 정정되어 있음을 확인
  (telegram·slack·discord 3개 파서 파일만 `idempotencyKey` 를 채움, 실제 소스 대조).
- `spec/4-nodes/7-trigger/providers/telegram.md:235-236` — "미구현 (Planned) … consumer 없음" →
  "구현됨 (2026-08-13) … `ChatChannelDedupService` 가 소비" 로 정정, SoT 상대경로
  (`../../../5-system/15-chat-channel.md`)가 실제로 `spec/5-system/15-chat-channel.md` 로 귀결됨을
  경로 계산으로 확인.
- `spec/5-system/15-chat-channel.md:88` (CCH-SE-02) — Redis `SET NX EX 30`, 키
  `cc:dedup:<triggerId>:<updateId>`, fail-open(+warn) 서술이 `chat-channel-dedup.service.ts` 구현과
  line-level 로 일치.
- `spec/5-system/15-chat-channel.md:113` (CCH-NF-03 "구현:" 절) — "parseUpdate 직후(**CCH-SE-02 dedup
  게이트를 통과한 뒤** — 재도착은 같은 트래픽이라 쿼터를 소비하지 않는다)" 로 갱신되어 실제 게이트
  순서(dedup → rate-limit)와 일치함을 확인.
- `spec/5-system/15-chat-channel.md:710-725` (`## Rationale` `R-CC-20`) — "EIA `Idempotency-Key`
  재사용이 아니라 전용 서비스" 항목이 신설되어, `rationale_continuity` 라운드가 지적한 "메커니즘
  전환의 canonical 근거가 spec `## Rationale` 에 없다"는 WARNING 이 실제로 해소됨을 확인.
- `spec/data-flow/14-chat-channel.md:196` — `cc:dedup:{triggerId}:{idempotencyKey}` 키 행이
  Redis 키 레지스트리 표에 추가되어 TTL·fail-open·배선 지점(rate-limit 앞)까지 정확히 기술.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 완료 서술에 "⚠️ 절차 이탈 기록" 단락이
  추가되어, developer 턴에서 `spec/` 을 직접 고친 사실이 plan 자체에도 남았음(`plan_coherence`
  WARNING 이 요구한 (b) 항목 충족).
- CHANGELOG 의 "`202 ignored`" 서술 — `hooks.controller.ts:97` `@HttpCode(HttpStatus.ACCEPTED)` 로
  실제 202 임을 확인. "`scope: 'in_process_trusted'`"·"EIA-AU-08" 인용도
  `spec/5-system/14-external-interaction-api.md:96` 원문과 일치.

새로 확인한 CRITICAL/WARNING 은 없다.

## 발견사항 (잔존 — 전부 이전 라운드에서 이미 INFO 로 유예 처분된 항목의 재확인)

- **[INFO]** `slack.md`/`discord.md` 의 동일 계열 dedup 서술이 `telegram.md` 만큼 SoT 백링크를 갖추지
  못해 provider 문서 3종의 상세도가 불균일
  - 위치: `spec/4-nodes/7-trigger/providers/discord.md:324`, `spec/4-nodes/7-trigger/providers/slack.md:301`
    (이번 diff 대상 목록 밖 — `Read` 로 직접 확인한 실제 소스 라인, 게이트 없음)
  - 상세: 두 줄 모두 사실관계 오류는 아니다(`ChatChannelDedupService` 가 provider 비의존적으로
    배선되어 지금은 슬랙·디스코드에도 실제로 적용됨). 다만 `telegram.md` 만 "구현됨 (2026-08-13)" +
    SoT 링크(`CCH-SE-02`)를 얻었고 형제 두 문서는 여전히 근거 없는 한 줄짜리 서술로 남아 있다.
  - 제안: 급하지 않음. 다음에 세 provider 문서를 함께 만질 기회에 동일한 SoT 백링크 한 줄을 추가.

- **[INFO]** `HooksService.handleChatChannelWebhook` 상단 JSDoc 의 파이프라인 요약(1~5단계)이
  CCH-SE-02 dedup 단계·CCH-NF-03 rate-limit 단계를 여전히 반영하지 않음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`handleChatChannelWebhook` 메서드
    상단 JSDoc, `Read` 로 확인한 함수명 기준 — 이번 diff 는 그 앞뒤에 코드만 추가했을 뿐 JSDoc 은
    diff 밖이라 게이트 없음). 신규 게이트 코드는 파일 6(hooks.service.ts) diff 게이트 328-345.
  - 상세: 이전 라운드(`RESOLUTION.md` INFO 15, `02_50_38/documentation.md`)가 이미 지적·유예했고,
    소스를 다시 열어 그 이후에도 갱신되지 않았음을 확인했다 — 처분과 실제 상태가 일치, 새 결함
    아님.
  - 제안: 기존 유예 유지. 다음에 이 docstring 을 만질 때 "dedup(rate-limit 보다 먼저)" 단계를 추가.

- **[INFO]** `ChatChannelDedupService` 생성자의 `'CHAT_CHANNEL_DEDUP_REDIS'` DI 토큰이 프로덕션에서
  provide 되지 않는 테스트 전용 훅이라는 사실이 형제 클래스(`ChatChannelRateLimiterService`)와 달리
  주석으로 명시되지 않음
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`46`
  - 상세: 형제 클래스(`chat-channel-rate-limiter.service.ts:40`)는 `this.redis = injectedRedis ?? ...`
    바로 위에 "테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open)." 한 줄
    주석이 있는데, 신규 클래스는 동일 구조를 복제했지만 이 주석이 없다. `chat-channel.module.ts` 의
    `providers` 어디에도 이 토큰을 provide 하는 곳이 없음을 grep 으로 재확인 — 실사용은 항상
    `RedisConnectionProvider` 폴백뿐이다.
  - 제안: 이전 라운드에서 이미 유예됨(INFO 6). 형제 클래스와 동일한 한 줄 주석을 추가하면 충분.

- **[INFO]** `ChatChannelModule` 상단 docstring 의 "모듈 구조" 열거가 `ChatChannelRateLimiterService`·
  `ChatChannelDedupService` 둘 다 여전히 누락(사전 존재 stale, 이번 diff 로 새로 생긴 문제 아님)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` (파일 상단 클래스
    docstring, diff 밖 컨텍스트)
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 목록을 갱신하거나 "Spec §7 참조"로 단순화.

## README / API 문서

이 모듈 트리(`chat-channel/`, `hooks/`)에는 애초에 README 파일이 없다(`find` 확인, 0건) — 이 저장소는
모듈 문서를 `spec/` 이 단일 진실로 담당하는 관례이므로 README 신설/갱신 요구는 해당 없음. 신규 HTTP
엔드포인트도 없어(기존 `POST /api/hooks/:endpointPath` 내부 분기 삽입) API 문서(OpenAPI 등) 갱신
필요성도 없다.

## 예제 코드

`chat-channel-dedup.service.spec.ts` 와 `hooks.service.spec.ts` 의 신규 케이스가 사실상 사용 예제
역할을 겸한다 — `claim()` 호출 방식·반환값 의미·fail-open 두 경로·빈 키 처리를 각 `it` 로 명시적으로
보여준다. 별도 예제 코드 추가 필요성 없음.

## 요약

이 diff 의 핵심 신규 코드(`ChatChannelDedupService`, 그 spec, `HooksService` 배선)는 독스트링·인라인
주석이 "왜"(HTTP 인터셉터 미경유 이유, rate-limit 과의 순서, fail-open 근거)까지 구체적으로 설명하는
높은 품질을 유지한다. 소스를 직접 재대조한 결과, 이전 두 라운드가 발견한 documentation
CRITICAL/WARNING(telegram.md stale·CHANGELOG 파서 수·CCH-NF-03 spec drift·`R-CC-20` Rationale
부재·plan 절차 기록 누락)은 전부 정확하게 조치되었음을 확인했고, 이번 라운드에서 새로 발견한
CRITICAL/WARNING 은 없다. 남은 항목은 슬랙/디스코드 provider 문서의 SoT 백링크 불균일, 호출부
JSDoc 파이프라인 미동기화, DI 토큰 설명 주석 누락, 모듈 docstring 목록 누락 4건뿐이며 모두 이전
라운드에서 이미 INFO 로 유예 처분된 사안의 재확인이라 재조치를 요구하지 않는다.

## 위험도

LOW
