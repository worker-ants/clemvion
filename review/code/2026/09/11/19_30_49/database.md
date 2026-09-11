# Database Review — `impl-chat-channel-binder-t2` (2026-09-11 19:30 라운드)

## 검토 범위 요약

`git log --oneline -10` 기준 이번 라운드에서 직전 DB 리뷰(`review/code/2026/09/11/19_06_54/database.md`,
판정 LOW) 이후 추가된 커밋은 `68bb34e73` 하나다. `git show --stat 68bb34e73` 로 대조한 결과 production
코드 변경은 없고, `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 에 `ChatChannelBinderService`
provider 등록(+`describe('TriggersService.remove — …')` 배선 고정용 변수 선언) 을 추가한 **테스트 전용**
diff 이며, 나머지 변경분은 전부 `plan/**`·`review/**` 문서다.

`git diff origin/main --name-only` 로 이번 브랜치 전체 변경 파일을 다시 확인했다 — DB 접근 코드가 있는
파일은 `chat-channel-binder.service.ts`(신설) / `triggers.service.ts`(호출부만 교체) 뿐이고, 이 둘은
지난 라운드 이후 바이트 단위로 변경되지 않았다(`git diff origin/main -- .../chat-channel-binder.service.ts`
와 `.../triggers.service.ts` 를 재실행해 확인). `migrations/` 하위 파일도 이번 diff 에 없다. 워킹트리는
`git status --short` 기준 이번 리뷰 산출물 디렉터리(`review/code/2026/09/11/19_30_49/`, untracked)를
제외하면 깨끗하다 — 저장소를 뮤테이션하지 않았다.

## 발견사항

이전 두 라운드(`18_04_36`, `18_42_05`, `19_06_54`)에서 이미 등재·수용된 관찰 외에 **이번 라운드가 새로
만든 DB 관점 이슈는 없다**. 참고용으로 기존 관찰을 재확인만 하고 새 항목으로 중복 등재하지 않는다.

- **[INFO]** secret store 다중 쓰기(`secrets.rotate()` 최대 3회) + `triggerRepository.update()` 가
  트랜잭션 경계 없이 순차 실행된다 (사전 존재 — 이 PR 이 만든 것 아님, 이미 트래킹됨)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel`
    (`secrets.rotate` 호출부 — 134·154·208행, `triggerRepository.update` 성공/실패 경로 — 230행·262행)
  - 상세: `adapter.setupChannel` 실패 시에도 그 이전에 커밋된 secret store row 는 남는다. 코드 자체가
    `SUMMARY#24` 주석으로 이미 인지·수용한 best-effort 설계이고, 세 차례 앞선 라운드가 동일 지점을
    INFO 로 이미 등재했다. 이번 라운드에서도 해당 코드는 변경되지 않았다.
  - 제안: 조치 불요(이번 PR 범위 밖, 트래킹 유지).

- **[INFO]** `trigger.config` JSONB 컬럼 read-modify-write 를 통한 lost-update 가능성이 서비스 경계를
  넘게 됐다 (사전 존재, `plan/in-progress/spec-draft-nullable-notation-followups.md` 및 `--impl-prep`
  리포트에 이미 등재)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel` 내
    `newConfig`/`fallbackConfig` 조립 후 `triggerRepository.update` 호출부(230행·262행)
  - 상세: 동일 `trigger.id` 에 대한 동시 PATCH 가 `secrets.rotate`·`adapter.setupChannel` 등 여러 `await`
    경계를 포함한 이 구간에서 경합하면 나중에 끝나는 쪽이 앞선 갱신을 절대값 SET 으로 덮어쓸 수 있다.
    row-level lock(`SELECT ... FOR UPDATE`)·낙관적 버전 컬럼·DB 트랜잭션 경계 어느 것도 없다. 이동 전
    `TriggersService` 내부에 있던 패턴 그대로이며 이번 PR 이 새로 만든 결함이 아니다(concurrency
    reviewer 도 동일 지점을 독립적으로 관측).
  - 제안: 조치 불요(이미 트래킹됨).

- **[INFO]** SQL 인젝션 위험 없음 — 전량 파라미터화된 TypeORM `Repository.update()`
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel`/
    `teardownChatChannel` 전체)
  - 상세: 모든 DB 쓰기가 `Repository.update({ id: trigger.id }, {...})` 형태이며 raw SQL 문자열 조립이
    없다. 이번 라운드에서 유일하게 추가된 `triggers.service.spec.ts` 도 `jest.fn()` mock 만 사용해 실제
    DB 접근이 없다.
  - 제안: 없음.

- **[INFO]** N+1·인덱스·페이지네이션·커넥션 관리·마이그레이션 안전성 — 해당 사항 없음
  - 위치: 전체 diff
  - 상세: `setupChatChannel`/`teardownChatChannel` 모두 단일 트리거(PK 기준) 단건 처리이고 반복문 내
    쿼리가 없다. `{ id: trigger.id }` 조건은 PK 라 인덱스 이슈가 없다. 커넥션은 Nest/TypeORM DI(생성자
    주입) 관리이며 수동 open/close 코드가 없다. `migrations/` 변경이 diff 에 없어 무중단 배포 위험도
    없다.
  - 제안: 없음.

## 요약

이번 라운드에서 직전 DB 리뷰 이후 추가된 변경은 `triggers.service.ts` 테스트 스위트에 신규 협력자
`ChatChannelBinderService` provider 를 등록하는 테스트 전용 diff뿐이며, production DB 접근 코드(TypeORM
`Repository.update` 호출·secret store `rotate` 호출 순서·트랜잭션 경계)는 이전 라운드 대비 바이트 단위로
동일하다. 신규 쿼리·스키마 변경·마이그레이션·트랜잭션 관련 신규 위험은 없고, 파라미터화된 TypeORM
쿼리만 사용해 SQL 인젝션 위험도 없다. 남아있는 두 관찰(secret store 다중 쓰기의 비-트랜잭션성, `config`
JSONB 통째-교체로 인한 lost-update 가능성)은 모두 이 PR 이전부터 존재하던 설계이고 이미 별도 트래커에
등재돼 있어 이번 PR 을 막을 사유가 아니다. 저장소 뮤테이션은 관측되지 않았다.

## 위험도

LOW
