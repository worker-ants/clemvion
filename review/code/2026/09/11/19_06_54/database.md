# Database Review — `impl-chat-channel-binder-t2` (2026-09-11 19:06 라운드)

## 검토 범위 요약

`git diff origin/main HEAD` 기준으로 이번 브랜치는 4개 커밋(`a2e5b7e16` → `92f4b0607` →
`7e9aaa736` → `8f43b1f56`)으로 구성된다. 실제 DB 접근 코드는 첫 커밋(`a2e5b7e16`)에서
`TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을 신설
`ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 **그대로** 옮긴 것이 전부이며, 이후 3개
커밋은 테스트 강화·JSDoc 정정·plan/review 문서뿐이다(`git show 92f4b0607`/`8f43b1f56` 로 확인 —
production 코드 변경은 `trigger-callback-url.ts` 의 JSDoc 위치 이동뿐).

`triggerRepository.update(...)` 호출의 인자·조건문·`secrets.rotate(...)` 순서가 이동 전(`triggers.service.ts`
삭제분)과 신설 파일 사이에 문자 그대로 동일함을 `git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts`
로 직접 대조했다. `grep -n "query\|createQueryBuilder\|transaction\|manager\.\|QueryRunner"` 로 관련 파일
전체를 훑어 신규 raw SQL·트랜잭션·QueryRunner 사용이 없음을 확인했고, `migrations/` 하위 파일은
이번 diff 에 없다. 이 브랜치는 직전 두 라운드(`review/code/2026/09/11/18_04_36`,
`review/code/2026/09/11/18_42_05`)에서 이미 DB 관점 LOW 로 판정됐고, 그 이후 추가된 것은 테스트
파일뿐이므로 이번 라운드도 결론은 동일하다.

## 관측된 이상 상태 (뮤테이션 오염 — 코드 결함 아님)

리뷰 도중 `git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` 를
1회 실행했을 때 `remove()` 내부에 다음 줄이 일시적으로 관측됐다:

```
// MUTATED-OUT: await this.chatChannelBinder.teardownChatChannel(trigger);
```

수 초 뒤 재확인(`git status --short`, `git diff HEAD`)했을 때는 사라져 있었고 `git show
HEAD:.../triggers.service.ts` 는 정상 호출문(`await this.chatChannelBinder.teardownChatChannel(trigger);`)
이었다. 이는 이 저장소가 명시적으로 경고한 "병렬 fan-out 중 다른 reviewer 가 공유 워크트리를
직접 뮤테이션" 현상과 일치하며, 실제로 이번 브랜치의 최신 커밋(`8f43b1f56`) 메시지 자체가
*"리뷰어의 워크트리 오염이 3번째"* 라고 기록하고 있다. **내가 만든 뮤테이션이 아니고, 확인
시점에는 이미 자연 복구되어 있었다** — 조치 불요. 다음 reviewer 가 같은 잔여물을 다시 보더라도
새 결함으로 오인하지 않도록 기록만 남긴다.

## 발견사항

- **[INFO]** secret store 다중 쓰기(`secrets.rotate()` 최대 3회) + `triggerRepository.update()` 가
  트랜잭션 경계 없이 순차 실행된다 (사전 존재 — 이번 PR 이 만든 것 아님, 이미 트래킹됨)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 의
    `setupChatChannel` (`secrets.rotate` 호출부 3곳 — 118~160행대, `triggerRepository.update`
    성공/실패 경로 2곳 — 230행대·262행대)
  - 상세: `adapter.setupChannel` 실패 시에도 그 이전에 커밋된 secret store row 는 남는다.
    코드 자체가 `SUMMARY#24` 주석으로 이미 인지·수용한 best-effort 설계이고, 두 차례 앞선
    라운드(`18_04_36`, `18_42_05`)가 동일 지점을 INFO 로 이미 등재했다. 이번 라운드에서도 해당
    코드가 바이트 단위로 변경되지 않았다.
  - 제안: 조치 불요(이번 PR 범위 밖, 트래킹 유지).

- **[INFO]** `trigger.config` JSONB 컬럼 read-modify-write 를 통한 lost-update 가능성이 서비스
  경계를 넘게 됐다 (사전 존재, `plan/in-progress/spec-draft-nullable-notation-followups.md` 및
  `--impl-prep` 리포트에 이미 등재)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 의
    `setupChatChannel` 내 `newConfig`/`fallbackConfig` 조립 후 `triggerRepository.update` 호출부
  - 상세: 동일 `trigger.id` 에 대한 동시 PATCH 가 `secrets.rotate`·`adapter.setupChannel` 등 여러
    `await` 경계를 포함한 이 구간에서 경합하면 나중에 끝나는 쪽이 앞선 갱신을 절대값 SET 으로
    덮어쓸 수 있다. row-level lock(`SELECT ... FOR UPDATE`)·낙관적 버전 컬럼·DB 트랜잭션 경계
    어느 것도 없다. 이동 전 `TriggersService` 내부에 있던 패턴 그대로이며 새로 만든 결함이 아니다.
  - 제안: 조치 불요(이미 트래킹됨). 후속 lock 설계 시 "호출자가 트랜잭션을 열고 binder 를 그 안에서
    부른다" vs "binder 가 스스로 잠근다" 중 하나를 명시적으로 정할 것.

- **[INFO]** SQL 인젝션 위험 없음 — 전량 파라미터화된 TypeORM `Repository.update()`
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel`/
    `teardownChatChannel` 전체)
  - 상세: 모든 DB 쓰기가 `Repository.update({ id: trigger.id }, {...})` 형태이며 raw SQL 문자열
    조립이 없다. 신규/수정된 spec 파일(`chat-channel-binder.service.spec.ts`,
    `trigger-callback-url.spec.ts`, `triggers.service.spec.ts` 등)도 전부 `jest.fn()` mock 만
    사용해 실제 DB 접근이 없다.
  - 제안: 없음.

- **[INFO]** N+1·인덱스·페이지네이션·커넥션 관리·마이그레이션 안전성 — 해당 사항 없음
  - 위치: 전체 diff
  - 상세: `setupChatChannel`/`teardownChatChannel` 모두 단일 트리거(PK 기준) 단건 처리이고
    반복문 내 쿼리가 없다. `{ id: trigger.id }` 조건은 PK 라 인덱스 이슈가 없다. 커넥션은
    Nest/TypeORM DI(생성자 주입) 관리이며 수동 open/close 코드가 없다. `migrations/` 변경이
    diff 에 없어 무중단 배포 위험도 없다.
  - 제안: 없음.

## 요약

이 PR 은 chat-channel adapter setup/teardown 로직을 `TriggersService` private 메서드에서
신설 `ChatChannelBinderService` 로 옮기는 Extract-Class 리팩터이며, DB 접근 코드(TypeORM
`Repository.update` 호출·secret store `rotate` 호출 순서)는 이동 전후 바이트 단위로 동일함을
diff 대조로 확인했다. 신규 쿼리·스키마 변경·마이그레이션·트랜잭션 관련 신규 위험은 없고,
파라미터화된 TypeORM 쿼리만 사용해 SQL 인젝션 위험도 없다. 남아있는 두 관찰(secret store
다중 쓰기의 비-트랜잭션성, `config` JSONB 통째-교체로 인한 lost-update 가능성)은 모두 이 PR
이전부터 존재하던 설계이고 이미 별도 트래커에 등재돼 있어 이번 PR 을 막을 사유가 아니다.
리뷰 중 공유 워크트리에서 일시적 뮤테이션 잔여물(`MUTATED-OUT` 주석)을 관측했으나 확인 시점에
이미 자연 복구되어 있었고 이 PR 의 코드 결함이 아니다.

## 위험도

LOW
