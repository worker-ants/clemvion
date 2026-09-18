# 데이터베이스(Database) 리뷰 — trigger (workflow_id) 인덱스

## 발견사항

- **[INFO]** `V111` 의 DROP+CREATE(동일 이름) 패턴은 `migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 절이 문서화한 형태(옛 인덱스↔새 인덱스, 이름이 다른 3문장)와 정확히 일치하지 않는다.
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33` (DROP/CREATE), `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저"
  - 상세: README §5 는 "옛 이름 → 새 이름" 교체 케이스(V110 선례, 3문장: `DROP(새이름)` → `CREATE(새이름)` → `DROP(옛이름)`)만 명시적으로 규약화하고 있다. V111 은 신규 추가라 옛 인덱스가 없으므로 같은 이름에 대해 `DROP IF EXISTS` → `CREATE IF NOT EXISTS` 2문장만 쓴다 — 이는 README 가 별도로 분류한 "V106 형태(CREATE 만, 신규 추가)"도 아니고 "V110 형태(교체)"도 아닌 **제3의 변형**이다. 마이그레이션 파일 자체의 헤더 주석(24~30행)이 그 의도(V106 이 안고 있는 "invalid 잔재가 영영 유효해지지 않는 문제"를 신규 추가 케이스에서도 선제적으로 막음)와 재실행 시 비대칭(신규 추가라 잃을 옛 인덱스가 없어, 성공 후 재실행 비용은 재빌드용 seq scan 뿐)을 정확히 설명하고 있어 동작 자체는 안전하다. `--spec` consistency check(`review/consistency/2026/09/18/12_18_52/rationale_continuity.md` INFO 3)도 이미 이 갭을 지적했고 SQL 헤더 주석 추가로 해소된 것으로 처리됐다.
  - 제안: 이 패턴이 향후 "신규 인덱스 + invalid 잔재 선제 정리"의 표준형이 될 것이면, `migrations/README.md` §5 에 "신규 추가 + 동일 이름 DROP-먼저" 를 V106/V110 과 나란히 3번째 형태로 명문화해 다음 작성자가 참조할 수 있게 하는 것을 권장한다(블로킹 아님, 문서 정합성 차원).

- **[INFO]** `V111` 마이그레이션과 e2e 스키마 단언 자체는 CONCURRENTLY/비-트랜잭션/`indisvalid` 검증까지 V110 선례를 그대로 따르고 있어 안전하다. 확인한 항목:
  - `.conf` 의 `executeInTransaction=false` — `CREATE/DROP INDEX CONCURRENTLY` 는 트랜잭션 블록 안에서 실행 불가하다는 PostgreSQL 제약과 일치.
  - `idx_trigger_workflow_id` 는 `codebase/`·`spec/`·`plan/` 전수에서 이번 PR 도입분 외 그레프 충돌 없음, `V111` 넘버링도 `V110` 다음으로 비어 있음(디렉터리 리스팅으로 직접 확인).
  - 신규 인덱스가 잡는 컬럼(`workflow_id`)은 실제로 `trigger.workflow_id_fkey`(V001, `NOT NULL REFERENCES workflow(id) ON DELETE CASCADE`)와 앱 레벨 두 열거(`TriggerResourceReleaserService.releaseExternalForParent`, `lockParentAndListTriggerIds`)가 공통으로 등치 조건으로만 쓰므로 단일 컬럼 B-tree 로 충분 — 복합 인덱스나 부분 인덱스가 필요한 정렬/추가 술어는 없다.
  - e2e 신규 테스트(`trigger-deletion-releases-resources.e2e-spec.ts:199-212`)가 `pg_index.indisvalid` 까지 확인해, "이름은 있지만 invalid" 상태를 초록으로 통과시키지 않는다 — V110 선례(`schedule-trigger.e2e-spec.ts`)와 동일한 검증 강도.
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql`, `codebase/backend/migrations/V111__trigger_workflow_id_index.conf`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:199-212`
  - 상세/제안: 결함 없음, 확인 완료로 기재.

- **[INFO]** `releaseExternalForParent` 의 `select: { id: true, type: true, config: true }` 프로젝션이 실제 소비 지점과 정확히 일치한다 — over-fetch(불필요한 대량 컬럼 적재)를 줄이는 개선.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-78` (프로젝션), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:149-165` (`releaseExternalMany` 가 `trigger.type`/`trigger.id` 소비), `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:365-371`(`teardownChatChannel` 이 `trigger.config`/`trigger.id` 만 읽음)
  - 상세: `Trigger` 엔티티(`codebase/backend/src/modules/triggers/entities/trigger.entity.ts`)를 직접 열어 `id`·`type`·`config` 컬럼 존재를 확인했고, 실제 소비 코드가 이 세 필드 외에는 트리거 객체를 참조하지 않음을 추적 확인했다. 유닛 테스트(`trigger-resource-releaser.service.spec.ts:96-97`)도 `select` 객체를 정확히 고정해 향후 컬럼 누락을 잡는다.
  - 제안: 없음(정상). 다만 같은 파일의 `releaseExternalMany` 내부 `scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds) } })` (금번 diff 범위 밖, 기존 코드)는 `select` 프로젝션이 없어 `Schedule` 전체 컬럼을 적재한다 — 이번 PR 의 "필드를 좁힌다" 원칙을 적용할 여지가 있으나 이번 변경 스코프 밖이므로 별도 항목으로만 남긴다.

- **[INFO]** N+1/트랜잭션 관점에서 이번 diff 는 기존 구조(트랜잭션 밖 외부 해제 1회 `find`, 트랜잭션 안 부모 잠금 후 1회 `find`, FK CASCADE 1회)를 그대로 유지하며 새로 반복문 내 개별 쿼리를 추가하지 않는다. `releaseExternalMany` 안의 `for (const trigger of triggers) { await this.chatChannelBinder.teardownChatChannel(trigger); ... }` 루프는 외부 provider I/O(순차 처리, 의도적 — 동시 다발 요청으로 provider 과부하 방지 주석 있음)이며 DB 쿼리 N+1 이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:149-165`
  - 제안: 없음(정상). 참고로 plan 트래커(`plan/in-progress/spec-draft-trigger-workflow-index.md` "트래커 반영")가 "부모 하나에 딸린 트리거 수에 선형인 순차 처리 지연"을 별도 미해결 항목으로 이미 열어 두고 있다.

## 요약

이번 변경의 핵심은 (1) `trigger.workflow_id` 에 대한 `CONCURRENTLY` B-tree 인덱스 신설 마이그레이션(V111)과 (2) `TriggerResourceReleaserService.releaseExternalForParent` 의 `find` 를 `select` 프로젝션으로 좁힌 것이다. 마이그레이션은 무중단 배포에 필요한 관례(비-트랜잭션 `.conf`, `IF EXISTS`/`IF NOT EXISTS`, invalid 잔재 선제 정리, `indisvalid` 까지 확인하는 e2e 스키마 테스트)를 정확히 따르고 있고, 인덱스 대상 컬럼·단일 컬럼 선택·번호 충돌 부재를 직접 대조해 문제를 찾지 못했다. `select` 프로젝션 변경도 실제 소비 컬럼(`id`/`type`/`config`)과 코드 추적으로 정확히 일치함을 확인했다. 유일한 지적은 DROP-먼저 패턴이 README §5 가 명시한 두 형태(교체/신규-CREATE-only) 어디에도 정확히 속하지 않는 제3의 변형이라는 문서 정합성 관점의 INFO 이며, 이미 SQL 헤더 주석으로 근거가 설명돼 있어 동작상 리스크는 없다. Critical/Warning 없음.

## 위험도

LOW
