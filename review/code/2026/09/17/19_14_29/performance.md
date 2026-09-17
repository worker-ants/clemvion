# 성능(Performance) 리뷰 — 트리거 삭제 자원 정리 (4경로)

## 발견사항

- **[WARNING]** 워크플로 삭제 경로가 `trigger.workflow_id` 로 필터링하는데 그 컬럼엔 인덱스가 없다 — 매 삭제마다 `trigger` 테이블 풀스캔, 그것도 락을 쥔 트랜잭션 안에서
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:63-66`(`releaseExternalForParent` — `this.triggerRepository.find({ where: parent })`), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:68-90`(`lockParentAndListTriggerIds` — `manager.find(Trigger, { select: { id: true }, where: parent })`); 호출부 `codebase/backend/src/modules/workflows/workflows.service.ts:267-278`
  - 상세: `TriggerParent`(`trigger-resource-release.ts:115`)는 `{ workflowId }` 또는 `{ workspaceId }` 를 받아 그대로 TypeORM `where` 로 쓴다. 워크스페이스 경로는 `idx_trigger_workspace_type ON trigger (workspace_id, type)`(`V002__indexes.sql:25`)가 선두 컬럼으로 `workspace_id` 를 커버해 인덱스를 탈 수 있지만, `trigger.workflow_id` 컬럼은 `V001__initial_schema.sql` 정의 이후 어떤 마이그레이션에서도 인덱스가 생성된 적이 없다(`grep workflow_id *.sql` 로 확인 — trigger 테이블 관련 인덱스는 workspace_id 뿐). FK(`REFERENCES workflow(id) ON DELETE CASCADE`)는 Postgres 에서 자동으로 컬럼 인덱스를 만들지 않는다. 이 PR 이전에는 `WorkflowsService.remove()` 가 `workflowRepository.remove(workflow)` 하나로 끝나 트리거를 직접 조회하지 않았다 — `trigger WHERE workflow_id = ?` 쿼리 자체가 이번 PR 이 새로 추가한 것이다. 게다가 같은 워크플로 삭제 한 번에 이 조회가 **두 번**(트랜잭션 밖 `releaseExternalForParent`, 트랜잭션 안 `lockParentAndListTriggerIds`) 일어나고, 두 번째는 워크플로 행에 `pessimistic_write` 락을 잡은 **채로** 풀스캔을 돈다 — `trigger` 테이블이 커질수록 락 보유 시간이 늘어 동시 삭제·동시 트리거 쓰기와의 경합·교착 창이 넓어진다.
  - 제안: `CREATE INDEX idx_trigger_workflow_id ON trigger (workflow_id)` (또는 `(workflow_id, id)` 커버링) 마이그레이션 추가. 이 저장소는 이미 같은 클래스의 문제를 겪고 고친 선례가 있다(`V105__execution_workflow_status_index.sql`, `V110__schedule_workspace_next_run_index.sql`) — 같은 패턴.

- **[WARNING]** 트리거 비밀 삭제가 트리거 수만큼 순차 DB 왕복 — 배치 삭제 가능한데 N+1
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:60-69`(`deleteTriggerSecretsAfterCommit` 의 `for...of` 루프)
  - 상세: 루프 안에서 `await secrets.deleteByPrefix(triggerSecretPrefix(triggerId))` 를 트리거마다 `await` 한다. `SecretResolverService.deleteByPrefix`(`codebase/backend/src/modules/secret-store/secret-resolver.service.ts:182-200`)는 호출마다 별도의 `DELETE ... WHERE ref LIKE :prefix` 쿼리를 실행한다. 워크플로·워크스페이스 삭제처럼 트리거가 여러 개인 경로에서는 트리거 수만큼 순차 DB 라운드트립이 발생한다(N+1). 실패 격리(하나 실패해도 나머지 계속)가 요구사항이라 완전히 병렬화하기보다, 한 쿼리로 여러 접두를 동시에 지우는 편이 낫다 — 트리거 id 가 UUID 라 LIKE 메타문자가 섞이지 않으므로 `WHERE ref LIKE ANY(ARRAY[...])` 한 번으로 묶을 수 있고, 실패해도 이건 이미 단일 트랜잭션 없는 best-effort 호출이라 부분 실패 의미가 원래도 옅다(DB 단일 문장은 통째로 성공/실패). 최소한 `Promise.allSettled` 로 병렬화라도 하면 트리거 수에 비례하던 지연이 상수에 가까워진다.
  - 제안: `deleteByPrefix` 에 다건 버전(`deleteByPrefixes(prefixes: string[])`)을 추가하거나, 호출부에서 `Promise.allSettled` 로 병렬 실행 + 실패만 개별 로그.

- **[WARNING]** 워크스페이스/워크플로 삭제 시 트리거별 chat-channel teardown 이 완전 순차 — 대량 삭제 시 요청 시간이 트리거 수 × provider 지연에 선형 비례
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:136-152`(`releaseExternalMany` — `for (const trigger of triggers) { await this.chatChannelBinder.teardownChatChannel(trigger); ... }`)
  - 상세: 주석(134줄)에 "동시에 부르면 같은 provider 에 한꺼번에 요청이 몰린다"는 의도적 설계 근거가 적혀 있어 완전한 결함은 아니다. 다만 상한이나 동시성 제한(예: `p-limit(3)`) 없이 **완전 순차**라, 트리거 수가 큰 워크스페이스를 삭제하면 외부 provider teardown 지연(네트워크 I/O, 타임아웃 포함)이 그대로 누적돼 삭제 요청이 매우 오래 걸릴 수 있다. `removeScheduleJobsOrRestore`(라인 162-195) 도 같은 파일 안에서 BullMQ job 을 순차로 `removeJob` 한다 — Redis 라운드트립이라 상대적으로 가볍지만 역시 트리거 수에 선형이다.
  - 제안: provider 과부하를 피하면서도 대량 삭제 지연을 줄이려면 완전 직렬(1) 대신 작은 동시성 상수(예: 2~3)로 배치 처리. 최소한 이 사실을 spec(§4.3)나 운영 문서에 "대량 트리거 워크스페이스 삭제는 O(n) 지연"으로 명시해 타임아웃 설정과 연결하는 것도 방법.

- **[INFO]** `releaseExternalForParent` 가 필요 이상으로 넓은 컬럼(전체 엔티티)을 적재
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:63-66`
  - 상세: `this.triggerRepository.find({ where: parent })` 는 `select` 프로젝션이 없어 `config`(JSONB), `notification_secret_v2`, `chat_channel_token_v2` 등 큰 컬럼까지 전부 메모리에 올린다. 바로 아래 `lockParentAndListTriggerIds`(라인 85-88)는 같은 조건에 `select: { id: true }` 를 써서 필요한 것만 가져온다 — 대조적이다. 이쪽은 `teardownChatChannel`이 `trigger.config.chatChannel` 을 읽어야 해서 완전한 `select` 축소는 어렵지만, 최소한 `id`·`type`·`config` 세 컬럼으로 좁히면 `notification_secret_v2`·`chat_channel_token_v2` 같은 텍스트 블롭은 뺄 수 있다.
  - 제안: `select: { id: true, type: true, config: true }` 추가.

- **[INFO]** 같은 부모(workflow/workspace) 아래 트리거 목록을 삭제 한 번에 두 번 조회 — 의도된 설계이지만 비용 인지 필요
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:267-278`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:512-530`
  - 상세: 트랜잭션 밖 스냅샷(외부 해제용)과 트랜잭션 안 재조회(비밀 정리 대상 확정)가 분리돼 있어 트리거 집합을 두 번 쿼리한다. 이는 spec §4.3 의 "남는 창을 닫으려는" 의도적 트레이드오프로 문서화돼 있어 결함으로 보진 않지만, 트리거가 매우 많은 워크스페이스에서는 위 인덱스 부재 이슈와 겹쳐 비용이 두 배가 된다는 점만 기록해 둔다(첫 WARNING 과 동일 인덱스 추가로 두 조회 모두 해소됨).

## 요약

이번 변경은 트리거 삭제 시 자원 정리를 네 경로로 일원화하는 리팩터로, 정합성 설계(순서·트랜잭션 경계·보상)는 꼼꼼하지만 규모 확장 관점은 검증되지 않았다. 가장 실질적인 문제는 `WorkflowsService.remove()` 가 새로 추가한 `trigger WHERE workflow_id = ?` 조회에 대응하는 인덱스가 없어 워크플로 삭제마다(그것도 락을 쥔 채) 풀스캔이 발생한다는 점이고, 그다음은 트리거별 비밀 삭제·chat-channel teardown 이 완전 순차라 트리거가 많은 워크스페이스 삭제가 트리거 수에 선형으로 느려진다는 점이다. 둘 다 소규모 트리거 집합(대부분의 실제 사용 사례)에서는 체감되지 않지만, 트리거 테이블이 자라거나 대형 워크스페이스를 지울 때 지연·락 경합으로 드러날 잠재 리스크다.

## 위험도

MEDIUM
