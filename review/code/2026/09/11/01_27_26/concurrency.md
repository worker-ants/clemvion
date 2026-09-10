# 동시성(Concurrency) 코드 리뷰 — `impl-chat-channel-patch-token`

## 개요

이번 diff 는 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지 못하게
막는 `ChatChannelUpdateConfigDto` 신설(D-1)과, `TriggersService.setupChatChannel()` 의 secret 쓰기
게이팅(`storeUserSuppliedSecrets`, D-2) 및 `inboundSigningRef` 보존 로직(`previousInboundSigningRef`
캡처) 변경이다. DTO·컨트롤러·문서·테스트 변경은 전부 선언적이거나 순차적 `await` 이라 새 동시성
원시(mutex/lock/`Promise.all`/타이머/모듈 전역 mutable state)는 도입되지 않았다. 실질적인 동시성
표면은 `TriggersService.update()` → `setupChatChannel()` 의 두 단계 커밋 하나뿐이다.

## 발견사항

- **[WARNING]** 동시 PATCH 가 `trigger.config`(JSONB) 를 잃을 수 있다 (lost update) — 이번 PR 이
  방금 닫은 `inboundSigningRef` fail-open 이 동시성 경로로 재발할 수 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` (485~607행,
    특히 526~528행 `previousInboundSigningRef` 캡처 · 556행 첫 `triggerRepository.save(trigger)` ·
    587~591행 `setupChatChannel()` 호출) 과 `setupChatChannel()` (1075~1259행, 특히 1184행
    `await adapter.setupChannel(...)` 외부 HTTP 호출 이후 1219~1227행 두 번째
    `triggerRepository.update()`). 자매 함수 `rotateChatChannelBotToken()` (1456~1580행) 도
    독자적인 `findById` → (외부 secret/adapter I/O 여러 `await`) → `triggerRepository.update({id},
    {config: ...})` 구간을 갖는다.
  - 상세: `update()` 는 요청 시작 시점에 `findById` 로 읽은 `trigger` 객체를 인메모리로 들고
    `save()` 한 뒤, 외부 adapter HTTP 호출(`adapter.setupChannel`)을 포함한 여러 `await` 를 거쳐
    **두 번째** `triggerRepository.update({id: trigger.id}, {config: newConfig, ...})` 를 실행한다.
    이때 `newConfig = { ...(trigger.config ?? {}), chatChannel: mergedChannel }` 의 base 인
    `trigger.config` 는 첫 `save()` 시점의 **스냅샷**이지 최신 DB 상태의 재조회가 아니다. 트랜잭션도
    행 잠금(`SELECT ... FOR UPDATE`)도 낙관적 버전 비교도 없다. 같은 트리거에 대해 (a) 두 번째
    `chatChannel` PATCH 가 겹치거나, (b) `chatChannel` PATCH 와 `rotateChatChannelBotToken()` 이
    겹치면, 나중에 커밋되는 쪽이 자신의 스냅샷으로 `config` 컬럼 전체를 덮어써 먼저 커밋된 변경을
    되돌린다. 특히 이번 diff 가 새로 추가한 `previousInboundSigningRef` 는 `update()` 진입 직후
    (외부 I/O 대기 구간 진입 **전**) 캡처한 값이라, 그 대기 구간 안에서 다른 요청이 `chatChannel`
    을 바꾸면 이 PATCH 의 두 번째 write 가 옛 `inboundSigningRef` 스냅샷을 다시 써 넣는다 — 즉
    이번 PR 이 단일 요청 범위에서 닫은 인입 서명(fail-open) 문제가 동시성 경로로 재발할 수 있다.
  - **사전 존재 설계다** — `save()` 후 별도 `setupChatChannel()`/`rotateChatChannelBotToken()` 이
    두 번째 커밋을 하는 구조(CCH-SE-01 best-effort 2단계 커밋) 자체는 이 diff 가 만든 것이 아니고,
    이 diff 는 그 위에 새 스냅샷 상태(`previousInboundSigningRef`)를 얹었을 뿐이다. **이미 이전
    라운드에서 발견·등재됐다** — `review/code/2026/09/10/23_55_23/concurrency.md` W1 (동일 지점을
    `database.md` INFO 가 TOCTOU 로 독립 확인) 이 발견했고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (약 2149행, `[ ]` 미해결) 에 "동시 PATCH 가 `trigger.config` 를 잃을 수 있다" 로 중앙 등재돼
    있으며, `rotateChatChannelBotToken()` 이 같은 구간을 가진다는 점까지 그 등재문이 명시한다.
    developer SKILL §ISSUE FIX 정책 (a)(b)(c) 를 근거로 한 수렴(사전 존재 설계·fix 범위가 이
    PR(두 CRITICAL 닫기)을 넘음·근거 기록)은 합당하다 — 이번 라운드에서 이 이유로 PR 을 막을
    필요는 없다.
  - 제안: 새 항목으로 재등재하지 말 것(이미 트래커에 있음). 후속 PR 에서 트리거 단위 advisory
    lock · `SELECT ... FOR UPDATE` · `config` 낙관적 버전 비교 중 하나로 `update()`/
    `setupChatChannel()`/`rotateChatChannelBotToken()` 세 지점을 **함께** 닫을 것. 그 전까지는
    "동시 PATCH 로 `inboundSigningRef` 가 유실된다"를 문서화된 기지 위험으로 유지하고, 가능하면
    통합/e2e 캐너리로 회귀 여부만이라도 감시하는 것을 권고한다.

- **[INFO]** `assertChatChannelAlreadySetUp` 의 TOCTOU 는 데이터 손상으로 이어지지 않는 벤딩(benign)
  경로다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:722`~`746`
    (`private assertChatChannelAlreadySetUp`), 호출부 520~522행.
  - 상세: 이 검사는 `update()` 시작 시점에 읽은 `trigger.config` 스냅샷으로 "이미 chatChannel 이
    설정돼 있는지"·"provider 를 바꾸려 하는지"를 판정한다. 이론상 판정 시점과 `save()` 시점 사이에
    다른 요청이 `chatChannel` 을 변경하면 스냅샷이 stale 할 수 있으나, 이 검사는 **거부 게이트**일
    뿐 값을 쓰지 않으므로 최악의 경우도 "허용해야 할 PATCH 를 거부"거나 그 반대이지 데이터 유실·
    권한 우회로 이어지지 않는다. 위 WARNING 과 성격이 다르다.
  - 제안: 조치 불요 — 기록 목적.

- **[INFO]** DTO/컨트롤러/테스트 변경에는 새로운 동시성 표면이 없다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelUpdateConfigDto` — `OmitType` 메타데이터는 모듈 로드 시 1회 생성, 요청마다 재계산
    되지 않음), `codebase/backend/src/modules/triggers/triggers.controller.ts` (Swagger 설명 문자열만),
    `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`,
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts` /
    `trigger-dto-validation.spec.ts` (모든 비동기 호출이 `await`/`await expect(...).rejects` 로
    정상 대기됨, `Promise.all`/타이머류 없음).
  - 제안: 조치 불요.

## 확인된 것 — 위반 없음

- 이번 diff 자체에서 새로 도입된 `Promise.all`/`Promise.race`/타이머/전역 mutable 캐시는 0건
  (`git diff origin/main...HEAD` 대상 파일 전수 grep).
- `setupChatChannel` 내부 로직(secret rotate 게이팅, `internalCfg`/`mergedChannel`/`fallbackConfig`
  조립)은 모두 단일 요청 안에서 순차 `await` 로 실행되며 그 요청 **내부**에서의 경쟁은 없다 — 위
  WARNING 은 요청 **간** 경쟁이다.

## 요약

이번 diff 자체는 새 동시성 원시나 병렬 실행 경로를 도입하지 않는다. 다만 `TriggersService.update()`
가 새로 추가한 `previousInboundSigningRef` 스냅샷이, 이미 존재하던 "요청 시작 시점 스냅샷을 트랜잭션·
잠금 없이 외부 adapter 호출 이후까지 신뢰하는" 2단계 커밋 구조 위에 얹혀, 동시 PATCH(또는 PATCH와
`rotateChatChannelBotToken()` 의 동시 실행)가 겹치면 방금 닫은 인입 서명 fail-open 이 재발할 수 있는
lost-update 경쟁을 만든다. 이 문제는 사전 존재 설계(CCH-SE-01)이고 이전 리뷰 라운드가 이미 WARNING
으로 발견해 중앙 트래커에 등재·수렴시켰으므로, 이번 라운드에서 이 사안으로 PR 을 새로 막을 필요는
없다 — 다만 후속 PR 에서 반드시 닫아야 할 항목으로 재확인한다.

## 위험도

LOW
