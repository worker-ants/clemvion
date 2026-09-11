# Database Review — chat-channel-binder.service.ts 등 (T2)

## 검토 범위 요약

이 PR(T2)은 `TriggersService.setupChatChannel` / `teardownChatChannel` 두 메서드(및 그 안의
`buildCallbackUrl`)를 `TriggersService`에서 신설 `ChatChannelBinderService`
(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)와
순수 함수 `buildTriggerCallbackUrl`(`codebase/backend/src/modules/triggers/trigger-callback-url.ts`)
로 **그대로 옮긴 것**이다. 신설 파일 원문을 직접 `Read`로 열어 이동 전(diff 중 `triggers.service.ts`
삭제분)과 대조한 결과, DB 쓰기 관련 로직(`triggerRepository.update(...)`, `secrets.rotate(...)`
호출 순서·인자·조건문)은 **문자 그대로 동일**하다 — plan 문서(`plan/in-progress/impl-chat-channel-binder-t2.md`)
가 스스로 주장하는 "단언 diff 0줄 / 순수 이동"과 일치한다. 스키마·마이그레이션 변경, 신규 쿼리,
신규 인덱스 요구는 이 diff에 없다. 나머지 파일(`triggers.module.ts`, `*.spec.ts`, `plan/**`,
`review/consistency/**`)은 DI 등록·문서 산출물이며 DB 관점에서 무관하다.

## 발견사항

- **[INFO]** secret store 다중 쓰기 + `triggerRepository.update()`가 트랜잭션 없이 순차 실행된다 (기존 동작 유지, 신규 아님)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:133-159`(secrets.rotate 최대 2회) 및 `:230-238`/`:262-269`(`triggerRepository.update`)
  - 상세: `setupChatChannel`은 `secrets.rotate()`(secret store, 별도 저장소로 추정)를 최대 3회(①botToken ②provider-issued signing ③server-issued signing) 호출한 뒤 `triggerRepository.update()`로 `config`/`chatChannelHealth` 등을 갱신한다. 이 사이에 원자성 보장이 없어, adapter.setupChannel 실패 시에도 secret store row는 이미 커밋된 상태로 남는다. 다만 이 패턴은 **이번 diff가 만든 것이 아니라 `TriggersService`에서 옮겨온 그대로**이며, 코드 자체에 `SUMMARY#24` 주석으로 이미 인지·수용된 best-effort 설계로 문서화돼 있다(`chat-channel-binder.service.ts:247-248`). 새로 도입된 위험이 아니므로 이 리뷰에서 차단 사유로 삼지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖). 향후 secret store 원자성을 강화하려면 별도 트래킹 항목으로.

- **[INFO]** `config` JSONB 컬럼을 부분 병합이 아니라 통째로 교체 — 서비스 경계를 넘으며 락 설계 논의가 필요해짐 (사전 존재, 이미 tracked)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:226-238`(`newConfig`/`fallbackConfig` 조립 후 `update`)
  - 상세: `trigger.config`를 스프레드한 뒤 `chatChannel` 키만 교체해 저장하는 read-modify-write 패턴은 동시 PATCH 간 lost-update 가능성을 안고 있다(다른 필드를 동시에 갱신하는 요청과 경합 시 나중에 쓰는 쪽이 앞선 갱신을 덮어쓸 수 있음). 이 문제 자체는 이번 diff가 만든 것이 아니라 이동 전부터 있던 것이고, `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 후속 항목(lock 후보: 트리거 단위 advisory lock · `SELECT … FOR UPDATE` · `config` 낙관적 버전 비교)으로 등재돼 있다. 다만 이번 이동으로 그 쓰기가 `TriggersService` 내부 호출에서 **서비스 경계를 넘는 호출**(`TriggersService → ChatChannelBinderService`)로 바뀌었으므로, 향후 락을 도입할 때 "호출자가 트랜잭션/락을 열고 binder를 그 안에서 호출" 대 "binder가 스스로 잠근다" 중 하나를 명시적으로 정해야 하는 설계 축이 하나 더 생긴다. 이 관측은 이미 해당 plan 문서와 `--impl-prep` 리포트(`review/consistency/2026/09/11/17_39_32` INFO#3)에 등재돼 있어 중복 등록은 불필요.
  - 제안: 조치 불요(이미 트래킹됨). 락 설계 시 위 두 선택지 중 하나를 명시.

- **[INFO]** `Repository.remove()`/`Repository.update()` 파라미터화 쿼리 — SQL 인젝션 위험 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:230-238`, `:262-269`
  - 상세: 모든 DB 접근이 TypeORM `Repository.update({ id: trigger.id }, {...})` 형태로, 사용자 입력이 직접 SQL 문자열에 삽입되지 않는다. raw query 사용 없음.
  - 제안: 없음.

- **[INFO]** N+1·인덱스·페이지네이션·커넥션 관리 — 해당 사항 없음
  - 위치: 전체 파일 (`chat-channel-binder.service.ts`, `trigger-callback-url.ts`)
  - 상세: 두 메서드 모두 단일 트리거(PK 기준) 단건 처리이며 반복문 내 쿼리(N+1) 패턴이 없다. `triggerRepository.update({ id: trigger.id }, ...)`는 PK 조건이라 인덱스 이슈가 없다. 커넥션은 NestJS/TypeORM DI가 관리하며 수동 open/close 코드가 없다. 대용량 테이블 스캔·페이지네이션 대상 쿼리도 없다.
  - 제안: 없음.

- **[INFO]** 마이그레이션 파일 없음
  - 위치: 해당 없음 — 이 PR에 `migrations/` 하위 변경 없음
  - 상세: 스키마 변경(컬럼 추가/삭제, 인덱스 생성 등)이 없으므로 무중단 배포 안전성 이슈가 발생하지 않는다.
  - 제안: 없음.

## 요약

이번 diff는 `TriggersService`의 chat-channel 관련 두 메서드를 신설 `ChatChannelBinderService`로 **문자 그대로 옮긴** 리팩터링이며(원문 대조로 확인), 새로운 쿼리·스키마 변경·마이그레이션이 없다. DB 쓰기(secret store rotate + `triggerRepository.update`)의 비-트랜잭션성과 `config` JSONB 통째-교체로 인한 lost-update 가능성은 실재하는 설계상 특성이지만 **이번 PR이 새로 도입한 것이 아니라 이동 전부터 있던 동작**이고, 코드 주석(SUMMARY#24) 및 별도 plan 트래커에 이미 인지·등재돼 있어 이 PR을 차단할 사유가 아니다. 파라미터화된 TypeORM 쿼리만 사용해 SQL 인젝션 위험도 없고, N+1·인덱스·페이지네이션·커넥션 관리 관점에서도 문제되는 패턴이 없다.

## 위험도

LOW
