# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `triggerId` 부재 방어 분기는 락 없이 삭제하지만 현재 도달 불가능한 코드다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:372-381` (else 분기, `this.scheduleRepository.delete({ id, workspaceId })`)
  - 상세: `Schedule.triggerId` 컬럼은 엔티티상 `NOT NULL` 이라(`codebase/backend/src/modules/schedules/entities/schedule.entity.ts` `@Column({ name: 'trigger_id' })`, nullable 미지정) 이 분기는 현재 실행 경로로 도달할 수 없다는 것을 코드 주석이 스스로 밝히고 있다. 이 분기는 advisory lock 을 잡지 않고 `affected === 0` 판정만으로 동시성을 처리하는데, 이는 트리거가 있는 주 경로(락 + `affected`)와 다른 처방이다. 방어 코드로서는 일관되지만, 만약 향후 `triggerId` 가 nullable 로 바뀌어 이 분기가 실제로 도달 가능해지면 동시 DELETE 두 건이 이 분기에서 겹칠 때 락이 없다는 점을 재검토해야 한다(현재는 `scheduleRepository.delete` 자체가 원자적 단일 문이라 `affected` 판정만으로 안전 — DB 레벨에서 직렬화됨).
  - 제안: 별도 조치 불요. 이미 plan(`plan/in-progress/schedule-dup-delete.md` §A~B)이 이 분기가 CASCADE 비개입·현재 도달 불가임을 명시하고 있어 문서화 상태로 충분하다.

- **[INFO]** 트랜잭션 커밋 후 처리(비밀 정리·CASCADE no-op 삭제·감사 기록)가 원자적이지 않음 — 기존에 알려진 잔여이며 이번 diff 가 새로 만든 문제는 아님
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:360-387` (`deleteTriggerSecretsAfterCommit` 이후 ~ `recordAudit` 까지)
  - 상세: 트리거 삭제(`m.delete(Trigger, triggerId)`, `affected` 판정)는 트랜잭션 안에서 원자적으로 이루어지지만, 그 뒤의 `deleteTriggerSecretsAfterCommit` → `scheduleRepository.remove(schedule)`(CASCADE 로 이미 0행 no-op) → `recordAudit`  세 단계는 트랜잭션 밖에서 순차 실행된다. 이 중 하나가 실패하면(예: 비밀 정리 중 예외) 트리거 행 삭제는 이미 커밋됐는데 감사 로그가 남지 않는 상태가 될 수 있다. 다만 이는 diff 가 도입한 새 결함이 아니라 이번 diff 가 고치는 대상(중복 감사 행)과는 별개의, 형제 삭제 경로들(#1369·#1370)과 동일한 기존 트레이드오프이며 CHANGELOG·plan 문서에도 "이 PR 이 닫지 않는 잔여"로 명시돼 있다.
  - 제안: 이번 PR 범위 밖. 별도 조치 불요 — 코드 주석·plan 문서가 이미 그 경계를 명확히 하고 있다.

- **[INFO]** DB 레벨 판정 근거(락이 보호하는 쓰기의 `affected`) 사용은 CASCADE 의미론과 일치하며 설계가 타당함 — 확인된 정상 동작
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:322-343` (트리거 삭제 트랜잭션 블록), `codebase/backend/src/modules/schedules/entities/schedule.entity.ts` (`@ManyToOne(() => Trigger, { onDelete: 'CASCADE' })`)
  - 상세: `schedule.trigger_id → trigger` 는 `onDelete: 'CASCADE'` 이므로 트리거 삭제 시 스케줄 행도 DB 가 함께 지운다. 이 diff 는 그 사실을 근거로 "스케줄 행 자체의 affected" 대신 "락 안에서 실행한 트리거 DELETE 의 affected" 를 판별자로 삼는다 — 진 쪽(0행)만 404, 이긴 쪽은 CASCADE 로 스케줄 행이 사라져도 트리거 DELETE 의 affected=1 이 참이라 204 를 유지한다. `affected === 0` 명시 비교(≠ `!affected`)로 `null`/`undefined`("모른다")와 `0`("없다")를 구분한 것도 같은 락 서브시스템의 `rewriteTriggerConfigLocked` 선례와 일관된다. 이 판정 로직이 e2e(`schedule-delete-concurrency.e2e-spec.ts`)로 실제 동시 요청(별도 커넥션이 advisory lock 을 쥔 채 두 DELETE 를 발사)에서 검증됐고, 감사 행 1건·CASCADE 로 스케줄 행 0건까지 DB 를 직접 조회해 확인한다.
  - 제안: 조치 불요 — 리뷰 기록 목적의 긍정 확인.

## 요약

이번 diff 는 `SchedulesService.remove()` 의 동시 DELETE 두 건이 `schedule.deleted` 감사 행을 중복 기록하던 결함을, 형제 세 경로(#1369 워크플로/워크스페이스, #1370 트리거)와 같은 결함 클래스로 인식하고 고쳤다. 스키마 변경(마이그레이션)은 없고, 판정 로직은 `schedule.trigger_id → trigger` 의 `onDelete: 'CASCADE'` 관계를 정확히 반영해 "스케줄 행 자체의 affected" 가 아니라 "락이 보호하는 트리거 DELETE 의 affected" 를 판별자로 선택했다 — 이 선택이 없었다면 CASCADE 때문에 이긴 쪽도 0행이 되어 양쪽 다 404 가 되는 함정에 빠졌을 것이다. `affected === 0` 명시 비교로 `null`/`undefined`(드라이버가 보고하지 않는 경우)와 `0`(실제 0행)을 구분해 정상 삭제를 실패로 뒤집는 회귀를 방지했고, 이는 유닛 테스트의 대조군(undefined/null 케이스)과 e2e(advisory lock 을 쥔 채 동시 DELETE 두 건 발사 후 DB 직접 조회로 감사 행 수·CASCADE 삭제 여부 확인)로 모두 검증됐다. 트랜잭션 범위(advisory lock 획득 + 트리거 DELETE)는 적절하고, 커넥션은 TypeORM `manager.transaction()` 콜백을 통해 정상적으로 해제되며, 파라미터 바인딩(`$1`)을 사용해 SQL 인젝션 위험도 없다. 트랜잭션 커밋 후의 비밀 정리·감사 기록이 원자적이지 않은 점과, `triggerId` 부재 방어 분기가 락 없이 처리되는 점은 모두 기존에 알려진(문서화된) 잔여이며 이번 diff 가 새로 만든 결함이 아니다. N+1·인덱스·페이지네이션·대량 데이터 관련 새로운 쿼리 패턴은 도입되지 않았다.

## 위험도

LOW
