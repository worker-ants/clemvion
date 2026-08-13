# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 확인

`origin/main` 대비 실제 diff(1 commit, `5d4655ceb`)는 다음 7개 파일: `spec/5-system/12-webhook.md`,
`spec/conventions/redis-keys.md`, `spec/data-flow/14-chat-channel.md`,
`spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/7-trigger/providers/discord.md`,
`spec/4-nodes/7-trigger/providers/slack.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`.
전부 **docs-only** — Redis 키 인벤토리(`redis-keys.md`)의 "빈 포인터"(가리키는 절에 키 리터럴이
없음) 4건을 한 PR 로 묶어 해소한 커밋이다. 코드 변경 없음(`public-webhook-quota.service.ts` 등은
기존 구현 그대로, spec 이 이를 뒤늦게 문서화).

## 발견사항

교차검증 결과 CRITICAL/WARNING 급 모순은 발견되지 않았다. 아래는 실측으로 확인한 정합성 근거와
경미한 INFO 2건이다.

- **[INFO]** `cc:dedup:*` 상세(TTL·fail-open)가 두 문서에 중복 — 값은 일치하나 규약이 경계 짓는 "이중 SoT" 패턴
  - target 위치: `spec/data-flow/14-chat-channel.md` §2.2 (신설 pointer 각주, "TTL·fail 정책은 이 표가 SoT")
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-SE-02 (본 diff 밖, 미변경 기존 서술) — `SET NX EX 30`, `cc:dedup:<triggerId>:<idempotencyKey>`, "Redis 미가용 시 fail-open(+warn)" 을 문장으로 이미 갖고 있음
  - 상세: `redis-keys.md` §3 은 `cc:dedup:*` 의 "용도·TTL·fail 정책 SoT" 를 `data-flow/14 §2.2` 로 새로 지목했다. 실측하면 두 문서의 값(TTL 30초, fail-open+warn, 키 리터럴)은 **현재 일치**해 모순은 아니다. 다만 `redis-keys.md` 의 Rationale("왜 인벤토리가 포인터만 갖나")이 명시적으로 "한 표에 상세까지 모으면 그 표가 곧 두 번째 SoT 가 된다" 고 경계하는 패턴이 이 한 쌍(§2.2 ↔ CCH-SE-02)에서 이미 실현돼 있다 — 이번 PR 이 만든 문제는 아니고(CCH-SE-02 원문은 미변경) PR 이 §2.2 를 "SoT" 로 명문화하면서 이 기존 중복이 더 도드라졌을 뿐이다.
  - 제안: 차기 turn 에서 `CCH-SE-02` 서술을 "키 상세는 [data-flow/14 §2.2] 참조" 로 축약하고 요구사항 조건(dedup 필수·게이트 위치)만 남기면 향후 drift 위험이 줄어든다. 이번 PR 을 막을 사유는 아님.

- **[INFO]** WH-NF-02 신설 Redis 키 노트("`INCR` + 첫 증가 시 `EXPIRE`" = fixed-window)와 코드 docstring 표현 불일치 — spec-vs-code, cross-spec 범위 밖
  - target 위치: `spec/5-system/12-webhook.md` §6 신설 표 각주("두 키 모두 `INCR` + 첫 증가 시 `EXPIRE`")
  - 충돌 대상: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 의 `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` docstring (그대로 읽으면 "슬라이딩 윈도우"라 표현)
  - 상세: spec 서술(fixed-window)은 코드 동작과 실제로 일치한다(검증: `makeMinKey`/`makeHourKey`/`UNIDENTIFIED_IP_BUCKET` 상수·키 포맷 전부 spec 과 정확히 일치). 어긋나는 쪽은 코드 **주석 문구**뿐이며, 이는 spec-spec 충돌이 아니라 code-comment 오기다. 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 developer 후속 항목으로 등재돼 있다(같은 커밋에서 발견·백로그화, 미해결 `[ ]`).
  - 제안: 대응 불필요(추적 중). cross-spec 관점에서는 정보성으로만 기록.

## 실측으로 반증된 잠재 우려 (참고)

아래는 검토 과정에서 의심했으나 실제로는 **정합**으로 확인된 지점 — 오탐 방지 기록:

- `spec/5-system/14-external-interaction-api.md` §8.4 (EIA rate-limit) 테이블 형식과 신설된
  `12-webhook.md` §6 Redis 키 표가 "동형" 이라는 커밋 주장 — 실측 일치(버킷/키 2열 표 + 규약
  포인터 각주 패턴 동일).
- `spec/conventions/redis-keys.md` §3 의 cafe24 포인터를 `2-navigation/4-integration.md §5.8`
  에서 `4-nodes/4-integration/4-cafe24.md §9.8` 로 옮긴 것 — 실측: `2-navigation/4-integration.md`
  §5.8 **본문**에는 `cafe24:install:*` 리터럴이 0건(Rationale 섹션에만 2건), `4-cafe24.md` §9.8
  본문에는 두 키 리터럴이 모두 존재. 포인터 이동이 옳다. 다른 spec 파일(2-navigation/4-integration.md
  자체 포함 3곳, data-flow/5-integration.md)도 이미 `4-cafe24.md#98-...` 앵커를 참조 중이라 새
  포인터가 기존 참조망과 정합.
- `discord.md`/`slack.md` 의 dedup 서술(`ChatChannelDedupService`, `cc:dedup:<triggerId>:<key>`,
  "rate-limit 앞" 게이트 순서)이 `spec/5-system/15-chat-channel.md` CCH-SE-02/CCH-NF-03/R-CC-20
  원문 및 이미 구현 완료로 표기된 `telegram.md` 서술과 정확히 동형 — 값(TTL 30초, 게이트 순서,
  fail-open)까지 일치.
- `data-flow/14-chat-channel.md` §2.2 신설 표에 등재된 4개 키(`chat-channel:*`,
  `chat-channel-lock:*`, `cc:dedup:*`, `cc:rl:*`)가 `redis-keys.md` §3 인벤토리 신설 2행과
  키 계열·소유 모듈 기준으로 1:1 대응.
- 코드 상수 실측(`ChatChannelDedupService` 클래스 존재, `wh:rl:min:`/`wh:rl:hour:`/
  `UNIDENTIFIED_IP_BUCKET='__no_client_ip__'` 리터럴 일치) — spec 서술이 실제 구현과 어긋나지 않음.

## 요약

이번 diff 는 `spec/conventions/redis-keys.md` 인벤토리가 가리키는 4개 절의 "빈 포인터"(포인터
대상 절에 실제 키 리터럴이 없던 문제)를 해소하는 docs-only 변경이며, 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 CRITICAL/WARNING 급 cross-spec 모순은
발견되지 않았다. 신설된 Redis 키 표(webhook §6)와 재배치된 포인터(cafe24 §9.8, chat-channel
data-flow/14 §2.2)는 실제 코드 식별자·기존 EIA §8.4 형식·`telegram.md`(이미 검증된 참조 구현)
서술과 값 단위로 일치함을 확인했다. 유일하게 남는 것은 `5-system/15-chat-channel.md` CCH-SE-02
prose 와 `data-flow/14-chat-channel.md` §2.2 표 사이의 값-일치 중복(이번 PR 이 만든 게 아니라
기존부터 있던 것)과, spec 서술은 정확한데 코드 docstring 문구만 어긋나는 fixed/sliding window
표현 차이(이미 plan 에 developer 후속으로 추적 중) — 둘 다 INFO 수준이며 이번 PR 을 막을 사유가
아니다.

## 위험도
LOW
