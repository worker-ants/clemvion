# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `releaseExternalForParent` 의 `select` 축소는 공개 시그니처를 바꾸지 않지만, 반환되는 `Trigger` 엔티티가 부분 hydration 된 객체(런타임에서 `id`·`type`·`config` 외 필드는 `undefined`)로 바뀐다. 타입 시스템은 이를 드러내지 않는다(TypeORM `select` 관용 패턴).
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72`~`78` (`releaseExternalForParent`), 내부에서 소비하는 `releaseExternalMany`는 `:149`~`165`
  - 상세: `releaseExternalMany` 내부에서 실제로 읽는 필드는 `trigger.id`·`trigger.type`·(`chatChannelBinder.teardownChatChannel` 경유) `trigger.config` 세 개뿐임을 직접 확인했다 — `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:365`~`371`(`teardownChatChannel`)도 `trigger.config`/`trigger.id`만 사용한다. 따라서 현재 시점에는 실질적 부작용이 없다. 다만 이 select 축소는 "필요한 필드만 정확히 나열"하는 계약이라, **추후 `releaseExternalMany`나 그 하위 협력자가 새 필드(예: `workspaceId`, `endpointPath`)를 읽도록 확장되면, 컴파일 타임 오류 없이 조용히 `undefined`를 참조하게 된다** — 코드 주석(`:70`)이 이 위험을 이미 명시하고 단위 테스트(`trigger-resource-releaser.service.spec.ts:94`~`99`)가 `select` 절 자체를 뮤테이션 테스트로 고정해 두었으므로, 현재 변경 범위 내에서는 완화되어 있다.
  - 제안: 추가 조치 불요(이미 자기 인지·테스트 고정됨). 향후 리뷰어를 위해 "select 확장 시 이 서비스의 select 리스트도 함께 확인" 이라는 점만 인지.

- **[INFO]** 신규 마이그레이션(V111)이 `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;` 를 `CREATE` 앞에 무조건 실행한다 — 이는 상시 실행되는 파괴적 DDL(비-트랜잭션)이며, 정상 최초 실행 시엔 no-op 이지만 "실패 후 재실행" 경로에서는 이미 유효한 인덱스가 있어도 지웠다가 다시 만든다(README §5 신규 문구가 그 비대칭을 명시).
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31`~`33`
  - 상세: 이는 README §5(`codebase/backend/migrations/README.md:177`~`189` 신규 절, V110 선례와 동일 패턴)에 이미 문서화된 의도된 컨벤션이고, 새로 도입된 위험이 아니라 기존 정책의 정합적 적용이다. Flyway 는 이 파일을 1회만 적용하므로(버전 관리) 정상 운영에서는 이 DROP 이 반복 실행되지 않는다.
  - 제안: 없음(문서화된 트레이드오프를 그대로 수용).

- **[INFO]** 마이그레이션(`.sql`/`.conf`)과 `plan/`, `review/consistency/**` 아래 다수의 신규 파일 생성은 이 PR 의 정상적 산출물(플랜 트래커·컨시스턴시 체크 아카이브)이며, 애플리케이션 실행 경로에서 발생하는 예기치 못한 파일시스템 부작용은 아니다. 확인만 하고 별도 조치 없음.

## 점검했으나 문제 없음 확인

- **시그니처/인터페이스**: `releaseExternalForParent(parent: TriggerParent): Promise<void>` 파라미터·반환 타입 변경 없음. `TriggerResourceReleasePort` 인터페이스(`trigger-resource-release.ts:146`) 불변. 호출부 `workflows.service.ts:268`, `workspaces.service.ts:513` 모두 반환값을 사용하지 않아 영향 없음.
- **전역 상태/전역 변수**: 신규 전역 변수 없음. 서비스는 기존 DI 의존성만 사용.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신규 외부 호출 없음. `scheduleRunner.removeJob`/`registerJob`(Redis/BullMQ), `chatChannelBinder.teardownChatChannel`(외부 provider) 는 기존 호출 경로 그대로이며 호출 인자·순서 변경 없음.
- **이벤트/콜백**: `channelListenerRegistry.unregister`, `teardownChatChannel` 호출 시점·순서는 diff 이전과 동일. 테스트(`trigger-resource-releaser.service.spec.ts`)가 이벤트 순서를 이미 고정하고 있고 이번 diff 로 해당 순서 단언은 변경되지 않았다.
- **DB 스키마 부작용**: `CREATE/DROP INDEX CONCURRENTLY` 는 신규 인덱스 추가라는 의도된 스키마 변경이며, 기존 테이블 데이터·다른 인덱스·다른 쿼리 플랜에 부수적 영향을 주지 않는다(단일 컬럼 신규 인덱스, 이름 충돌 없음 — `naming_collision` checker 도 grep 0건으로 확인).

## 요약

이번 변경은 (1) `trigger (workflow_id)` 신규 인덱스 마이그레이션(V111 + .conf) 도입과 (2) `TriggerResourceReleaserService.releaseExternalForParent` 내부 쿼리의 `select` 축소, 그리고 관련 스펙/플랜/리뷰 문서 갱신으로 구성된다. 공개 시그니처·인터페이스·환경 변수·네트워크 호출·이벤트 순서 모두 변경되지 않았고, DB 인덱스 추가는 README 컨벤션에 정합하게 문서화·테스트된 의도된 스키마 부작용이다. 유일한 잠재 리스크는 `select` 축소로 인한 "미래에 필드가 조용히 `undefined`가 될 수 있는" TypeORM 특유의 함정인데, 이는 코드 주석과 뮤테이션 테스트로 이미 명시적으로 방어되어 있어 이번 PR 범위에서는 실질적 위험이 없다.

## 위험도
LOW
