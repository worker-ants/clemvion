# Database Review — `impl-chat-channel-binder-t2` (2026-09-11 18:42 라운드)

## 검토 범위 요약

이번 diff(`origin/main` 대비)는 `TriggersService.setupChatChannel` / `teardownChatChannel` /
`buildCallbackUrl` 을 신설 `ChatChannelBinderService`
(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`codebase/backend/src/modules/triggers/trigger-callback-url.ts`)로
그대로 옮긴 Extract-Class 리팩터다. 이 라운드는 직전 리뷰(`review/code/2026/09/11/18_04_36`)의
WARNING 1·2 를 해소하기 위해 단위 테스트 2개 파일(`chat-channel-binder.service.spec.ts`,
`trigger-callback-url.spec.ts`)을 신설하고, `RESOLUTION.md`/`SUMMARY.md` 등 리뷰 산출물을
추가한 것이 실질 변화다.

`git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` 로
삭제분(구 private 메서드)과 `chat-channel-binder.service.ts` 신설분을 직접 대조했다 —
`triggerRepository.update(...)` 호출의 인자·조건문·`secrets.rotate(...)` 순서가 **문자 그대로
동일**하다. `grep -n "query\|createQueryBuilder\|transaction\|manager\.\|QueryRunner"` 로
두 파일을 훑어 신규 raw 쿼리·트랜잭션·QueryRunner 사용이 없음을 확인했다. `migrations/` 하위
파일은 이번 diff 에 없다(`git diff origin/main --name-only` 로 확인).

즉 DB 관점에서 **이번 라운드가 코드 쪽에 새로 추가한 것은 없다** — 추가된 두 spec 파일은 순수
함수/서비스의 반환값·호출 인자를 검증할 뿐 DB 접근을 하지 않는다(둘 다 `jest.fn()` mock 만 사용,
실제 `Repository`/DB 연결 없음).

## 발견사항

- **[INFO]** secret store 다중 쓰기(`secrets.rotate()` 최대 3회) + `triggerRepository.update()` 가
  트랜잭션 경계 없이 순차 실행된다 (사전 존재 — 이번 라운드가 만든 것 아님)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel`
    (`secrets.rotate` 호출부 3곳, `triggerRepository.update` 성공/실패 경로 2곳)
  - 상세: adapter.setupChannel 실패 시에도 그 이전에 커밋된 secret store row 는 남는다. 코드
    자체가 `SUMMARY#24` 주석으로 이미 인지·수용한 best-effort 설계이고, 직전 라운드
    `review/code/2026/09/11/18_04_36/database.md` 가 동일 지점을 INFO 로 이미 등재했다. 이번
    라운드에서 해당 코드가 바이트 단위로 변경되지 않았으므로 재등재만 하고 신규 결함으로
    취급하지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖, 트래킹 유지).

- **[INFO]** `trigger.config` JSONB 컬럼 read-modify-write 를 통한 lost-update 가능성이 서비스
  경계를 넘게 됐다 (사전 존재, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  및 `--impl-prep` 리포트에 등재)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:226-238`,
    `:258-269`(`newConfig`/`fallbackConfig` 조립 후 `triggerRepository.update`)
  - 상세: 동일 `trigger.id` 에 대한 동시 PATCH 가 이 read-modify-write 구간(`secrets.rotate`·
    `adapter.setupChannel` 등 여러 `await` 경계 포함)에서 경합하면 나중에 끝나는 쪽이 앞선
    갱신을 절대값 SET 으로 덮어쓸 수 있다. row-level lock(`SELECT ... FOR UPDATE`)·낙관적 버전
    컬럼·DB 트랜잭션 경계 어느 것도 없다. 이 PR 이 만든 결함이 아니라 이동 전 `TriggersService`
    내부에 있던 패턴 그대로이며, 이미 별도 후속 항목으로 추적 중이다(위 plan 문서 + 이번 diff
    에 포함된 `review/code/2026/09/11/18_04_36/concurrency.md` 도 같은 지점을 INFO 로 기록).
    다만 호출 경로가 `TriggersService` 내부 호출 → `TriggersService → ChatChannelBinderService`
    간 서비스 경계 호출로 바뀌었으므로, 향후 lock 을 도입할 때 "호출자가 트랜잭션/lock 을 열고
    binder 를 그 안에서 부른다" vs "binder 가 스스로 잠근다" 를 명시적으로 정해야 하는 설계
    축이 하나 늘었다는 점만 참고로 남긴다.
  - 제안: 조치 불요(이미 트래킹됨). 후속 lock 설계 시 위 두 선택지 중 하나를 명시.

- **[INFO]** SQL 인젝션 위험 없음 — 전량 파라미터화된 TypeORM `Repository.update()`
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:230-238`,
    `:262-269`
  - 상세: 모든 DB 쓰기가 `Repository.update({ id: trigger.id }, {...})` 형태이며 raw SQL 문자열
    조립이 없다. 신규 spec 파일 2개도 DB 접근이 없어(전부 mock) 이 관점에서 영향 없음.
  - 제안: 없음.

- **[INFO]** N+1·인덱스·페이지네이션·커넥션 관리·마이그레이션 안전성 — 해당 사항 없음
  - 위치: 전체 diff
  - 상세: 두 메서드 모두 단일 트리거(PK 기준) 단건 처리이고 반복문 내 쿼리가 없다.
    `{ id: trigger.id }` 조건은 PK 라 인덱스 이슈가 없다. 커넥션은 Nest/TypeORM DI 관리이며
    수동 open/close 코드가 없다. `migrations/` 변경이 없어 무중단 배포 위험도 없다.
  - 제안: 없음.

## 요약

이번 라운드는 chat-channel adapter setup/teardown 로직을 옮기는 순수 리팩터(직전 라운드에서
이미 완료)에 대한 검증 테스트 2개 파일을 추가한 것이며, DB 접근 코드 자체는 이전 라운드와
바이트 단위로 동일함을 `git diff origin/main` 대조와 `grep` 으로 확인했다. 신규 쿼리·스키마
변경·마이그레이션·트랜잭션 관련 신규 위험은 없고, 파라미터화된 TypeORM 쿼리만 사용해 SQL
인젝션 위험도 없다. 유일하게 남아있는 관찰은 secret store 다중 쓰기의 비-트랜잭션성과
`config` JSONB 통째-교체로 인한 lost-update 가능성인데, 둘 다 이 PR 이전부터 존재하던 설계이고
이미 별도 트래커에 등재돼 이번 PR 을 막을 사유가 아니다.

## 위험도

LOW
