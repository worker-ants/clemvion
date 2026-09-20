# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 직전 리뷰(`review/code/2026/09/21/00_06_01` maintainability WARNING)가 지적한 `NotFoundException` 리터럴 3중 복제는 이번 diff 로 해소됨 — 확인 완료
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:151-156`(헬퍼 정의), 호출부 `:141`, `:374` (트리거 삭제 판정부 `:338` 도 헬퍼 호출로 통일)
  - 상세: `private throwScheduleNotFound(): never { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }); }` 로 추출되어 `findById` · 트리거 삭제 `affected` 판정 · `triggerId` 없는 방어 분기 판정 세 곳 모두 이 헬퍼를 호출한다. 형제 파일 `triggers.service.ts` 의 `throwTriggerNotFound()` 선례와 이름·형태·배치(첫 사용처 바로 다음) 모두 일치해 컨벤션 일관성이 좋다.
  - 제안: 없음 — 이미 올바르게 조치됨.

- **[INFO]** `remove()` 메서드의 책임·길이는 이번 diff 로 실질적으로 늘지 않았고, 기존에 이미 트래커로 추적 중
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:308-383` (`remove()` 전체, 76줄)
  - 상세: BullMQ 해제 → 트리거 락·삭제·`affected` 판정 → catch 에서 404/로깅 분기 → 비밀 정리 → CASCADE 방어적 `remove` 또는 else 분기의 `affected` 판정 → 감사 기록까지 한 메서드가 6가지 책임을 순차로 담당한다. 다만 이 구조는 이전 리뷰(`00_06_01` INFO)에서 이미 확인됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "네 자리(워크플로/트리거/워크스페이스/스케줄) 공용 락-삭제-로깅 형태" 설계 항목이 명시적으로 추적 중이다 — 이번 diff 가 새로 추가한 부채가 아니라 기존에 defer 된 것과 같은 클래스.
  - 제안: 트래커 항목이 처리될 때 `private async removeTriggerLocked(triggerId): Promise<void>` 형태 추출을 함께 고려. 지금 차단 사유 아님.

- **[INFO]** 신규 e2e 스펙(`schedule-delete-concurrency.e2e-spec.ts`)이 형제 파일 3종(`trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts`)과 구조·주석·매직넘버(`1_500`, `60_000`, 5초 락 타임아웃 근거)까지 거의 동일하게 미러링됨
  - 위치: `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` 전체
  - 상세: 이는 이 저장소에서 반복적으로 확인된 의도적 패턴(동일 결함 클래스의 "형제" e2e 를 같은 형태로 유지)이며 DRY 위반으로 볼 사안이 아니다. 각 매직 넘버(`1_500`ms 공허성 가드, `60_000`ms 테스트 타임아웃)는 주석으로 근거(락 대기 상한 5초 안에서 겹침을 만든다)가 설명돼 있어 문제 없음.
  - 제안: 없음 — 조치 불요.

- **[INFO]** 리뷰 중 공유 워크트리에서 다른 reviewer 의 것으로 추정되는 일시적 뮤테이션을 관측함 — 코드 결함 아님, 절차상 기록
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (else 분기, `scheduleRepository.delete` 호출부 부근)
  - 상세: 리뷰 도중 두 차례의 `sed`/`git diff` 조회 사이에 해당 파일의 `const { affected } = await this.scheduleRepository.delete(...)` 및 `if (!affected) this.throwScheduleNotFound();` 가 일시적으로 사라진 상태를 관측했다(`git diff --stat` 이 `1 file changed, 1 insertion(+), 2 deletions(-)` 로 보고). 이는 병렬 fan-out 중인 다른 reviewer 가 판별력 확인용 뮤테이션 테스트를 진행 중인 것으로 추정된다(SUMMARY 의 "유효 뮤턴트... 새 테스트 하나만 죽인다" 서술과 형태가 일치). 본 저장소 트리를 직접 수정·복구하지 않았고, 분석은 `git status --short` 기준 커밋된 HEAD 상태(diff 페이로드와 일치하는 원본 코드)에 근거했다.
  - 제안: 조치 불요 — 관측 사실만 기록. 만약 최종 병합 시점까지 이 파일이 원복되지 않은 채 남아 있다면 다음 리뷰/게이트가 잡아야 한다.

## 그 외 확인 사항 (문제 없음)

- 변수명 `affected`(트리거 삭제·스케줄 자체 삭제 두 판정 지점 모두)와 트랜잭션 매니저 매개변수명 `m` 은 `triggers.service.ts`·`trigger-config-lock.ts` 등 기존 코드베이스 컨벤션과 일치.
- `if (err instanceof NotFoundException) throw err;` catch 가드는 `triggers.service.ts:1101`·`workflows.service.ts`·`workspaces.service.ts` 와 동일한 형태로 일관적.
- 신규 단위 테스트(`schedules.service.spec.ts` 772-813, 893-915행)는 기존 "삭제 실패" 테스트의 `Logger.prototype.error` spy + `try/finally` 복원 패턴을 재사용해 스타일을 지켰고, `DeleteResult` 타입 임포트로 mock 반환값의 타입 정확성도 확보함.
- CHANGELOG·plan 문서(`plan/in-progress/schedule-dup-delete.md`, `spec-draft-nullable-notation-followups.md`)는 코드가 아니므로 가독성/네이밍/함수 길이 등 본 관점의 직접 대상이 아니며 별도 문제를 발견하지 못함.
- `review/code/2026/09/21/00_06_01/**`, `review/consistency/2026/09/20/23_37_12/**` 하위 파일은 이전 리뷰·consistency-check 가 생성한 산출물(비-수기 코드)이라 유지보수성 관점 대상에서 제외.

## 뮤테이션/저장소 변경 여부

이번 리뷰는 저장소 파일을 직접 수정하지 않았다. 다만 위 네 번째 발견사항에 적었듯 리뷰 도중 **다른 reviewer 로 추정되는 뮤테이션**을 관측했다 — 내가 만든 변경이 아니며, `git status --short`/`git diff`로 확인한 시점 기준 `codebase/backend/src/modules/schedules/schedules.service.ts` 에 1줄 삭제 diff 가 일시적으로 존재했다. 이 리포트는 그 상태를 되돌리려 하지 않았다(공유 워크트리 뮤테이션 금지 규약).

## 요약

핵심 diff(`SchedulesService.remove()` 의 동시 DELETE 판별자 전환)는 직전 리뷰가 지적한 유일한 WARNING(`NotFoundException` 리터럴 3중 복제)을 형제 파일의 검증된 헬퍼 패턴(`throwScheduleNotFound(): never`)으로 정확히 해소했다. `remove()` 의 책임 증가는 이미 트래커가 추적하는 기존 이슈이고 이번 diff 로 새로 생긴 부채가 아니다. 신규 e2e/단위 테스트는 기존 컨벤션·명명·구조를 충실히 재사용했다. 유지보수성 관점에서 병합을 막을 사유는 없다.

## 위험도

NONE
