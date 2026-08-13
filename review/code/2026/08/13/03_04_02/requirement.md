# 요구사항(Requirement) 리뷰 — CCH-SE-02 update dedup (최종 라운드 `03_04_02`)

## 스코프

이번 diff 는 `ChatChannelDedupService` 신설(+단위 테스트) · `HooksService.handleChatChannelWebhook`
배선(+호출부 테스트) · `ChatChannelModule` DI 등록 · `plan/in-progress/backend-lint-gate-broken-on-main.md`
체크박스 · `CHANGELOG.md` 항목 · `spec/5-system/15-chat-channel.md`(CCH-SE-02 행 + R-CC-20/R-CC-19
Rationale) · `spec/4-nodes/7-trigger/providers/telegram.md`(§8 갱신) · `spec/data-flow/14-chat-channel.md`
(Redis 키 표 신규 행) · 이전 두 리뷰 라운드(`02_38_41`, `02_50_38`)의 산출물(RESOLUTION/SUMMARY/reviewer
파일들)로 구성된다. 핵심 기능 커밋은 이미 두 라운드의 리뷰·조치를 거쳤으므로, 본 라운드는 (a) 그
조치들이 실제 소스에 반영돼 있는지 코드를 직접 `Read`/실행해 독립 재검증하고 (b) 이전 두 라운드가
놓친 신규 요구사항/spec-fidelity 결함이 남아 있는지를 집중 점검했다.

## 검증한 사실 (직접 재확인)

- `spec/5-system/15-chat-channel.md:88` CCH-SE-02 행과 구현을 line-level 대조 — 키 포맷
  (`cc:dedup:${triggerId}:${idempotencyKey}`, `chat-channel-dedup.service.ts:9`), TTL
  (`CHAT_DEDUP_WINDOW_SEC = 30`, `:12`), 원자성(`SET key 1 EX 30 NX`, `:61-67`), fail-open
  (미주입 `:55`·에러 `:73` 모두 `true`) 전부 일치.
- 배선 위치: `hooks.service.ts:338-345` — `parseUpdate` 직후·rate-limit(CCH-NF-03, `:354`) **앞**에서
  `chatChannelDedup.claim(trigger.id, parsed.idempotencyKey)` 호출, 차단 시 `logger.warn` +
  `{ executionId: 'ignored' }`. spec 서술("inbound 진입 rate-limit 앞") 및 R-CC-20 Rationale
  ("게이트 위치: parseUpdate 직후이자 CCH-NF-03 rate-limit 앞")과 정확히 일치.
- `ChatChannelModule` providers/exports 양쪽에 `ChatChannelDedupService` 등록 확인
  (`chat-channel.module.ts:46,61`) — DI 그래프 완결.
- `ChannelUpdate.idempotencyKey`(`types.ts:129`)는 non-optional `string`이고 provider 파서
  3종(telegram/slack/discord) 전부 실제 값을 채운다 — slack 파서는 값이 없으면 `null`(update
  자체 폐기)을 반환해(`slack-update.parser.ts:63`) `claim()`의 빈 키 가드가 실질적으로
  "parser 계약이 깨진 경우"에 대한 정당한 방어이지 사문이 아님을 확인.
- `claim()`은 (redis 없음 / 빈 키 / 정상 SET 성공·실패 / catch) 네 경로 모두에서 `boolean`을
  반환 — 반환 누락 경로 없음.
- TODO/FIXME/HACK/XXX 주석 없음(신규 파일 4종 grep 확인).
- `CHANGELOG.md:5` "provider 파서 **3종**(telegram·slack·discord)" — 이전 라운드(`02_50_38`
  RESOLUTION WARNING #3)에서 지적된 "4종" 오기가 실제로 3으로 정정돼 있음을 재확인(코드베이스
  실제 provider 디렉터리도 3개).
- 호출부 테스트(`hooks.service.spec.ts:1227-1271`)가 이전 라운드 WARNING(호출부 warn 미검증)의
  조치대로 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('재도착 무시'))` 를
  포함하고 있음을 확인. `npx jest chat-channel-dedup.service.spec.ts hooks.service.spec.ts`
  직접 실행 — **2 suites / 59 tests 전부 통과**(주장과 일치).
- `spec/4-nodes/7-trigger/providers/telegram.md:235`가 "미구현(Planned)" → "구현됨(2026-08-13)"
  으로 갱신되고 SoT 백링크가 정확한 상대경로로 `spec/5-system/15-chat-channel.md`를 가리킴을 확인.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/data-flow/14-chat-channel.md`의 inbound rate-limit 설명
  문단이 새 CCH-SE-02 게이트 순서를 반영하지 못해, **같은 저장소 안의 두 spec 문서가 서로 다른
  서술**을 하고 있다.
  - 위치: `spec/data-flow/14-chat-channel.md:92` (`> 가 parseUpdate 직후 한도 초과분을
    skip(202 ignored) + \`chat_channel_health=degraded\`.`)
  - 상세: 같은 사실을 서술하는 `spec/5-system/15-chat-channel.md:113`(CCH-NF-03 행)는 이번 PR의
    2차 리뷰 라운드(`02_50_38` RESOLUTION WARNING #2, SPEC-DRIFT)에서 이미 "parseUpdate
    직후(**CCH-SE-02 dedup 게이트를 통과한 뒤** — 재도착은 같은 트래픽이라 쿼터를 소비하지
    않는다)"로 정정됐다. 그런데 `grep -rn "parseUpdate 직후" spec/`로 대조한 결과 정확히 같은
    문구를 쓰는 **자매 문장이 `data-flow/14-chat-channel.md:92`에 하나 더 있고, 이쪽은 정정에서
    누락**됐다 — 여전히 "parseUpdate 직후 한도 초과분을 skip"이라고만 적어, dedup 게이트가 그
    사이에 끼어든다는 사실이 이 문서만 보면 드러나지 않는다. 코드는 옳다(`hooks.service.ts:328-345`
    dedup → `:347-362` rate-limit 순서가 실제로 그렇게 구현돼 있음을 위에서 재확인함) — 이번
    diff가 `data-flow/14-chat-channel.md:196`에 `cc:dedup:` Redis 키 표 행은 추가했지만, 그
    바로 위(88-94행)의 서술형 각주는 갱신 대상에서 놓친 것으로 보인다. `02_38_41`/`02_50_38`
    두 라운드의 documentation 리뷰도 이 mermaid 흐름도 인접 각주는 지적하지 않았다(신규 발견).
  - 제안: 코드는 그대로 두고 spec만 반영한다. `spec/data-flow/14-chat-channel.md:92`를
    "가 parseUpdate 직후(CCH-SE-02 dedup 게이트를 통과한 뒤) 한도 초과분을 skip…"으로
    `15-chat-channel.md:113`과 동일하게 맞춘다(project-planner 경로).

- **[INFO]** `spec/` 직접 수정의 절차 이탈은 이미 `scope.md`/`RESOLUTION.md` WARNING #1에서
  인지·기록됐고(되돌리지 않기로 한 결정), 본 리뷰가 line-level로 대조한 내용 자체(CCH-SE-02
  행·R-CC-20 Rationale)는 구현과 정확히 일치해 spec 신뢰성 문제는 없음 — 중복 지적 생략.

- **[INFO]** `chat-channel-dedup.service.spec.ts`(파일 2)의 키 포맷 단언은 소스에서 export한
  `makeChatDedupKey`를 재사용해 만든 값과 비교한다(`chat-channel-dedup.service.spec.ts:34-40`) —
  spec의 리터럴 `cc:dedup:<triggerId>:<updateId>`을 문자 그대로 pin하지 않으므로, 만약 향후 두
  세그먼트 구분자(`:`)나 순서가 실수로 바뀌면 테스트는 소스와 "같이" 바뀌어 통과할 수 있다.
  다만 형제 파일(`chat-channel-rate-limiter.service.spec.ts`)도 동일 관례이고 이전 라운드에서
  이미 유예(INFO) 처분됐으므로 재상정하지 않음.

## 요약

`ChatChannelDedupService`는 CCH-SE-02가 요구하는 "동일 update_id 30초 재도착 무시"를 Redis
`SET NX EX 30` 원자 연산으로 정확히 구현했고, `HooksService`의 배선 위치(parseUpdate 직후·
rate-limit 앞)·반환 계약(모든 경로에서 boolean)·fail-open 정책·엣지 케이스(빈 키·trigger
스코프)가 spec `CCH-SE-02`/`R-CC-20` 본문과 line-level로 정확히 일치함을 코드·테스트 실행으로
직접 재검증했다. 이전 두 리뷰 라운드가 지적한 항목(CHANGELOG 파서 수 오기, sibling
`telegram.md` stale 서술, 호출부 warn 미검증)은 모두 실제로 조치돼 있다. 새로 발견한 유일한
결함은 `spec/data-flow/14-chat-channel.md:92`가 CCH-NF-03 게이트 순서 정정에서 빠진
[SPEC-DRIFT]로, 코드가 아니라 그 문서 한 줄만 `15-chat-channel.md:113`과 맞추면 해소된다.
Critical 급 요구사항 미충족이나 반환값/에러 처리 누락은 발견되지 않았다.

## 위험도

LOW
