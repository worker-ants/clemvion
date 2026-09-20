# 요구사항(Requirement) 리뷰 — `SchedulesService.remove()` 동시 DELETE 중복 감사 수정

## 발견사항

- **[INFO]** `3-schedule.md` 에는 트리거 문서(`2-trigger-list.md §4.4`)와 대칭되는 "동시 삭제 → 두 번째 404" 결과 서술이 없다 (spec fidelity — 회색지대/침묵, 모순 아님)
  - 위치: `spec/2-navigation/3-schedule.md` §4 (`DELETE /api/schedules/:id` 행)
  - 상세: 이번 수정으로 스케줄 삭제도 트리거와 동일한 `[204, 404]` + 감사 1건 계약을 갖게 되지만, 대상 spec 문서는 이를 서술하지 않는다. 다만 이는 spec 이 구현과 모순되는 것이 아니라 원래 이 계약을 서술한 적이 없는 침묵이며, 이번 diff 자체(`plan/in-progress/spec-draft-nullable-notation-followups.md:4795`)가 이미 이 갭을 트래커 스코프에 `3-schedule.md §4` 로 추가해 등재했고 `consistency-check`(cross_spec INFO#1)도 동일하게 분류·차단 사유 아님으로 처리했다. `spec_impact: none` 결정과 상충하지 않는다.
  - 제안: 별도 조치 불요 — 이미 등재된 트래커 항목의 처리를 기다리면 된다.

- **[INFO]** 방어 분기(`triggerId` 없음, `schedules.service.ts` `remove()` 의 `else`)는 트리거 경로와 달리 삭제 실패에 대한 별도 로깅·의미 분리(`.catch` + `NotFoundException` 재구분)가 없다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 `else` 블록 (`this.scheduleRepository.delete({ id, workspaceId })` 이후)
  - 상세: `Schedule.triggerId` 컬럼은 `@Column({ name: 'trigger_id' })` 로 선언(nullable 미지정 → NOT NULL)돼 있어(`schedule.entity.ts`) 이 분기는 현재 DB 스키마상 도달 불가능한 방어 코드라는 주석의 주장은 실제로 확인된다. 따라서 실사용 영향은 없으나, 만약 향후 `triggerId` 가 nullable 로 바뀌어 이 분기가 실제로 실행되게 되면, `delete()` 가 `NotFoundException` 이외의 이유(DB 오류 등)로 실패해도 트리거 경로처럼 "반쯤 삭제된 상태" 로그를 남기지 않고 조용히 전파된다 — 형제 경로와의 처리 비대칭.
  - 제안: 현재는 조치 불요(도달 불가능). 이 분기가 실제로 도달 가능해지는 스키마 변경이 있을 때 함께 재검토할 사항으로만 기록.

- **[INFO]** 동시 삭제 두 요청 모두 `scheduleRunnerService.removeJob()` 을 락 밖에서 각각 호출한다(중복 호출) — 이 PR 의 의도적 비목표
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()` 상단 (`await this.scheduleRunnerService.removeJob(schedule.id);`)
  - 상세: `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 섹션에서 형제 PR(#1369/#1370)과 동일한 잔여 사안으로 명시적으로 스코프 아웃했다. 외부 호출(BullMQ)을 락 안에 넣는 것은 금지된 형태로 별도 정리돼 있어 코드 결함이 아니라 알려진 트레이드오프다.
  - 제안: 조치 불요 — 이미 문서화된 의도적 유예.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 검증 결과 (문제 없음)

- **판별자 선택이 정확하다**: `Schedule.trigger` FK 는 `onDelete: 'CASCADE'` (`schedule.entity.ts:28`, `Trigger` 삭제 시 DB 가 스케줄 행도 함께 지움) 이므로, 스케줄 행의 `affected` 를 판정자로 쓰면 이긴 쪽도 0행이 되어 오판(둘 다 404)한다는 plan/코드 주석의 핵심 통찰이 엔티티 실측과 일치한다. 락 안 `m.delete(Trigger, triggerId)` 의 `affected` 를 판정자로 쓴 것이 옳다.
- **에러 분기 분리**가 정확하다: `.catch((err) => { if (err instanceof NotFoundException) throw err; ...error 로그...; throw err; })` — 동시 삭제로 인한 404(정상 경쟁 결과)와 실제 반쯤 삭제 실패(로그 필요)를 구분해 거짓 경보를 내지 않는다. 관련 단위 테스트 두 개가 각각 (a) 진 쪽은 `logger.error` 미호출 + 감사·비밀정리 생략, (b) 진짜 실패는 `logger.error` 호출 + `'반쯤 삭제된 상태'` 문자열 포함을 검증하며 실제로 갈린다.
- **테스트-구현 계약 정합**: `schedules.service.spec.ts` 의 trigger repo `delete` mock 이 기존 `undefined` 반환에서 `{ affected: 1 }` 로 수정됐고(변경 안 했다면 `const { affected } = await m.delete(...)` 가 구현에서 `TypeError` 를 던졌을 것), 신규 mock 은 실제 `DeleteResult` 형태를 충실히 반영한다. `withTransactionMock` 의 `delete` 위임도 이 값을 그대로 통과시켜 목이 실제 TypeORM 트랜잭션의 에러 전파(동기/비동기 reject 보존)를 충실히 흉내낸다.
- **e2e 재현·검증**: `schedule-delete-concurrency.e2e-spec.ts` 는 advisory lock 을 별도 커넥션으로 쥐어 실제 겹침을 만들고(공허성 가드로 "아직 안 끝남" 을 먼저 확인), `[204, 404]` 상태쌍 + `audit_log` 1건 + 최종 `schedule` 행 0건(CASCADE 확인)을 검증한다. 파일 위치·명명(`test/*.e2e-spec.ts`)이 `jest-e2e.json` 의 `testRegex`·형제 파일들과 일치해 정상적으로 수집된다.
- **반환값/도달 불가 방어 분기**: 두 분기(`if (schedule.triggerId)` / `else`) 모두 성공/실패 시 명확한 값(void 반환 또는 `NotFoundException`)을 낸다. `else` 분기는 현재 NOT NULL 스키마상 도달 불가하다는 주석 주장이 엔티티 정의로 실측 확인됐다.
- **TODO/FIXME**: 없음.
- **비즈니스 로직 대칭성**: 워크플로(#1369)·트리거(#1370) 형제 PR 과 같은 결함 클래스·같은 처방 형태(락 보호 쓰기의 `affected` 를 판정자로)를 일관되게 따른다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 다섯 번째 남은 자리(`IntegrationsService.remove()`)를 grep 근거(0건→1건)와 함께 정확히 등재해 "마지막이라고 적을 때마다 남은 자리가 나온다" 는 반복 패턴에 대한 후속 조치도 갖춰져 있다.

## 요약

`SchedulesService.remove()` 의 동시 DELETE 중복 감사 결함을 락 보호 쓰기(`m.delete(Trigger, triggerId)`)의 `affected` 를 판정자로 삼아 정확히 수정했다. CASCADE 로 인해 스케줄 행 자체는 판정자가 될 수 없다는 함정을 코드 주석·plan·e2e 테스트 세 곳에서 모두 정확히 짚었고, 실제 엔티티 정의(FK `onDelete: 'CASCADE'`, `triggerId` NOT NULL)로 그 근거를 검증했다. 승/패 두 경로 모두 감사·비밀정리·로깅이 올바르게 갈리며, 단위 테스트(mock 계약 갱신 포함)와 e2e(실제 겹침 재현 + 공허성 가드)가 이 계약을 이중으로 고정한다. 유일한 관련 spec 갭(`3-schedule.md` 의 동시 삭제 결과 서술 부재)은 모순이 아닌 침묵이며 이번 PR 자체가 이미 후속 트래커에 등재해 처리 경로가 확보돼 있다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
