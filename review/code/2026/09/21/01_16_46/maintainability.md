# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `remove()` 의 순환 복잡도·책임 수는 이번 라운드에도 그대로 높다 (직전 라운드 INFO 재확인, 신규 아님)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:308-388` (`remove()` 전체)
  - 상세: 한 메서드가 (a) BullMQ 해제, (b) `if (schedule.triggerId)` 분기, (c) 트랜잭션 콜백 안 advisory lock + `affected === 0` 판정, (d) `.catch` 안에서 "동시 삭제로 인한 404"와 "진짜 실패"를 가르는 재던짐, (e) 커밋 후 비밀 정리, (f) else 분기의 스케줄 자체 `affected === 0` 판정, (g) 감사 기록까지 7가지 책임을 순차로 담당한다(주석 포함 81줄). `plan/in-progress/spec-draft-nullable-notation-followups.md:4501` 항목이 "네 자리(트리거·워크플로·워크스페이스·스케줄) 공용 헬퍼 형태"를 이미 설계 백로그로 추적 중이고, `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 섹션도 공용 헬퍼 추출을 명시적으로 스코프 아웃했다 — 이번 PR 단독의 새 부채가 아니라 기존에 추적 중인 설계 결정이다.
  - 제안: 트래커 항목이 실제로 처리될 때 트리거-락-삭제 블록 전체를 `private async removeTriggerLocked(triggerId): Promise<void>` 형태로 분리하는 것을 함께 고려. 지금 diff 를 막을 사유는 아니다.

- **[INFO]** 신규 대조군 테스트 두 건이 거의 동일한 반복문 본문을 복제한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:827-846`("트리거 경로"), `:848-866`("triggerId 없는 방어 분기")
  - 상세: 두 `it` 블록 모두 `for (const affected of [undefined, null])` 루프 안에서 거의 동일한 설정(`triggerLockEvents.length = 0`/`auditLogs.record.mockClear()`, `scheduleRepo.findOne.mockResolvedValue(...)`, `*.delete.mockResolvedValueOnce({ affected, raw: [] })`, `resolves.toBeUndefined()` + `auditLogs.record` 호출 단언)을 반복한다. 다만 이는 신규 패턴이 아니라 바로 위에 이미 존재하는 "0행→404" 테스트 쌍(778-816행, 946-968행)이 트리거 경로/방어 분기를 각각 별도 `it` 로 대조하는 것과 **같은 기존 관례**를 그대로 따른 것이라, 이번 diff 가 새로 만든 중복 부채는 아니다.
  - 제안: 조치 불요 — 기존 파일 컨벤션과 일관적이다. 향후 이 파일 전체를 손볼 기회가 생기면 `it.each`/파라미터화로 네 쌍(0행-트리거, 0행-방어분기, unknown-트리거, unknown-방어분기)을 한 번에 정리하는 것을 검토할 수 있다.

## 그 외 확인 사항 (직전 라운드 지적 → 해소 확인)

- **해소됨**: 직전 라운드(`review/code/2026/09/21/00_06_01` maintainability WARNING)가 지적한 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' })` 리터럴 3중 복제는 `throwScheduleNotFound(): never` 헬퍼(`schedules.service.ts:151-156`)로 추출되어 `findById`(141행)·트리거 삭제 판정(342행)·방어 분기 판정(380행) 세 곳 모두 그 헬퍼를 호출한다 — 형제 `triggers.service.ts` 의 `throwTriggerNotFound()` 선례와 같은 형태로 정리됐다. 재발 없음.
- **해소됨**: 직전 라운드(documentation WARNING)가 지적한 CHANGELOG 누락도 이번 diff 의 `CHANGELOG.md` 최상단 신규 항목(문제→고친 것→판별력 실측→남는 것 4단 구성)으로 반영됐고, 형제 트리거 항목의 "남는 것" 문단에 붙인 "2026-09-21 해소" 각주로 인접 모순도 정정됐다 — 원문은 취소선 없이 상태 기록으로 남기고 각주만 추가하는 형태라 가독성상 문제 없다.
- `if (affected === 0)` 명시 비교로의 전환(트리거 경로 342행, 방어 분기 380행)은 두 곳 모두 동일한 근거 주석(자매 함수 `rewriteTriggerConfigLocked` 선례 인용)을 갖고 있어 일관적이다. 변수명 `affected` 도 두 지점에서 통일돼 있다.
- `.catch` 안 `if (err instanceof NotFoundException) throw err;` 가드는 `triggers.service.ts`·`workflows.service.ts`·`workspaces.service.ts` 의 동일 패턴과 형태가 일치한다.
- `schedule-delete-concurrency.e2e-spec.ts` 는 형제 파일 셋(`trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts`)과 구조·네이밍·매직 넘버 근거 주석(`1_500`ms 공허성 가드, `60_000`ms jest 타임아웃, 5초 락 상한)이 일관되어 새로운 문제를 만들지 않는다.
- `plan/in-progress/schedule-dup-delete.md`·`spec-draft-nullable-notation-followups.md`·`review/**` 하위 산출물(RESOLUTION.md, `_resolution_log.md`, `_resolution_state.json`, 00_06_01 세션의 각 리뷰어 산출물)은 코드가 아닌 계획/리뷰 산출물이라 이번 관점(가독성/네이밍/함수 길이 등)의 직접 대상이 아니며 별도 문제를 발견하지 못했다.

## 뮤테이션/저장소 변경 여부

이번 리뷰는 `Read`/`Grep`/`git show`/`git log` 로만 진행했고 저장소 파일을 수정하지 않았다. `git status --short` 확인 결과 리뷰 시작 시점부터 있던 `review/code/2026/09/21/01_16_46/`(다른 reviewer 들의 산출물 디렉터리) 외에 잔여 변경이 없다.

## 요약

이번 라운드는 새로운 코드 결함을 도입하지 않았고, 직전 두 라운드(00_06_01)의 documentation/maintainability WARNING(CHANGELOG 누락, `NotFoundException` 리터럴 3중 복제)을 각각 CHANGELOG 4단 항목 추가와 `throwScheduleNotFound()` 헬퍼 추출로 정확히 해소했다. `affected === 0` 명시 비교 전환과 그 근거를 붙드는 대조군 테스트 추가도 자매 함수(`rewriteTriggerConfigLocked`)의 기존 관례를 그대로 따라 일관적이다. 남은 것은 `remove()` 메서드의 높은 책임 수(이미 트래커가 추적 중인 "네 자리 공용 형태" 설계 항목의 스코프 안)와, 기존 파일 관례를 그대로 따른 대조군 테스트 두 건의 경미한 반복뿐이며 둘 다 차단 사유가 아니다.

## 위험도

NONE
