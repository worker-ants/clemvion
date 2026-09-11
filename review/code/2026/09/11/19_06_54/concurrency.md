# 동시성(Concurrency) 리뷰

## 검토 범위 및 방법

`git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts` 를
직접 열람해 대조한 결과, 이번 diff 는 `TriggersService` 의 private 메서드
`setupChatChannel` / `teardownChatChannel` / `buildCallbackUrl` 을 신규
`ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 **바이트 단위로 동일하게** 옮기는
리팩터임을 확인했다(삭제된 블록과 신설 블록의 본문이 100% 일치). 나머지 diff 는 provider 등록
(`triggers.module.ts`, `*.spec.ts` 3개)과 순수 함수 자체의 신규 유닛 테스트다. 프롬프트에서 diff 가
생략된 두 핵심 파일(`chat-channel-binder.service.ts`, `triggers.service.ts`)은 `Read` 로 전체를
직접 열어 아래 줄 번호를 확인했다.

## 발견사항

- **[INFO]** `trigger.config` JSONB 컬럼에 대한 read-then-full-replace 패턴은 **이번 PR 로 신규
  도입된 것이 아니다** — 이동 전후 로직이 완전히 동일함을 diff 대조로 확인했다. 동시 요청 사이의
  lost-update 가능성은 여전히 존재한다:
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:97-270`
    (`setupChatChannel` — 함수 진입 시 `trigger.config` 를 그대로 캡처해 두고, `adapter.setupChannel`
    이라는 외부 HTTP 호출을 `await` 한 뒤 `newConfig = {...trigger.config, chatChannel: mergedChannel}`
    형태로 **인메모리 스냅샷 기준**으로 `triggerRepository.update()` 를 호출한다. 226-238행 성공
    경로, 258-269행 실패(fallback) 경로 둘 다 동일 패턴)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:995-1098`
    (`rotateBotToken` — `findById` 로 읽은 `trigger.config` 를 여러 차례의 `await`(secret store
    조회/회전 3회 + `adapter.setupChannel` 외부 호출) 이후 1088-1098행에서 그대로 병합해 다시
    `update()`)
  - 상세: 같은 트리거에 대해 두 요청(예: `PATCH /triggers/:id` 두 번, 또는 `PATCH` 와
    `rotateBotToken` 동시 실행)이 겹치면, 먼저 시작한 요청이 캡처한 `trigger.config` 스냅샷이
    나중에 완료되면서 다른 요청이 그 사이에 쓴 `chatChannel` 하위 필드를 덮어쓸 수 있다(TOCTOU /
    lost update). 두 메서드 모두 `WHERE id = :id` 조건부 UPDATE 만 쓸 뿐 낙관적 락(버전 컬럼)이나
    DB 측 JSON 병합(`jsonb_set`)을 쓰지 않는다.
  - **이미 트래커 등재됨**: 직전 라운드 `review/code/2026/09/11/18_04_36/RESOLUTION.md` 의
    "INFO 3 (lost update)" 로 동일 지점이 이미 지적·등재되어 있고, 이번 diff 는 그 지점을
    바꾸지 않았다(순수 이동). 새 CRITICAL/WARNING 으로 격상할 근거(이번 PR 이 새로 만든 위험
    표면)는 없다.
  - 제안: 트래커 항목 유지. 향후 해소 시 `triggerRepository.update` 를 조건부 낙관적 락(예:
    `updatedAt`/버전 컬럼 WHERE 절)으로 바꾸거나, `config.chatChannel` 만 부분 병합하는 DB 레벨
    연산(`jsonb_set(config, '{chatChannel}', ...)`)으로 좁혀 다른 최상위 config 키의 동시 변경과
    충돌하지 않게 하는 방향을 검토.

- **[INFO]** 클래스 분리로 같은 자원(`trigger.config.chatChannel`)의 두 writer 가 서로 다른
  파일/클래스에 위치하게 됐다.
  - 위치: `chat-channel-binder.service.ts`(`setupChatChannel`/`teardownChatChannel`) vs
    `triggers.service.ts:984-1098`(`rotateBotToken`)
  - 상세: 리팩터 전에는 두 writer 가 `TriggersService` 한 클래스 안에 있어 "같은 컬럼을 두 경로가
    쓴다"는 사실이 한 파일 안에서 보였다. 지금은 두 파일을 함께 열어야 그 사실이 드러난다 —
    기능적 회귀는 아니지만, 위 lost-update 트래커 항목을 다루는 다음 사람이 전체 writer 집합을
    놓치기 쉬워졌다.
  - 제안: 두 파일 JSDoc 에 "이 트리거의 `config.chatChannel` 을 쓰는 다른 지점" 을 상호 참조로
    남겨 둘 것(이미 `chat-channel-binder.service.ts` 헤더 JSDoc 이 `rotateBotToken` 을 "없다" 표로
    언급하고 있어 부분적으로는 돼 있음).

- **[INFO]** 순차 `await` 기반 secret store 회전은 변경되지 않았다(이미 트래커 등재, RESOLUTION
  "INFO 2").
  - 위치: `chat-channel-binder.service.ts:133-213`(최대 3회 순차 `this.secrets.rotate` await),
    `triggers.service.ts:1039-1085`(`rotateBotToken` 내 최대 3회 순차 await + adapter 호출)
  - 상세: `Promise.all` 로 병렬화하지 않고 순차 실행하는데, 이는 버그가 아니라 부분 실패 시
    "어디까지 썼는지"를 순서로 보장하려는 의도로 읽힌다(주석에 그 의도가 명시돼 있음). 신규
    결함 아님.

- 긍정 관찰: `ChatChannelBinderService` 는 `logger` 외 가변 인스턴스 필드가 없는 상태 없는
  Nest 싱글턴이라, 클래스 분리 자체는 새로운 스레드 안전성 문제를 만들지 않는다.
  `buildTriggerCallbackUrl`(`trigger-callback-url.ts:46-57`)은 순수 동기 함수(공유 상태 0, `async`
  아님)라 동시 호출 안전성 문제가 없다. diff 전체에서 `await` 누락이나 fire-and-forget 형태의 새
  비동기 호출은 발견되지 않았다 — 이동 전후 모든 `secrets.rotate`/`triggerRepository.update`/
  `save`/`adapter.setupChannel`/`teardownChannel` 호출이 그대로 `await` 되고 있다.

## 요약

이번 diff 는 `TriggersService` 의 chat-channel 바인딩 로직을 신규 `ChatChannelBinderService` 와
순수 함수 `buildTriggerCallbackUrl` 로 옮기는 리팩터이며, git diff 대조로 로직이 이동 전후
바이트 단위로 동일함을 확인했다. 신설 서비스가 상태 없는 싱글턴이고 신설 함수가 순수 함수이므로
이번 PR 이 새로 만든 동시성 결함은 없다. 다만 `trigger.config` JSONB 컬럼에 대한 기존의
read-then-full-replace 갱신 패턴(외부 어댑터/secret store 호출 뒤 인메모리 스냅샷 기준으로
전체 config 를 되쓰는 방식)은 여전히 동시 PATCH/rotateBotToken 사이의 lost-update 경쟁을
내포하고 있으며, 이는 이번 PR 이전부터 존재했고 직전 리뷰 라운드(`18_04_36`)에서 이미 INFO 로
등재·트래커 처리된 사항임을 재확인했다. 클래스 분리로 두 writer 가 서로 다른 파일에 위치하게 되어
향후 이 트래커 항목을 다루는 사람이 전체 writer 집합을 놓치기 쉬워졌다는 가독성 관점의 부수
관찰만 추가한다.

## 위험도

LOW
