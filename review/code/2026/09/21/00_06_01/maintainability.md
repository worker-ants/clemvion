# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' })` 객체 리터럴이 이번 diff 로 파일 내 3중 복제가 됐다 — 같은 클래스의 드리프트가 형제 파일에서 이미 한 번 지적·수정된 전례가 있다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:141-146`(기존 `findById`), `:330-335`(신규 — 트리거 삭제 `affected` 판정), `:372-377`(신규 — else 방어 분기 `affected` 판정)
  - 상세: 이번 diff 전에는 이 리터럴이 `findById` 한 곳(141-146행)에만 있었다. 이번 diff 가 같은 `{ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }` 를 두 곳(330-335행, 372-377행) 더 추가해 한 파일 안에 3개의 손글씨 사본이 생겼다. 정확히 같은 종류의 복제가 형제 파일 `codebase/backend/src/modules/triggers/triggers.service.ts` 에서 이미 4곳까지 늘어났다가 `/ai-review`(`review/code/2026/09/14/20_49_15` maintainability WARNING#5)로 지적돼 `assertTriggerFound`/`throwTriggerNotFound()` 헬퍼로 추출된 전례가 있다 — 그 파일 359-366행 주석이 스스로 "같은 리터럴이 네 곳으로 늘었었다... 이 PR 이 스스로 반복해 적은 '복제가 drift 를 부른다' 와 정면으로 어긋나는 상태였다"고 남겨 놓았다. 이번 PR 은 그 교훈이 적용되지 않은 채 schedules 쪽에서 같은 패턴을 재도입했다. 지금은 두 곳 모두 문구가 일치하지만, 메시지를 나중에 한 곳만 고치면(예: 트리거 판정 실패와 스케줄 자체 판정 실패를 구분하고 싶어질 때) 세 곳이 조용히 갈라질 위험이 생긴다.
  - 제안: `triggers.service.ts` 의 선례와 같은 형태로 `private throwScheduleNotFound(): never { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }); }` 를 추출하고, `findById`·트리거 삭제 분기·else 방어 분기 세 곳 모두 이 헬퍼를 호출하도록 정리를 권장한다(차단 사유는 아님).

- **[INFO]** `remove()` 메서드의 순환 복잡도·책임이 이번 diff 로 더 늘었다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:300-385` (`remove()` 전체)
  - 상세: 이번 diff 로 `remove()` 안에 새 분기가 셋 늘었다 — 트랜잭션 콜백 안의 `if (!affected) throw`(330행), `.catch()` 안의 `if (err instanceof NotFoundException) throw err;`(341행), else 분기의 `if (!affected) throw`(372행). 기존 `if (schedule.triggerId)` 분기까지 합치면 한 메서드가 (a) BullMQ 해제, (b) 트리거 락 안에서의 `affected` 판정, (c) 실패 시 "반쯤 삭제됨" 로깅과 "이미 경합에 짐" 을 구분하는 catch, (d) 비밀 정리, (e) else 분기의 스케줄 자체 `affected` 판정, (f) 감사 기록까지 6가지 책임을 순차로 담당한다(86줄, 주석 포함). 다만 관련 크로스-서비스 중복(트리거/워크플로/워크스페이스/스케줄 네 곳의 "락→삭제→실패 로깅→재던짐" 블록)은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4501` 항목이 이미 "네 자리 공용 형태는 설계가 필요하다"로 추적 중임을 확인했다 — 이 PR 이 그 설계를 미루고 지금 자리만 같은 형태로 맞춘 것은 plan 자체가 명시한 선택이다.
  - 제안: 위 트래커 항목이 실제로 처리될 때, 위 WARNING 의 좁은 헬퍼 추출과 별개로 트리거-락-삭제 블록 전체를 `private async removeTriggerLocked(triggerId): Promise<void>` 형태로 뽑아내는 것을 함께 고려할 만하다. 지금 당장 이 diff 를 막을 사유는 아니다.

## 그 외 확인 사항 (문제 없음)

- `if (err instanceof NotFoundException) throw err;` catch 가드 패턴은 `triggers.service.ts:1101`·`workflows.service.ts:293`·`workspaces.service.ts:553` 와 동일한 형태로, 이번 추가가 기존 컨벤션과 일관적이다.
- `const { affected } = await m.delete(...)` / `const { affected } = await this.scheduleRepository.delete(...)` 두 판정 지점 모두 변수명이 `affected` 로 통일돼 있고, 왜 판정 대상이 다른지(트리거는 CASCADE 때문에 스케줄 행이 판별자가 될 수 없음)를 각 지점 주석이 명확히 설명한다 — 가독성 좋음.
- 테스트 파일(`schedules.service.spec.ts`)의 신규 케이스(772-804행)는 기존 "삭제 실패" 테스트(806-848행)와 동일한 `Logger.prototype.error` spy + `try/finally` 복원 패턴을 재사용해 스타일 일관성을 지켰다. `DeleteResult` 타입 임포트(5행)로 mock 반환값의 타입 정확성도 확보했다.
- e2e 신규 파일(`schedule-delete-concurrency.e2e-spec.ts`)은 형제 파일 셋(`trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts`)과 구조·네이밍이 동일해 일관성이 높다. 매직 넘버(`1_500`ms, `60_000`ms)는 각각 "락 대기 상한 5초 안에서 겹침을 만든다"는 주석으로 근거가 설명돼 있다.
- `plan/in-progress/schedule-dup-delete.md`·`spec-draft-nullable-notation-followups.md` 는 코드가 아닌 계획 문서라 이번 관점(가독성/네이밍/함수 길이 등)의 직접 대상이 아니며, 별도 문제를 발견하지 못했다.
- `review/consistency/2026/09/20/23_37_12/**` 하위 파일들은 `/consistency-check` 가 생성한 리뷰 산출물(비-수기 코드)이라 유지보수성 관점의 대상에서 제외했다.

## 뮤테이션/저장소 변경 여부

이번 리뷰는 정적 분석·`grep`/`Read` 로만 진행했고 저장소 파일을 수정하지 않았다. `git status --short` 로 저장소에 잔여 변경이 없음을 확인했다(원래 diff 외 추가 변경 없음).

## 요약

핵심 변경(`SchedulesService.remove()` 의 동시 DELETE 판별자 전환, 형제 트리거/스케줄 판정 분리)은 의도·근거가 주석으로 충분히 설명돼 있고 기존 컨벤션(catch 가드 패턴, 변수 명명, e2e 구조)과 잘 정합한다. 다만 `NotFoundException` 객체 리터럴이 한 파일 안에서 3중 복제된 것은 이 저장소가 형제 파일에서 이미 한 번 겪고 고친 것과 정확히 같은 종류의 드리프트이므로 WARNING 으로 남긴다 — 차단 사유는 아니지만 헬퍼 추출로 쉽게 없앨 수 있는 부채다. `remove()` 메서드의 복잡도 증가는 이미 트래커가 추적 중인 "네 자리 공용 형태" 설계 항목의 스코프 안에 있어 이번 PR 단독의 새로운 부채로 보기는 어렵다.

## 위험도

LOW
