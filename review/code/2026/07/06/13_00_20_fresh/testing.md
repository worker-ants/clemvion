# Testing 리뷰 — fresh (resolution 후)

대상: 스케줄 triggerId 필터 dead-end 테스트 추가 + swagger example
Diff: `git diff origin/main...HEAD` (3 commits, HEAD=8fa32a939)

## 직전 requirement INFO 검증 결과 — PASS (non-vacuous 확인)

- 신규 테스트 `"keeps the reset link visible even when the filter yields no schedules (no dead-end)"`
  (`codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:602-615`)는
  fault-injection 으로 실제 확인 결과 **non-vacuous**.
- `codebase/frontend/src/app/(main)/schedules/page.tsx:972`의 배너 렌더 조건은
  `focusTriggerId && viewMode === "list"` 로, `EmptyState`(`schedules.length === 0`,
  line 999)와 **독립**적이다. 배너 조건에 `schedules.length > 0`을 실험적으로 추가해
  EmptyState 처럼 종속시킨 뒤 대상 테스트 파일을 재실행하니, 신규 dead-end 테스트만
  단독으로 fail(22 passed / 1 failed)했고 나머지 22개는 영향받지 않았다. 즉 이 테스트는
  실제로 "빈 결과여도 배너가 사라지면 안 된다"는 회귀를 잡아낸다. 실험 후
  `git checkout --`로 즉시 원복, `git status --short` clean 확인.
- 원본 코드 기준 재실행: FE 23/23 passed, backend(`schedules.service.spec.ts`) 11/11 passed.
  (`../../node_modules/.bin/vitest run "src/app/(main)/schedules/__tests__/schedules-page.test.tsx"`,
  cwd=`codebase/frontend`; `../../node_modules/.bin/jest schedules.service.spec.ts`,
  cwd=`codebase/backend`)

## 발견사항

특별한 결함 없음. 이번 커밋(`8fa32a939`)은 이전 리뷰의 requirement INFO(빈 결과 dead-end
커버리지 누락)를 정확히 해소하는 테스트 1건과 swagger example 문서 보강만 포함하며,
회귀·격리·가독성 문제는 발견되지 않았다.

참고(결함 아님, 관찰):

- **[INFO]** 신규 테스트 5건(triggerId 전송/미전송, reset link 노출/비노출, dead-end)이
  모두 동일 `mockSchedulesResponse` + `renderPage()` 헬퍼를 사용해 서로 완전히 독립적으로
  실행 가능함을 확인(`currentSearchParams`를 각 `it` 블록 시작에서 재설정, 공유 상태 없음).
  격리 측면에서 문제 없음.
  - 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:577-628`
- **[INFO]** backend `schedules.service.spec.ts`의 신규 `findAll triggerId filter` describe
  블록은 QueryBuilder를 `mockReturnThis()` 체이닝 스텁으로 대체하는 기존 파일 관례를 그대로
  따름. `andWhere` 호출 인자(`'t.id = :triggerId'`)를 직접 단언하여 SQL 절 존재 여부를
  검증하는 방식으로, 이 레벨의 unit test 목적(서비스 로직이 올바른 조건을 QueryBuilder에
  전달하는지)에 적절. 실제 필터링 동작(빈 트리거 스케줄 제외 등)은 상위 e2e/통합 계층 몫으로
  넘겨도 되는 범위이며 별도 갭으로 보지 않음.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:150-186`
- **[INFO]** swagger `example` 필드(`3fa85f64-5717-4562-b3fc-2c963f66afa6`, RFC 4122 예시
  UUID)는 문서용 메타데이터로 테스트 대상이 아님. 관련 `@IsUUID()` 검증은 기존
  class-validator 파이프라인에 위임되며 별도 유닛 필요 없음.
  - 위치: `codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts:16-23`

## 요약

이번 fresh 리뷰의 핵심 검증 대상인 "dead-end 테스트가 실제로 배너 렌더 조건의 독립성을
검증하는가"는 fault-injection 실험으로 명확히 확인되었다(non-vacuous, 원복 완료). FE
23/23, backend 11/11 전체 통과. 테스트 격리·가독성·mock 적절성 모두 이 diff 범위에서
문제 없이 기존 컨벤션을 따르고 있어 추가 조치가 필요한 발견사항이 없다.

## 위험도

NONE
