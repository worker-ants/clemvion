# 성능(Performance) 리뷰 — trigger (workflow_id) 인덱스 + select 좁히기

## 발견사항

- **[INFO]** `releaseExternalMany` 의 chat-channel teardown 이 트리거 수만큼 순차 `await` — 이 diff 밖의 기존 코드, 이미 트래커에 등재된 열린 항목
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:159-164`
  - 상세: `for (const trigger of triggers) { await this.chatChannelBinder.teardownChatChannel(trigger); this.channelListenerRegistry.unregister(trigger.id); }` 는 트리거 수에 선형으로 지연이 늘어난다(외부 provider 호출이 포함될 수 있음). 다만 이 함수 본문은 이번 diff 의 변경 대상이 아니고(diff 는 `releaseExternalForParent` 의 `select` 추가와 JSDoc 뿐), `plan/in-progress/spec-draft-trigger-workflow-index.md` `## 트래커 반영` 절이 "둘째 불릿(순차 처리 지연 …)은 남긴다"로 이미 명시적으로 스코프 밖에 두고 있다. 재지적이 아니라 이번 PR 이 그 문제를 악화시키지 않았음을 확인하는 참고.
  - 제안: 조치 불요(이미 별도 트래커 항목). 후속 PR 에서 `Promise.allSettled` 배치 또는 provider별 동시성 상한 검토 시 이 자리 참고.

- **[INFO]** `scheduleRepository.find`(같은 함수 내부)는 `select` 없이 `Schedule` 전체 컬럼을 적재 — Trigger 에 적용한 패턴과 비대칭이나 개선 여지는 제한적
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:154`
  - 상세: 이번 diff 가 `releaseExternalForParent` 의 `Trigger.find`에는 `select: { id, type, config }` 를 추가했지만, 바로 아래 `Schedule.find({ where: { triggerId: In(...) } })` 는 좁히지 않았다. 다만 이 함수는 실패 시 `removeScheduleJobsOrRestore` → `scheduleRunner.registerJob(schedule)` 로 **엔티티 전체**를 재사용해 스케줄을 재등록하므로(cron, timezone, parameterValues 등), 함부로 좁히면 복구 경로가 깨질 수 있어 단순 비교는 위험하다. diff 대상도 아니므로 조치 불요, 향후 `select` 를 더 좁힐 때는 `undoAbsentTriggerWrite`/`registerJob` 소비처부터 확인하라는 이번 PR 자체의 원칙(서비스 JSDoc: "필드를 더 줄일 때 소비처부터 볼 것")을 그대로 적용하면 된다.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 는 락 문제는 없지만 대형 테이블에서 실행 시간 자체는 길 수 있음 — 이미 설계로 흡수됨
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33`
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서, `.conf` 의 `executeInTransaction=false` 모두 올바르다. `CONCURRENTLY` 는 배포 중 쓰기 블로킹은 피하지만 스캔 자체(2회 풀 테이블 스캔)는 여전히 발생하므로 프로덕션 테이블이 실측치(320,000행 기준 파라미터)보다 훨씬 크면 인덱스 빌드 시간이 길어질 수 있다. 이는 결함이 아니라 CONCURRENTLY 인덱스 생성의 본질적 특성이고, 실측 표와 함께 이미 문서화되어 있어 별도 조치는 불요.

## 요약

이 PR 의 핵심은 `trigger.workflow_id` 에 인덱스(V111)를 추가해 워크플로 삭제 경로가 트리거 테이블을 세 번(외부 해제 열거·비밀 정리 열거·FK CASCADE) 전부 스캔하던 것을 인덱스 스캔으로 바꾸는 것과, `releaseExternalForParent` 의 `find` 에 `select: { id, type, config }` 를 추가해 불필요한 컬럼(비밀 참조·헬스·타임스탬프 등)을 적재하지 않도록 좁힌 것이다. 두 변경 모두 실측(Seq Scan 7.52ms → Bitmap Index Scan 0.04ms, 320,000행 기준)으로 뒷받침되고, 마이그레이션은 `CONCURRENTLY` + 비-트랜잭션 + invalid 잔재 정리(DROP-먼저) 패턴을 정확히 따르며, e2e 테스트는 인덱스 실재뿐 아니라 `indisvalid` 와 정의(컬럼 구성)까지 검증해 "이름만 점유한 무효 인덱스"를 조용히 통과시키지 않는다. `select` 좁히기 회귀도 단위 테스트가 `find` 호출 인자를 정확히 대조해 `config`/`type` 누락을 잡아낸다. 이번 diff 범위 밖에 남아 있는 트리거 수 선형 순차 처리(chat-channel teardown 루프)는 이미 별도 트래커 항목으로 명시적으로 열려 있어 재지적하지 않았다. 전반적으로 결함 없이 잘 설계된 성능 개선 PR 이다.

## 위험도
NONE
