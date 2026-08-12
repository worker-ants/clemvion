# 요구사항(Requirement) 리뷰 — CCH-SE-02 update dedup (재검토, `02_50_38`)

## 스코프 및 검증 방식

이 diff 는 (1) `ChatChannelDedupService` 신설 + `HooksService` 배선(핵심 구현, 이전 라운드
`02_38_41` 과 동일) 과 (2) 그 라운드의 WARNING 4건에 대한 조치분(CHANGELOG 항목, sibling spec
`providers/telegram.md` 갱신, 호출부 warn 단언 추가) + 리뷰 산출물 자체(`review/code/.../02_38_41/**`)
를 함께 포함한다. 이전 라운드가 이미 spec-구현 line-level 대조(키 포맷·TTL·NX·fail-open)를
수행했으므로, 이번 턴에서는 **그 대조를 신뢰하지 않고 코드·spec 원본을 직접 다시 열어(`Read`/`Grep`/
`grep -rn`) 독립 재검증**했다. 아래는 재검증으로 새로 확인한 사실과 두 건의 신규 발견사항이다.

## 재검증한 사실 (기존 결론 확인)

- `codebase/backend/src/modules/hooks/hooks.service.ts` 실제 소스(328-345행)를 직접 읽어 dedup
  게이트가 `parseUpdate` 직후·rate-limit(347행~) **이전**에 정확히 위치함을 확인.
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 실제 소스(1227-1271행)를 직접 읽어
  `warnSpy` 로 `'재도착 무시'` 를 `stringContaining` 단언하는 코드가 실제로 존재함을 확인(WARNING #4
  조치가 진짜로 반영됨).
- `codebase/backend/src/modules/chat-channel/types.ts:129` — `ChannelUpdate.idempotencyKey: string`
  (non-optional) 확인.
- 세 provider 파서(telegram/slack/discord) 전수를 직접 열어 `idempotencyKey` 도출 경로를 추적:
  - telegram: `String(update_id)` — 항상 non-empty.
  - discord: `interaction.id` — 항상 non-empty(스노우플레이크).
  - slack: 대부분 `event_id`/`trigger_id` 로 non-empty 가 보장되지만, **`view_submission` 분기
    (`slack-update.parser.ts` `parseInteractivity`)** 는 `view.id` 가 없고 top-level `trigger_id`
    도 없는 경우 `idempotencyKey: ''` 를 만들 수 있는 유일한 실제 경로임을 확인 — 즉
    `ChatChannelDedupService.claim()` 의 "빈 키는 dedup 대상 아님" 가드는 사문(dead defensive
    code)이 아니라 이 malformed-payload 경로에 대응하는 정당한 방어다. (엣지 케이스 점검 결과
    긍정.)
- `spec/5-system/15-chat-channel.md:88` CCH-SE-02 신 문면과 `spec/4-nodes/7-trigger/providers/telegram.md`
  갱신분을 실제 파일에서 재확인 — 키 포맷(`cc:dedup:<triggerId>:<updateId>`)·TTL(30)·NX·fail-open
  서술이 구현과 일치. sibling spec drift(WARNING #2)가 실제로 해소됐음을 재확인.
- `codebase/backend/src/modules/hooks/hooks.controller.ts:97` `@HttpCode(HttpStatus.ACCEPTED)` 확인
  — dedup 차단 시 응답이 CHANGELOG/spec 이 말하는 "202 ignored" 와 일치.
- TODO/FIXME/HACK/XXX 주석: 신설·변경 파일 전체에 0건.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 신규 항목의 "provider 파서 4종" 이 사실과 다르다 — 실제로는 3종이다.
  - 위치: `CHANGELOG.md:5`
  - 상세: `` `ChannelUpdate.idempotencyKey` 는 provider 파서 4종이 채우기만 하고 …`` 라고 적혀
    있으나, `grep -rl "idempotencyKey" codebase/backend/src/modules/chat-channel/providers/` 로
    전수 확인한 결과 이 필드를 채우는 provider 파서는 `telegram-update.parser.ts` /
    `slack-update.parser.ts` / `discord-update.parser.ts` **3개뿐**이다(v1 supported provider 도
    `providers/_overview.md §1` 기준 telegram/slack/discord 3종). "4종" 은 숫자 오기로 보인다 —
    아마 slack 파서 내부의 다중 분기(Events API/Interactivity/Slash Commands)를 개별 세는 등의
    착오로 추정되나, 그 기준으로도 5개가 되어 "4"와 맞지 않는다.
  - 제안: "provider 파서 4종" → "provider 파서 3종"으로 정정. CHANGELOG 는 사용자 대상 공개
    문서라 사실관계 오류는 코드 fix 와 별개로 정정 가치가 있다.

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` CCH-NF-03 "구현" 노트가 이번
  PR 이 삽입한 CCH-SE-02 dedup 게이트를 반영하지 못해, "parseUpdate 직후 한도 초과 시" 라는 문구가
  더 이상 정확하지 않다.
  - 위치: `spec/5-system/15-chat-channel.md:113` (CCH-NF-03 행, "구현:" 절 — `Read` 로 직접 확인한
    실제 소스 라인. 이 줄은 이번 diff 대상이 아니라 게이트가 없음)
  - 상세: 이 PR 이전에는 `HooksService.handleChatChannelWebhook` 에서 rate-limit(CCH-NF-03) 검사가
    실제로 `parseUpdate` 바로 다음 단계였고, CCH-NF-03 의 "구현:" 서술("`HooksService…` 이
    parseUpdate 직후 한도 초과 시 … 단락")은 정확했다. 이번 PR 이 `parseUpdate` 와 rate-limit
    사이에 CCH-SE-02 dedup 게이트(`hooks.service.ts:338-345`)를 새로 끼워 넣었으므로, rate-limit
    은 이제 "parseUpdate 직후"가 아니라 "parseUpdate → dedup 게이트 통과 후" 에 실행된다. 이는
    코드가 틀린 게 아니다 — dedup 을 rate-limit 보다 앞에 두는 배치는 CCH-SE-02 문구("inbound
    진입에서") 및 이 PR 의 명시적 설계 근거("재도착은 새 트래픽이 아니므로 쿼터를 소비하면
    안 된다")와 정확히 일치하는 **의도된 개선**이다. 다만 CCH-NF-03 자신의 "구현:" 절은 그 새
    선행 단계를 언급하지 않아, 이 문서만 읽는 독자는 "왜 이 update 가 rate-limit 카운트에
    안 잡혔지?"를 디버깅할 때 dedup 게이트의 존재를 놓칠 수 있다. `§3.1 전체 시퀀스` 다이어그램도
    애초에 rate-limit/dedup 을 그리지 않는 Overview 수준이라 이 PR 로 새로 나빠진 것은 아니다
    (기존 갭) — 문제는 CCH-NF-03 "구현:" 절의 구체적 인접성 서술뿐이다.
  - 제안: 코드는 그대로 두고, `spec/5-system/15-chat-channel.md:113` CCH-NF-03 "구현:" 절 문구를
    "parseUpdate 직후(CCH-SE-02 dedup 게이트 통과 후) 한도 초과 시 …" 등으로 갱신해 실제 게이트
    순서(parseUpdate → dedup → rate-limit)를 반영. project-planner 턴에서 처리.

- **[INFO]** `claim()` 의 fail-open 두 갈래("Redis 클라이언트 미주입" 은 무경고 / "런타임 호출
  에러" 만 warn)와 spec 문구 "Redis 미가용 시 fail-open(+warn)"의 뭉뚱그림은 이전 라운드
  (`02_38_41` requirement.md)에서 이미 INFO 로 식별·`RESOLUTION.md` 에서 명시적으로 유예(사유
  기록: "구현은 sibling 과 일관되게 정확") 됐음을 재확인. 구현이 `ChatChannelRateLimiterService`
  와 완전히 동일한 정책이라 코드 fix 는 불필요하다는 판단에 동의 — 재차 에스컬레이션하지 않는다.

## 요약

핵심 구현(`ChatChannelDedupService` 신설, `HooksService` 배선, DI 등록)은 spec CCH-SE-02(키
포맷·TTL·NX 원자성·fail-open·삽입 위치)와 line-level 로 일치하고, 엣지 케이스(빈 키·trigger
스코프·Redis 부재/에러)도 실제로 도달 가능한 경로(Slack `view_submission` 의 `view.id` 부재 시나리오
포함)까지 방어돼 있으며 반환값·에러 시나리오 모두 전 경로에서 정의돼 있다. 이전 라운드의 WARNING
4건(spec 직접 수정 인정, telegram.md sibling drift, CHANGELOG 부재, 호출부 warn 미검증)은 실제
소스를 열어 재확인한 결과 모두 진짜로 조치됐다. 다만 이번 재검증에서 두 가지를 새로 발견했다 —
CHANGELOG 의 "provider 파서 4종"이라는 숫자 오기(실제 3종)와, CCH-NF-03 "구현" 절이 새로 삽입된
CCH-SE-02 dedup 게이트를 반영하지 못해 "parseUpdate 직후" 서술이 더 이상 정확하지 않은
spec-drift(코드는 맞고 spec 서술만 낡음). 둘 다 기능 자체를 위협하지 않는 문서 정확성 문제라
WARNING 으로 남긴다 — CRITICAL 은 없다.

## 위험도

LOW
