# 테스트(Testing) 리뷰 — trigger (workflow_id) 인덱스 + `releaseExternalForParent` select 좁히기

## 발견사항

- **[INFO]** `releaseExternalForParent` 의 select 좁히기(`config` 포함)가 실제 chat-channel 트리거로
  워크플로/워크스페이스 삭제 경로를 타는 e2e 검증이 없다
  - 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (전체 파일, `createWebhookTrigger`/`createActiveSchedule` 헬퍼만 존재) · `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:14-15` (`trigger()` 헬퍼)
  - 상세: `trigger-resource-releaser.service.ts:72-77` 의 JSDoc 은 "`config` 를 빼면 teardown 이 설정을 못 찾아
    조용히 no-op 이 된다"고 명시적으로 경고한다. 이 실패 형태를 잡는 유일한 자동 테스트는
    `trigger-resource-releaser.service.spec.ts:96-99` 의 `toHaveBeenCalledWith({ select: {...}, where: ... })`
    구조적 대조뿐이다 — mock repository 는 select 값과 무관하게 항상 전체 객체를 돌려주므로(테스트
    주석 자신도 "이 mock 으로는 드러나지 않는다"고 인정), TypeORM 이 실제로 jsonb `config` 컬럼을
    부분 select 로 정확히 실어 오는지, 그리고 그 값이 `teardownChatChannel` 까지 흘러가 실제 provider
    teardown 을 트리거하는지는 어떤 테스트도 실행하지 않는다. `chat-channel-discord.e2e-spec.ts` ·
    `chat-channel-slack.e2e-spec.ts` 는 단일 트리거 삭제(`releaseExternal`, 항상 풀 엔티티 로드)만
    다루고, 워크플로/워크스페이스 cascade 삭제(`releaseExternalForParent`)는 다루지 않는다. 현재는
    이 diff 가 `config` 를 select 목록에 **포함**시켰으므로 즉각적인 회귀는 아니지만(이전에는 select
    자체가 없어 전체 로드), 코드 주석이 스스로 지목한 실패 모드에 대한 e2e 신뢰도는 낮다.
  - 제안: `trigger-deletion-releases-resources.e2e-spec.ts` 에 chat-channel(`config.chatChannel`)이 세팅된
    트리거를 하나 만들고 부모(워크플로 또는 워크스페이스)를 삭제해 provider teardown 이 실제로
    호출됐는지(또는 최소한 정리 후 config 기반 부수효과가 관측 가능한지) 검증하는 케이스를 추가한다.
    파일 자체 주석이 밝히듯 telegram setup 비용(~18초)이 부담이면, 이미 seed 된 provider mock 이 있는
    `chat-channel-discord/slack.e2e-spec.ts` 쪽에 워크플로 삭제 케이스를 추가하는 방법도 있다.

## 테스트 관점 검토 (변경 없음/양호 항목)

- `V111` 스키마 e2e 테스트(`trigger-deletion-releases-resources.e2e-spec.ts:199-212`)는 `V110`
  (`schedule-trigger.e2e-spec.ts`) · `V047/V048`(`background-monitoring.e2e-spec.ts`) 선례와 동일한
  패턴(`indisvalid` 확인 + `pg_get_indexdef` 로 정의 대조)을 그대로 따른다. `$` 로 끝을 고정한 정규식이
  부분 인덱스(`WHERE ...`)가 실수로 붙는 경우까지 잡아낸다 — 좋은 판별 fixture.
- `releaseExternalForParent` 의 `select` 파라미터 변경은 `toHaveBeenCalledWith` 로 세 키
  (`id`/`type`/`config`) 전체를 정확히 대조하므로, 세 필드 중 어느 것을 빠뜨려도 (mock 이 항상 전체
  객체를 돌려주는 것과 무관하게) 이 단언 자체가 RED 가 된다 — plan 이 주장하는 "`config` 제거 RED
  1/1, `type` 제거 RED 1/1" 뮤테이션 예측은 코드상 타당하다.
- 같은 파일의 나머지 기존 테스트(스케줄 필터링·실패 복구·`lockParentAndListTriggerIds` 순서 보증 등)는
  이번 diff 로 인한 동작 변화가 없어 유효성을 유지한다. `select` 를 조회 인자로 새로 붙였음에도 다른
  테스트는 `find` 호출 인자를 단언하지 않고 `events` 배열만 보므로 회귀 없음.
- `TriggerResourceReleasePort` 를 모킹하는 상위 레벨 테스트(`workflows.service.spec.ts`,
  `workspaces.service.spec.ts`)는 인터페이스 경계에서 mock 하므로 이번 내부 select 변경과 무관하게
  그대로 유효하다.
- 테스트 격리: 새 e2e 테스트는 읽기 전용 카탈로그 조회(`pg_index`/`pg_class`)만 수행해 다른 테스트의
  데이터 상태에 의존하지 않고, 실행 순서와 무관하게 독립적으로 통과/실패한다.
- 마이그레이션 파일(`V111__trigger_workflow_id_index.sql`/`.conf`) 자체는 SQL/설정 파일이라 유닛
  테스트 대상이 아니며, 위 스키마 e2e 테스트가 유일하고 적절한 검증 수단이다 — 선례와 동일한 처리.
- README.md 컨벤션 갱신은 문서 전용 변경이라 테스트 대상 아님.

## 요약

핵심 변경(V111 인덱스 스키마 검증, `releaseExternalForParent` select 좁히기에 대한 단위 테스트)은
기존 프로젝트 패턴을 정확히 따르고 있고, 단위 테스트 단 하나의 정확 대조 단언으로 세 select 필드
전부에 대한 뮤테이션 커버리지를 확보했다는 점도 문서화·검증됐다. 다만 그 단언은 구조적(호출 인자)
검증일 뿐이라, 코드 주석이 직접 경고하는 "config 누락 시 조용한 no-op" 실패 모드를 실제 DB·실제
chat-channel provider 경로로 확인하는 e2e 테스트는 여전히 없다 — 이번 diff 가 새로 만든 회귀는
아니지만(select 에 `config` 를 포함시켰으므로), 향후 필드가 더 줄어들 때 이를 잡아줄 유일한 안전망이
구조적 단위 테스트 하나뿐이라는 점은 백로그로 남길 만하다.

## 위험도
LOW
