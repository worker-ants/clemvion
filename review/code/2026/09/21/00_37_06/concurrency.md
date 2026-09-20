# 동시성(Concurrency) 리뷰 — schedule 동시 DELETE 감사 중복 수정

## 발견사항

- **[WARNING]** `affected` 의 `0` 과 `null`/`undefined` 를 같은 것으로 취급 — 같은 서브시스템의 자매 함수가 명시적으로 반대로 결정한 지점과 배치된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:337-338` (`const { affected } = await m.delete(Trigger, triggerId); if (!affected) this.throwScheduleNotFound();`), 같은 파일 `:371-375` (`triggerId` 없는 방어 분기의 `scheduleRepository.delete`)
  - 상세: `!affected` 는 `affected === 0`(진짜 동시 삭제 패배) 과 `affected === null`/`undefined`(드라이버가 카운트를 보고하지 않은 경우) 를 구분하지 않는다. 그런데 바로 같은 파일이 잠그는 그 advisory lock 을 공유하는 `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked` 는 이 지점을 이미 실측하고 정반대로 결정해 두었다 — "`affected` 가 `null`·`undefined` 인 경우(드라이버가 보고하지 않음)는 판정하지 않는다 — «모른다» 를 «없다» 로 읽으면 정상 쓰기를 실패로 뒤집는다" (`trigger-config-lock.ts:247-248`, 실제 판정은 `:255` `if (result.affected === 0) return false;`). 이번 PR 의 delete 경로는 그 캐비어트를 반영하지 않고 `!affected` 로 되돌아갔다. 실사용 중인 TypeORM+pg 드라이버는 `DELETE`/`UPDATE` 에 대해 `rowCount` 를 신뢰성 있게 정수로 돌려주므로 오늘 당장 실패를 유발할 가능성은 낮고(같은 falsy 패턴이 `auth.service.ts:655`, `workspace-invitations.service.ts:456` 등에도 이미 쓰이고 있어 코드베이스 관행과는 부합한다), 다만 **드라이버가 카운트를 보고하지 못하는 경로(드라이버 교체·프록시·특정 커넥션 풀러)** 가 생기면 이 delete 경로만 "정상 삭제 완료를 404 로 오판" 하는 방향으로 틀린다 — `rewriteTriggerConfigLocked` 가 정확히 경계하려던 방향의 오류다.
  - 제안: 최소한 그 캐비어트를 이 지점에도 주석으로 남기거나(트리거·워크스페이스 CASCADE 형제 delete 경로도 같은 패턴이라면 함께), `result.affected === 0` 명시 비교로 통일해 "모른다" 를 "없다" 로 읽지 않게 한다. Critical 은 아니다 — 현재 드라이버 행태상 관측 가능한 결함은 아니다.

- **[INFO]** BullMQ `removeJob` 이 advisory lock 획득·승패 판정보다 먼저 실행됨 — 이미 CHANGELOG/plan 에 알려진 잔여
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:311` (`await this.scheduleRunnerService.removeJob(schedule.id);`)
  - 상세: 동시 DELETE 두 건 모두 `findById`(락 없음) 를 통과한 뒤 곧장 `removeJob` 을 각자 호출한다 — 어느 쪽이 이길지 advisory lock 획득/`affected` 판정 이전이다. `removeJob` 이 멱등이라는 전제 위에서만 안전하며, PR 자체와 CHANGELOG(`plan/in-progress/schedule-dup-delete.md` 관련 서술, CHANGELOG.md 의 "BullMQ removeJob(락 밖, 되돌릴 수 없음) 중복 호출도 이 PR 이 닫지 않는다") 가 이를 명시적으로 미해결 잔여로 적어 두었다. 형제 PR(#1369/#1370)들과 같은 처리이므로 이번 PR 이 새로 만든 결함은 아니다.
  - 제안: 조치 불필요(이미 문서화됨). 후속에서 `removeJob` 을 락 안으로 옮기거나 결과를 판정에 반영할지는 planner 트래킹 항목(`IntegrationsService.remove()` 처방과 함께) 대상.

- **[INFO]** 수정 설계 자체는 건전함 — advisory lock + `affected` 판별자 + 트랜잭션 롤백 조합이 경쟁을 올바르게 닫는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:322-355` (`if (schedule.triggerId) { ... m.transaction(...) ... }`)
  - 상세: `pg_advisory_xact_lock` 은 두 동시 삭제 트랜잭션을 직렬화하고, 진 쪽은 `m.delete(Trigger, triggerId)` 의 `affected === 0` 을 관측해 `NotFoundException` 을 던져 트랜잭션을 롤백한다(TypeORM `manager.transaction()` 은 콜백 throw 시 자동 ROLLBACK 후 같은 에러를 re-throw — 표준 동작). `.catch` 에서 `NotFoundException` 만 조용히 통과시키고 그 외 에러만 로그를 남기므로, 정상적인 "패배"가 "반쯤 삭제됨" 거짓 경보로 이어지지 않는다. 승자 경로만 `deleteTriggerSecretsAfterCommit`·`scheduleRepository.remove`·`recordAudit` 까지 진행되므로 감사 중복이 재발하지 않는다. `schedule.trigger_id → trigger` 의 `onDelete: 'CASCADE'`(`schedule.entity.ts:28`) 확인 결과 CASCADE 가 스케줄 행을 함께 지우는 것도 실제 엔티티 정의와 일치 — "스케줄 행 카운트로는 판정 불가"라는 CHANGELOG 근거가 맞다.
  - 데드락 가능성: 이 경로에서 트랜잭션당 advisory lock 하나만 획득하며 락 획득 순서 문제가 없어 데드락 여지는 없다. `TriggersService.remove()`/`rewriteTriggerConfigLocked` 와 같은 락 키(`triggerConfigLockKey(triggerId)`)를 공유하므로 트리거 config PATCH·트리거 자체 삭제·스케줄 cascade 삭제 세 진입점이 서로 올바르게 직렬화된다.

- **[INFO]** `triggerId` 없는 방어 분기(`schedules.service.ts:368-376`)는 엔티티상 `NOT NULL` 이라 현재 도달 불가 — 도달 가능해지더라도 자체 `scheduleRepository.delete({id, workspaceId})` 는 PK 조건부 단일 DELETE라 락 없이도 스스로 원자적으로 승자를 가른다(DB 행 잠금이 자연 직렬화). 락이 없다고 해서 이 분기 자체에 새로운 경쟁 조건이 생기는 것은 아니다.

- **[INFO]** e2e 테스트(`codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`) 설계 양호 — 별도 커넥션으로 advisory lock 을 선점해 두 DELETE 요청의 실제 인터리빙을 강제하고, `Promise.race` 로 "락을 놓기 전 아직 둘 다 안 끝났음"을 공허성 가드로 확인한 뒤에야 판정한다(`:101-111`). 형제 e2e 스펙(`trigger-/workflow-/workspace-delete-concurrency`)과 같은 검증 기법이며 재현력(패치 전 `[204,204]`+감사 2건 → 패치 후 `[204,404]`+감사 1건)도 CHANGELOG 에 명시돼 있다.

## 요약

`SchedulesService.remove()` 의 동시 DELETE 감사 중복 결함(형제 클래스의 4번째 자리)을 advisory lock(`pg_advisory_xact_lock`, 트리거 config 락과 공유) + 트랜잭션 내 `m.delete(Trigger, triggerId)` 의 `affected` 판별자로 닫은 수정이다. 락 사용 방식·트랜잭션 롤백·에러 분기(NotFoundException 조용히 통과 vs 그 외 에러 로그)가 모두 올바르고, 형제 트리거/워크플로/워크스페이스 삭제 경로와 일관된 판정 로직(CASCADE 로 인해 "트리거 삭제"가 유일한 판별자라는 근거도 엔티티 정의로 확인됨)을 취한다. 데드락 가능성은 없으며(락 하나만 사용, 순서 문제 없음), unit·e2e 테스트 모두 실제 인터리빙을 강제하는 방식으로 승/패 양쪽 분기를 검증한다. 유일하게 짚을 만한 점은 `!affected` 판정이 `affected === 0`(진짜 경쟁 패배) 과 `null`/`undefined`(드라이버 미보고) 를 구분하지 않아, 같은 lock 을 공유하는 `trigger-config-lock.ts` 가 명시적으로 반대로 결정해 둔 지점과 철학이 어긋난다는 것이다 — 현재 TypeORM+pg 드라이버 행태상 실제로 관측 가능한 결함은 아니라 WARNING 수준으로 남긴다. BullMQ `removeJob` 이 락/판정 이전에 양쪽 요청 모두에서 호출되는 점은 CHANGELOG 가 이미 미해결 잔여로 명시했으므로 새로운 결함이 아니다.

## 위험도

LOW
