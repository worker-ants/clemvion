# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

없음 (CRITICAL/WARNING 급 발견사항 없음).

## 확인 사항 (문제 없음 — 이전 두 라운드 지적의 해소 검증 포함)

- **직전 라운드(`review/code/2026/09/21/00_06_01`) maintainability WARNING — `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' })` 3중 복제 — 해소 확인**
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:151-156`(헬퍼 정의), 호출부 `:141`(`findById`) · `:342`(트리거 삭제 `affected` 판정) · `:380`(`triggerId` 없는 방어 분기 판정)
  - `private throwScheduleNotFound(): never { throw new NotFoundException(...); }` 로 추출되어 세 호출부 모두 이 헬퍼를 쓴다. 형제 파일 `triggers.service.ts` 의 `throwTriggerNotFound()` 선례와 이름·형태·배치(첫 사용처 바로 다음)가 일치해 컨벤션 일관성이 좋다. 헬퍼 JSDoc 이 과거 WARNING 을 인용하며 왜 추출했는지 설명하는 점도 이 저장소의 기존 관례(주석에 리뷰 근거 인용)를 그대로 따른다.

- **직전 라운드(`00_37_06`) concurrency WARNING — `affected` truthiness 판정을 `=== 0` 명시 비교로 전환 — 해소 확인**
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:341-342`(트리거 삭제 판정), `:375-380`(방어 분기 판정)
  - 두 판정 모두 `if (affected === 0) this.throwScheduleNotFound();` 형태로, 자매 함수 `codebase/backend/src/modules/triggers/trigger-config-lock.ts:255`(`if (result.affected === 0) return false;`)와 동일한 명시 비교 스타일을 쓴다. `affected` 가 `null`/`undefined`(드라이버 미보고)인 경우를 "없다"로 오판하지 않는다는 근거가 인접 주석(337-340행)에 인용과 함께 남아 있어, 판정 로직과 그 근거 설명이 코드·주석에서 일관된다.

- **`remove()` 메서드의 책임·길이 — 이번 diff 로 새로 늘어난 부채 아님**
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:308-388`(`remove()` 전체, 81줄 중 주석 38줄)
  - BullMQ 해제 → 트리거 락·삭제·`affected` 판정 → catch 에서 404/로깅 분기 → 비밀 정리 → CASCADE 방어적 `remove` 또는 else 분기의 `affected` 판정 → 감사 기록까지 여러 책임을 순차로 담당하지만, 이 구조는 형제 세 서비스(트리거·워크플로·워크스페이스)와 동형이고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "네 자리 공용 락-삭제-로깅 형태" 설계 항목이 이미 추적 중이다. 이 PR 이 새로 만든 부채가 아니라 기존에 defer 된 것과 같은 클래스로 판단해 차단 사유로 잡지 않았다.

- **CHANGELOG.md 의 자기 정정 방식** — `## Unreleased — 동시 DELETE 두 건이 trigger.deleted 감사 행을...` 항목의 "남는 것" 단락에 원문을 남긴 채 "**2026-09-21 해소**" 각주만 덧붙이는 방식(취소선 없음)은 developer 가 자신이 쓴 예고 문장을 정정하는 이 저장소의 통상 관례와 형태가 다르지만(원문이 실제로 "취소선"이 아니라 그대로 남고 뒤에 해소 각주가 이어지는 형태), CHANGELOG 는 스펙 문서가 아니라 이력 기록이라 각주 추가로 이후 독자가 최신 상태를 오인할 위험은 낮다. 코드 유지보수성 관점의 문제는 아니라고 판단해 INFO 로도 올리지 않았다.

- **네이밍·스타일 일관성**: 변수명 `affected`(두 판정 지점 모두), 트랜잭션 매니저 매개변수명 `m`, `.catch((err: unknown) => { if (err instanceof NotFoundException) throw err; ... })` 가드 패턴이 `triggers.service.ts`·`workflows.service.ts`·`workspaces.service.ts` 와 동일한 형태로 일관됨을 재확인.
- 신규/수정 단위 테스트(`schedules.service.spec.ts`)는 기존 "삭제 실패" 테스트의 `Logger.prototype.error` spy + `try/finally` 복원 패턴을 재사용하고, `DeleteResult` 타입 임포트로 mock 반환값의 타입 정확성을 확보해 스타일이 일관적이다.
- 신규 e2e(`schedule-delete-concurrency.e2e-spec.ts`)는 형제 파일 3종과 구조·주석·매직넘버(`1_500`ms 공허성 가드, `60_000`ms 타임아웃)까지 거의 동일하게 미러링되며, 매직넘버는 각각 근거 주석(락 대기 상한 5초 안에서 겹침을 만든다)이 붙어 있어 문제 없음.
- `plan/in-progress/schedule-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `CHANGELOG.md` 는 코드가 아니므로 가독성/네이밍/함수 길이 등 본 관점의 직접 대상에서 제외(이전 두 라운드와 동일 기준 적용).
- `review/code/2026/09/21/00_06_01/**`, `review/code/2026/09/21/00_37_06/**`, `review/consistency/2026/09/20/23_37_12/**` 하위 파일은 이전 리뷰·consistency-check 가 생성한 산출물(비-수기 코드 리포트)이라 유지보수성 관점 대상에서 제외.

## 뮤테이션/저장소 변경 여부

이번 리뷰는 `Read`/`Grep`/`git show`/`git diff` 등 읽기 전용 명령으로만 진행했고 저장소 파일을 수정하지 않았다. `git status --short` 확인 결과 이번 세션의 출력 디렉터리(`review/code/2026/09/21/00_56_52/`) 외 잔여 변경 없음.

## 요약

이 PR 은 세 번째 리뷰 라운드 대상으로, 앞선 두 라운드가 지적한 WARNING(NotFoundException 리터럴 3중 복제, affected truthiness 판정)이 모두 형제 코드베이스의 검증된 패턴(`throwXxxNotFound()` 헬퍼, `=== 0` 명시 비교)으로 정확히 해소됐음을 코드·자매 함수 대조로 재확인했다. `remove()` 의 책임 증가는 기존에 트래커가 추적 중인 이슈이고 이번 diff 로 새로 생긴 부채가 아니다. 신규/수정 테스트는 기존 컨벤션·명명·구조를 충실히 재사용한다. 유지보수성 관점에서 병합을 막을 신규 사유는 없다.

## 위험도

NONE
