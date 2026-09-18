# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` / `.conf` (신규)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` 의 `find` 에 `select` 추가
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` — 위 변경에 대한 단위 단언
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` — 인덱스 존재·유효성 스키마 단언 추가
- `plan/in-progress/spec-draft-trigger-workflow-index.md`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/consistency/**` — spec·리뷰 산출물(모두 문서/텍스트, 실행 부작용 없음)

실제 소스는 `Read` 로 전문을 직접 열어 확인했다(`trigger-resource-releaser.service.ts` 전체, `chat-channel-binder.service.ts` 의 `teardownChatChannel`/`teardownRegisteredChannel`, `trigger.entity.ts`, `trigger-resource-releaser.service.spec.ts` 관련 구간, `trigger-deletion-releases-resources.e2e-spec.ts` 관련 구간). 저장소 파일은 어느 것도 수정하지 않았다(`git status --short` 로 확인, 세션 시작 시 상태와 동일 — 미추적 리뷰 산출물 디렉터리만 존재).

## 발견사항

- **[INFO]** `releaseExternalForParent` 의 `find` 컬럼 축소는 실제 소비처와 정확히 일치 — 의도치 않은 상태 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-77` (`releaseExternalForParent`)
  - 상세: `select: { id: true, type: true, config: true }` 로 좁혔다. 다운스트림을 직접 추적한 결과 — `releaseExternalMany` 는 `trigger.type`(schedule 필터) · `trigger.id`(스케줄 매칭)만 쓰고(`trigger-resource-releaser.service.ts:149-165`), `chatChannelBinder.teardownChatChannel(trigger)` 는 `trigger.config.chatChannel` · `trigger.id` 만 읽으며(`chat-channel-binder.service.ts:365-371`), `channelListenerRegistry.unregister(trigger.id)` 는 `id` 만 쓴다. `Trigger` 엔티티에는 `@AfterLoad`/subscriber 등 부분 로드에 영향받는 라이프사이클 훅이 없다(grep 확인, 0건). 호출자 두 곳(`workflows.service.ts:268`, `workspaces.service.ts:513`) 모두 반환값(`Promise<void>`)을 쓰지 않으므로 컬럼 축소가 호출자에 영향을 주지 않는다.
  - 제안: 없음 — 정보성.

- **[INFO]** V111 마이그레이션은 프로덕션 DB 스키마에 대한 비-트랜잭션 DDL 부작용을 낸다 — 의도된 것이나 부작용 관점에서 명시
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` 전체, `.conf`(`executeInTransaction=false`)
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;` 를 신규 마이그레이션 맨 앞에 두는 것은 `migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 관례를 신규 추가 케이스에도 적용한 것으로, 만약 `idx_trigger_workflow_id` 라는 이름의 인덱스가 이 마이그레이션과 무관하게(수동 운영 작업 등으로) 이미 존재했다면 조용히 드롭된다. naming-collision checker 가 저장소 전수 grep 0건을 확인했고(`review/consistency/2026/09/18/12_18_52/naming_collision.md`), 이 리스크는 이름이 마이그레이션 파일명과 1:1 대응하는 컨벤션 자체가 감수하는 것으로 이미 README 에 "감수하는 비대칭"으로 문서화돼 있다. CONCURRENTLY 오퍼레이션은 `trigger` 테이블에 SHARE UPDATE EXCLUSIVE 락만 걸어 읽기/쓰기를 막지 않는다.
  - 제안: 없음 — 기존 프로젝트 컨벤션을 그대로 따른 것이고 이번 PR 이 새로 도입한 리스크가 아니다.

- **[INFO]** 신규 e2e 스키마 단언은 순수 조회이며 부작용 없음
  - 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:199-212` (`it('schema: trigger (workflow_id) 인덱스가 유효하게 있다 (V111)', …)`)
  - 상세: `pg_index`/`pg_class` 를 읽기만 하고 데이터를 심거나 지우지 않는다. `beforeAll`/`afterAll` 훅과 격리돼 있어 다른 테스트의 DB 상태에 영향을 주지 않는다.

## 요약

시그니처·공개 인터페이스 변경은 없다(`releaseExternalForParent` 의 타입 시그니처는 그대로이고 내부 쿼리만 좁혔다). 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경은 발견되지 않았다. 유일하게 상태에 영향을 주는 변경은 (1) `find` 의 `select` 축소 — 실제 다운스트림 소비 컬럼과 정확히 일치함을 소스 추적으로 확인했고 두 호출자 모두 반환값 미사용이라 영향 없음, (2) 신규 마이그레이션의 프로덕션 스키마 DDL — 기존 README §5 컨벤션을 그대로 따른 의도된 부작용이며 naming-collision 전수 검사로 충돌 없음이 이미 확인됐다. 코드·테스트·spec·리뷰 산출물 전체에서 CRITICAL/WARNING 급 의도치 않은 부작용은 없다.

## 위험도

NONE
