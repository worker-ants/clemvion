# 동시성(Concurrency) 코드 리뷰 — `impl-chat-channel-patch-token` (4라운드, `01_52_59`)

## 검토 방법

이번 라운드의 `origin/main...HEAD` diff(코드 파일 8개 + docs/plan/review 산출물)에서 직전
concurrency 라운드(`review/code/2026/09/11/01_27_26/concurrency.md`, 위험도 LOW) 이후 실제로
바뀐 지점을 `git log`/`git show` 로 좁혀 확인했다. 그 라운드 이후 커밋은 둘뿐이다:

- `464f2ba1a` — JSDoc → `//` 이동, mdx 문서 추가 (문서/주석만)
- `84a6aeaa8` — `triggers.service.ts`/`chat-channel-config.dto.ts` 의 `SecretResolver.store`→
  `rotate` 참조 정정(주석 2곳, 각 1줄), `slack.adapter.ts` 주석 3줄 추가, `triggers.service.spec.ts`
  에 `it.each` 6조합 추가(내부 3필드 × null/빈 문자열)

즉 이번 라운드가 새로 얹은 코드는 **주석·docstring·테스트 케이스뿐**이고, 동시성 표면인
`TriggersService.update()` / `setupChatChannel()` / `rotateChatChannelBotToken()` 의
읽기-쓰기·트랜잭션 경계는 이번 커밋들에서 단 한 줄도 바뀌지 않았다(`git show 84a6aeaa8 -- ...`
로 직접 대조). 신규 테스트도 `it.each`/`await expect(...).rejects` 순차 패턴만 사용해
`test.concurrent`·`Promise.all` 류의 병렬 실행 지시자를 쓰지 않는다.

## 발견사항

- **[WARNING]** 동시 PATCH 가 `Trigger.config`(JSONB) 를 잃을 수 있다(lost update) — 이전
  3라운드가 이미 발견·등재·수렴시킨 지점이 이번 diff 로도 변화 없이 그대로 남아 있음을 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의
    `findById` 스냅샷 읽기(491행)~`previousInboundSigningRef` 캡처(526~528행)~첫
    `triggerRepository.save(trigger)`(556행), 그리고 `setupChatChannel()`(1075~1260행) 내부의
    `adapter.setupChannel(...)` 외부 HTTP 호출(1184행) 이후 두 번째 영속화
    (`newConfig = {...(trigger.config ?? {}), chatChannel: mergedChannel}` → `triggerRepository.update(...)`,
    1215~1227행; 실패 경로 `fallbackConfig` 도 동일 패턴, 1247~1258행). 자매 함수
    `rotateChatChannelBotToken()` 도 독자적인 동일 2단계 커밋 구간을 갖는다(이 diff 는 그 함수를
    건드리지 않았다).
  - 상세: `Trigger` 엔티티에 `@VersionColumn` 이 없고, 이 read-modify-write 전체를 감싸는
    트랜잭션·`SELECT ... FOR UPDATE` 행 잠금도 없다. `update()` 는 요청 시작 시점 `trigger`
    스냅샷을 외부 adapter HTTP 호출을 포함한 여러 `await` 를 거쳐 끝까지 재사용하고, 두 번째
    `triggerRepository.update()` 는 그 스냅샷을 base 로 `config` 컬럼 전체를 다시 덮어쓴다. 같은
    트리거에 대해 (a) 두 번째 `chatChannel` PATCH 가 겹치거나 (b) `chatChannel` PATCH 와
    `rotateChatChannelBotToken()` 이 겹치면, 나중에 커밋되는 쪽이 자신의 옛 스냅샷으로 상대의
    변경(특히 이번 PR 이 지키려는 `inboundSigningRef` 보존)을 되돌릴 수 있다 — 즉 이 PR 이 단일
    요청 관점에서 닫은 "카드 편집 PATCH 한 번으로 인입 서명이 fail-open" 증상이 동시 요청
    인터리빙을 통해 재발할 수 있는 경로가 남는다.
  - **이미 정식 triage 완료, 이번 라운드는 이를 바꾸지 않음** — `review/code/2026/09/10/23_55_23/concurrency.md`
    W1 이 최초 발견(위험도 MEDIUM) → `RESOLUTION.md`(`23_55_23`)가 developer SKILL §ISSUE FIX
    수렴 예외 (a)(b)(c)를 근거로 이 PR 범위 밖 후속으로 defer(사전 존재 설계 CCH-SE-01, 처방이
    `update()`/`setupChatChannel()`/`rotateChatChannelBotToken()` 세 지점을 동시에 바꿔야 해서
    범위 초과) → `00_21_55`·`01_27_26` 두 라운드가 각각 "이번 diff 는 이 구간을 건드리지 않았다"
    를 재확인(위험도 LOW로 하향, 근거는 커밋 델타가 타입 오버로드·검증 로직 추가뿐이었다는 점) →
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2161` 에 `[ ]` 미해결 항목으로
    실제 등재돼 있음을 직접 grep 으로 재확인했다.
  - 이번 라운드가 그 사이 새로 바뀐 게 있는지 직접 확인했다 — `464f2ba1a`(JSDoc 위치 이동 +
    mdx 문서)와 `84a6aeaa8`(주석 정정 2곳 + 테스트 `it.each` 6조합 추가)의 diff 를 각각
    `git show` 로 열어 대조했고, 둘 다 `update()`/`setupChatChannel()` 의 로직·순서·트랜잭션
    경계를 전혀 건드리지 않는다. 따라서 이 항목의 성격·범위·위험도는 직전 라운드(`01_27_26`,
    LOW)에서 변화가 없다.
  - 제안: 새로 재등재하지 않는다(이미 트래커에 있음). 후속 PR 에서 트리거 단위 advisory lock ·
    `SELECT ... FOR UPDATE` · `config` 컬럼 낙관적 버전 비교 중 하나로 세 지점을 함께 직렬화할
    것을 재확인. 그 전까지는 이 lost-update 를 기지 위험으로 유지.

- **[INFO]** `SecretResolver.rotate` 는 키별 UPSERT — 개별 secret 쓰기 자체는 동시 호출에 원자적
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:64~67`
    (JSDoc — `setupChannel` 이 생성·활성화·PATCH 세 갈래에서 재호출되는 멱등 함수라 `store`(중복
    시 throw)가 아니라 `rotate`(UPSERT)를 쓴다는 근거 설명 추가), 대응 주석
    `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:252` ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:755~756`.
  - 상세: 이번 diff 는 이 세 자리의 **주석 문구**만 `store`→`rotate`로 정정했다(`SecretResolverService.rotate`
    자체의 UPSERT 구현은 이번 diff 의 변경 대상이 아니다). `rotate` 가 키 단위 UPSERT 라는 사실은
    위 WARNING 이 지적하는 `Trigger.config` JSONB **컬럼 전체 교체** 레이스와는 다른 레이어다 —
    secret store 쪽 개별 키 쓰기는 동시 호출에도 서로를 손상시키지 않지만, 그 결과를 `config`
    JSONB 에 반영하는 트리거 행 쓰기 쪽은 여전히 잠금이 없다. 새로 추가된 주석 자체는 순수 설명
    텍스트라 런타임 동시성 표면을 만들지 않는다.
  - 제안: 조치 불요 — 기록 목적.

- **[INFO]** 이번 라운드의 신규 테스트 코드는 동시성 표면이 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`it.each` 배열에
    `botTokenRef`/`inboundSigningRef`/`inboundSigning` × `null`/`''` 6조합 추가, 3244행 부근).
  - 상세: 추가된 케이스들은 기존 `it.each` 표를 확장한 것으로 각 케이스는 독립된 `it()` 안에서
    `await expect(service.update(...)).rejects.toThrow(...)` 형태의 순차 실행을 그대로 따른다.
    `test.concurrent`, 공유 mutable fixture 의 병렬 mutation, 타이머 기반 어설션 등은 없다.
  - 제안: 조치 불요.

## 확인된 것 — 위반 없음

- 이번 라운드가 실제로 바꾼 파일(주석 3곳 + mdx 문서 + 테스트 6케이스)에서 새로 도입된
  `Promise.all`/`Promise.race`/타이머/전역 mutable 캐시/신규 lock 원시는 0건.
- `create()`/`update()` 모두 `setupChatChannel(...)` 을 정상적으로 `await` 하며, 이번 라운드의
  변경 파일에 `await` 누락은 없다.
- DTO(`chat-channel-config.dto.ts`)·컨트롤러(`triggers.controller.ts`)·`update-trigger.dto.ts`
  의 변경은 이전 라운드부터 선언적 클래스/데코레이터/문서 문자열 수정뿐이라는 평가가 그대로
  유지된다 — 이번 라운드에서 그 파일들에 추가로 손댄 부분(`chat-channel-config.dto.ts` 주석 1줄)
  도 같은 성격이다.

## 요약

이번 4라운드 diff 의 실질 변경분은 주석·docstring 정정 3곳, mdx 사용자 문서, 테스트 `it.each`
6조합 추가뿐이며, `TriggersService.update()`/`setupChatChannel()`/`rotateChatChannelBotToken()`
의 read-modify-write·트랜잭션 경계는 전혀 건드리지 않았다. 유일한 동시성 관련 사안은 이전
라운드(`23_55_23`)가 발견해 WARNING 으로 등재하고, 이후 두 라운드(`00_21_55`, `01_27_26`)가
"이번 diff 로는 변화 없음"을 재확인하며 위험도를 LOW 로 유지해 온 "동시 PATCH 가
`Trigger.config` 를 잃을 수 있다(lost update)" 항목이다. 이번 라운드도 그 지점을 직접 재확인한
결과 코드·범위·위험도 모두 변화가 없고, `plan/in-progress/spec-draft-nullable-notation-followups.md:2161`
에 미해결 항목으로 정상 등재돼 있다. 이번 PR 을 이 사안으로 새로 막을 이유는 없다.

## 위험도

LOW
