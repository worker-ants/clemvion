# 요구사항(Requirement) 리뷰 — CCH-SE-02 chat-channel update dedup (누적 diff, 최종 라운드 `11_12_03`)

## 스코프 및 검증 방식

이 diff 는 이미 code-review 3라운드(`02_38_41`·`02_50_38`·`09_09_58`)와 consistency-check 2라운드
(`02_38_42`·`02_50_39`·`09_20_48`)를 거친 상태이고, 그 산출물(review/**) 자체가 이번 diff 에 포함돼
있다. 이전 라운드(특히 `09_09_58/requirement.md`)가 핵심 구현(`ChatChannelDedupService` /
`HooksService` 배선 / spec CCH-SE-02·CCH-NF-03·R-CC-20·data-flow 미러)을 line-level 로 이미 정밀
재검증했고 그 결론(요구사항 충족, CRITICAL 0)에 동의한다. 이번 라운드는 **그 이후에 새로 추가된
마지막 커밋**(`4b46be711`, `redis-keys.md` cc:dedup 등재 + R-CC-20 앵커 수정)이 이전 라운드들이
검증하지 못한 새 불일치를 만들었는지에 집중해 실제 `git log`/`git show`/파일 상태를 직접 대조했다.

## 검증한 사실 (핵심 구현 — 재확인, 동의)

- `chat-channel-dedup.service.ts` — `claim()` 4개 반환 경로(미주입→true, 빈 키→true, `SET NX EX 30`
  성공 판정, 예외→warn+true) 전부 정의. `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC`(=30) ↔ spec
  `spec/5-system/15-chat-channel.md:88`(CCH-SE-02 행)의 키 포맷·TTL·fail-open 서술과 line-level 일치.
- `hooks.service.ts:328-345` 의 dedup 게이트가 `parseUpdate` 직후·rate-limit(`:347-`) 앞에 배선돼
  `spec/5-system/15-chat-channel.md` R-CC-20("게이트 위치: parseUpdate 직후(키 확정 시점)이자
  CCH-NF-03 rate-limit 앞")과 정확히 일치. CCH-NF-03 행(L113)도 "CCH-SE-02 dedup 게이트를 통과한 뒤"로
  갱신돼 순서 서술 정합.
- `spec/data-flow/14-chat-channel.md:196` 의 `cc:dedup:{triggerId}:{idempotencyKey}` 행(TTL 30초·
  fail-open)이 실제 구현과 일치.
- `CHANGELOG.md:5` "provider 파서 3종(telegram·slack·discord)" — `idempotencyKey` 를 채우는 파서가
  실제 3개 파일(`telegram-update.parser.ts`/`slack-update.parser.ts`/`discord-update.parser.ts`)뿐임을
  재확인. 이전 라운드가 지적한 "4종" 오기가 정정된 상태 그대로.
- TODO/FIXME/HACK/XXX: 신설·변경 파일 전체 0건.
- 반환값: `handleChatChannelWebhook` 의 모든 신규 분기가 `{ executionId: 'ignored' }` 또는 정상 경로로
  귀결 — 미정의 경로 없음.

## 발견사항

- **[WARNING]** plan 백로그 항목이 **이 diff 자신의 마지막 커밋**이 만든 사실 변경을 반영하지 못해,
  같은 diff 안에서 "실측"이라 표기한 두 진술이 이미 stale 하다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:752`-`754` (`실측 3개 파일` 목록),
    `plan/in-progress/backend-lint-gate-broken-on-main.md:809`-`816` (`인벤토리에 chat-channel 키
    2계열이 빠져 있다` 항목, 특히 810행 "인벤토리는 `cc:rl:` 만 담고 있는데")
  - 상세: 두 진술 모두 커밋 `24a0b31e5`(09:20:43)에서 작성됐다. 그 시점엔 사실이었다 — 당시
    `git diff --name-only origin/main...HEAD -- spec/` 은 3개 파일이었고, `spec/conventions/redis-keys.md`
    는 아직 `cc:rl:` 만 담고 있었다. 그런데 **이 diff 의 마지막 커밋** `4b46be711`(11:11:56, 커밋 메시지
    "+ cc:dedup 인벤토리 등재")이 정확히 `redis-keys.md` 를 고쳐 `cc:dedup:<triggerId>:<updateId>` 를
    같은 표 행에 추가했다(현재 파일 61행: `` `cc:rl:<triggerId>:<conversationKey>` · `cc:dedup:<triggerId>:<updateId>` ``).
    두 사실을 지금 재실측하면:
    - `git diff --name-only origin/main...HEAD -- spec/` → 4개 파일(`telegram.md`·`15-chat-channel.md`·
      `redis-keys.md`·`data-flow/14-chat-channel.md`). "실측 3개" 는 이제 거짓이다.
    - `spec/conventions/redis-keys.md` 의 chat-channel 행은 이제 `cc:rl:`**과** `cc:dedup:` 둘 다
      담고 있다. "인벤토리는 `cc:rl:` 만 담고 있는데" 라는 전제도 이제 거짓이고, 남은 미등재 계열은
      원래 주장한 4개(`chat-channel:`·`chat-channel-lock:`·`cc:rl:`·`cc:dedup:`) 중 2개
      (`chat-channel:<triggerId>` · `chat-channel-lock:<triggerId>`)뿐이다 — 항목 **제목**("2계열이
      빠져 있다")은 결과적으로 지금은 맞는 숫자이지만, 본문은 그 제목과 이미 모순된 채로(4계열 전부
      빠졌다는 서술) 방치돼 있다.
    - `4b46be711` 자신은 plan 파일의 다른 항목(R-CC-20 앵커, L806-825 부근)만 갱신했고, 이 두 곳은
      건드리지 않았다 — 즉 "이 diff 의 한 커밋이 만든 사실을, 같은 diff 의 plan 서술이 못 따라간" 케이스다.
    - 이 프로젝트 메모리(`feedback_measured_claim_proxy_and_timing.md`, `feedback_unmeasured_premise_and_test_coupling.md`)가 지목하는 정확히 같은 클래스의 결함이다 — "실측"이라고 못박은 문장은 그 문서에
      **쓰는 시점의 실제 상태**로 검증돼야 하는데, 여기서는 diff 의 뒤 커밋이 앞선 "실측"을 사후에
      무효화했고 아무도 되짚어 갱신하지 않았다.
  - 제안: (a) `752-758` 의 "실측 3개 파일" 을 4개로 갱신(`redis-keys.md` 추가) — "종전에 2개만 적어
    범위를 좁혔다" 는 이 단락의 취지 자체가 "축소 기록을 스스로 교정한다"이므로, 지금 3→4 로 다시
    교정하지 않으면 그 취지와 모순된다. (b) `809-816` 항목을 "인벤토리는 이제 `cc:rl:`·`cc:dedup:`
    두 계열을 담고 있고, 남은 미등재는 `chat-channel:<triggerId>` · `chat-channel-lock:<triggerId>`
    2계열뿐" 으로 정정하거나, 이미 처리된 절반을 반영해 체크박스 상태(부분완료 주석)를 갱신한다.

- **[INFO]** `HooksService.handleChatChannelWebhook` 메서드 상단 JSDoc 파이프라인 요약(5단계)이 신규
  dedup 단계(및 기존 rate-limit 단계)를 여전히 나열하지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:244`-`253` (JSDoc), 실제 게이트는
    `:328`-`345`(dedup)·`:347`-`362`(rate-limit)
  - 상세: 이미 `review/code/2026/08/13/02_38_41/documentation.md` INFO 항목으로 지적·유예 처분된
    사안이라 중복 조치를 요구하지 않는다. 요구사항 충족(동작) 자체에는 영향 없음 — 문서 완결성
    참고용으로만 재확인.
  - 제안: 추가 조치 불요(기존 유예 유지). 다음에 이 메서드를 만질 때 목록 갱신.

- **[INFO]** spec fidelity — CCH-SE-02(필수) 요구사항의 키 포맷·TTL·NX 원자성·게이트 위치·fail-open
  정책이 `spec/5-system/15-chat-channel.md` L88·L113·R-CC-20(L710-719)과 코드 사이에서 전부
  line-level 로 일치함을 직접 대조로 재확인했다(위 "검증한 사실" 참조). 새로운 spec-code 불일치
  없음.

## 요약

핵심 구현(`ChatChannelDedupService` 신설 + `HooksService` 배선)은 CCH-SE-02 "필수" 요구사항 —
동일 update_id 30초 안 재도착 무시 — 을 spec 본문과 line-level 로 정확히 충족하며, 3라운드의 독립
재검증(이번 라운드 포함)에서 CRITICAL 이 한 번도 나오지 않았다. 이번 라운드의 유일한 신규 발견은
동작 코드가 아니라 **plan 문서 자체**에 있다 — 이 diff 의 마지막 커밋(`4b46be711`)이 `redis-keys.md`
인벤토리에 `cc:dedup:` 를 등재했는데, 같은 diff 안의 두 "실측" 진술(spec 파일 개수 3개, 인벤토리가
`cc:rl:` 만 담고 있다는 전제)이 그 변경을 반영하지 못한 채 stale 상태로 남아 있다. 기능적 영향은
없지만, 이 항목들이 스스로 "실측"이라 표기하고 "축소 기록을 교정한다"는 취지로 만들어졌다는 점에서
정확도가 그 존재 이유이므로 WARNING 으로 남긴다.

## 위험도

LOW
