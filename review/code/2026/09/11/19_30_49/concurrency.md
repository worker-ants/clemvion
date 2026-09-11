# 동시성(Concurrency) 리뷰 — `impl-chat-channel-binder-t2` (2026-09-11 19:30 라운드)

## 개요

이번 라운드의 diff(`a2e5b7e16`..`68bb34e73`)를 실제 소스 기준으로 확인했다. `chat-channel-binder.service.ts`
자체는 지난 라운드(`review/code/2026/09/11/18_04_36`) 리뷰 이후 **한 글자도 바뀌지 않았다**
(`git log`상 해당 파일은 `a2e5b7e16`에서 생성된 뒤 재수정 이력 없음). 이번 라운드에 새로 추가된 것은:

- `trigger-callback-url.ts` / `.spec.ts` — 순수 함수(`buildTriggerCallbackUrl`) 추출 + 문자열 조립
  분기(fallback·양쪽 슬래시) 단위 테스트. 외부 의존·공유 상태 없음.
- `chat-channel-binder.service.spec.ts` — `teardownChatChannel` 직접 단위 테스트 4건(등록 안 됨/
  안 부름/부름/예외 삼킴 경로).
- `triggers.service.spec.ts` / `triggers.web-chat.spec.ts` / `triggers.module.ts` — 새 provider
  (`ChatChannelBinderService`) DI 배선 + `remove()`가 binder에 위임한다는 배선 자체를 고정하는
  테스트 1건, `rotateBotToken`이 넘기는 callback URL 값을 단언하도록 강화.

이 중 어느 것도 새 lock/mutex/세마포어, 새로운 `Promise.all` 등 병렬 조합, 새 스레드풀·커넥션풀
설정을 도입하지 않는다. 순수 함수 추출 + 테스트 보강이 전부다.

## 발견사항

- **[INFO]** `trigger.config` 에 대한 read-merge-write 가 여러 `await` 경계를 넘어 이뤄져, 동일
  `trigger.id` 에 대한 동시 PATCH 사이에서 application-level lost update 가 가능하다
  (사전 존재 — 이 라운드가 만든 것이 아니고, 코드 자체가 지난 라운드 이후 변경되지 않았다).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:226-238`
    (`setupChatChannel` 성공 경로 — `const newConfig = { ...(trigger.config ?? {}), chatChannel: mergedChannel }; await this.triggerRepository.update(...)`)
    및 `chat-channel-binder.service.ts:258-269` (실패 경로의 동일 패턴, `fallbackConfig`).
  - 상세: `newConfig`/`fallbackConfig` 는 호출자가 애초에 읽어 둔 `trigger` 스냅샷을 기준으로
    메모리에서 조립된다. `adapter.setupChannel`(외부 I/O)과 `secrets.rotate()` 호출 사이에 여러 번
    `await` 되므로, 같은 `trigger.id` 에 대한 두 번째 PATCH가 그 구간에 끼어들어 먼저
    `triggerRepository.update()` 를 완료하면, 나중에 끝나는 첫 호출이 그 갱신을 통째로 덮어쓴다
    (`config` 컬럼은 절대값 SET, DB 레벨 병합 아님). row-level lock(`SELECT ... FOR UPDATE`)이나
    낙관적 버전 컬럼, 트랜잭션 경계가 없다.
  - 이미 별도로 추적 중인 리스크다 — `plan/in-progress/impl-chat-channel-binder-t2.md` 의
    `--impl-prep` 결과표 및 지난 라운드 `review/code/2026/09/11/18_04_36/concurrency.md` 가 동일
    지점을 이미 INFO로 등재했고, 이번 라운드에서 코드가 그대로임을 재확인했다.
  - 제안: 이번 PR 범위에서 조치 불필요(이미 유예된 후속 항목). 후속 처리 시 쓰기 지점이
    `ChatChannelBinderService` 로 옮겨갔다는 사실만 반영하면 된다.

- **[INFO]** `ChannelListenerRegistry.register()` (동기 호출, `chat-channel-binder.service.ts:241`)
  은 `triggerRepository.update()` 완료 직후에만 호출되고 그 사이 별도 락은 없다. DB 커밋과
  인메모리 registry 갱신 사이의 원자성은 보장되지 않으나(프로세스 크래시 시 불일치 가능),
  단일 프로세스 내 순차 코드일 뿐 새 레이스는 아니며 이동 전후 순서·조건이 동일하다.

- **[정보 없음/해당 없음]** 데드락, 명시적 동기화 primitive, 스레드 안전성(Node.js 이벤트 루프
  단일 스레드, 두 클래스 모두 인스턴스 상태 없는 stateless singleton), 리소스 풀링 관점은 이번
  diff에서 새로 만들어지거나 변경된 코드가 없다. `async/await` 사용은 전부 올바르며(신규
  테스트 코드 포함) 누락된 `await` 는 없다. `chat-channel-binder.service.spec.ts` 의
  `jest.spyOn(Logger.prototype, 'warn')` 은 `afterEach`에서 `jest.restoreAllMocks()` 로 매
  테스트 뒤 복원되어 다음 테스트/파일을 오염시키지 않는다(다른 라운드에서 지적된 "복원이
  단언 뒤에 있으면 위험"이라는 패턴은 이 파일엔 해당하지 않음 — `afterEach` 훅에 있다).

## 요약

이번 라운드에서 concurrency 관점으로 유의미하게 변경된 것은 없다. `chat-channel-binder.service.ts`
자체는 지난 라운드 리뷰 이후 재수정되지 않았고, 이번 diff는 순수 함수 추출(`buildTriggerCallbackUrl`)과
테스트 보강(provider 배선·위임 검증·URL 값 단언)뿐이다. 새 lock/세마포어, 새 Promise 조합, 새
스레드풀/커넥션풀 설정은 없다. 지난 라운드에 이미 INFO로 등재되고 별도 트래커로 유예 처분된
`trigger.config` 비원자적 read-merge-write(동시 PATCH lost-update) 패턴이 코드 변경 없이 그대로
남아 있다는 사실만 재확인했다 — 이번 PR이 새로 만든 결함이 아니며 조치 대상도 아니다.

## 위험도

LOW
