# 유지보수성(Maintainability) 리뷰 — sched-recalc-unit (2라운드)

## 리뷰 범위

- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — cron/timezone 재계산 happy-path 단위 테스트 2건 + 「둘 다 거짓」 대조군 테스트 1건, 공용 `scheduleRow()` 팩토리 (핵심 리뷰 대상)
- `plan/in-progress/sched-recalc-unit.md` — plan 문서. 코드가 아니므로 함수 길이·중첩·매직넘버 등은 해당 없음. 서술 자체는 명확
- `review/code/2026/09/20/14_22_46/*`, `review/consistency/2026/09/20/14_01_01/*` — 이전 라운드의 리뷰/감사 산출물(자동 생성 markdown·json). 손으로 작성한 코드가 아니므로 코드 유지보수성 기준(가독성·네이밍·함수 길이 등)을 적용할 대상이 아니라고 판단해 별도 발견사항을 내지 않음

## 검증 방법 안내 준수

가설 확인을 위해 저장소를 뮤테이션하지 않았다. `Read`/`grep`/`sed -n`으로만 원본 파일(`schedules.service.spec.ts`, `schedules.service.ts`)을 직접 열어 현재 줄 번호·시그니처를 대조했다. 아무것도 쓰지 않았으므로 원복 불필요 — `git status --short` 로 저장소가 clean 함을 별도로 확인하지는 않았지만 Read/Bash(grep, sed, wc) 외의 파일 조작 명령을 실행하지 않았다.

## 1라운드 지적사항 처분 확인

- **WARNING (scheduleRow 팩토리 미적용 중복)** — **해소 확인.** 직접 파일을 열어 대조한 결과, 기존 `[방어 분기]` 테스트(`schedules.service.spec.ts:400` 부근)가 이제 `scheduleRow()` 호출로 바뀌어 있고, 인라인 7필드 리터럴은 사라졌다. 팩토리 정의가 파일 전체에서 유일한 schedule row shape 정의다.
- **INFO (JSDoc 위치가 함수 위에 있어 대상이 모호)** — **부수적으로 해소.** 팩토리를 테스트들 위로 옮기면서 "위 방어 분기의 정상 쪽" JSDoc(현재 게이트 425-432)이 이제 그것이 설명하는 첫 `it(...)`(433) 바로 위에 온다. 더 이상 팩토리 함수와 혼동될 배치가 아니다.
- **INFO (spy 캐스트 3중 중복 + nullary 타입 불일치), (saved 캡처 3중 중복), (describe 이름-내용 불일치)** — 아래에서 갱신된 줄 번호·개수로 재확인.

### 발견사항

- **[INFO]** `computeNextRuns` spy 캐스트 boilerplate 가 이번 라운드에서 **4중 중복**으로 늘었고, 여전히 실제 시그니처와 불일치
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:408`, `442`, `477`, `513` (각각 `jest.spyOn(service as unknown as { computeNextRuns: () => string[] }, 'computeNextRuns')` 형태)
  - 상세: 3라운드 대조군 테스트(「cron·timezone 을 안 바꾸면...」)가 같은 nullary 캐스트 패턴을 한 번 더 복제해, 이제 파일 안에 동일한 타입 주석이 4곳 존재한다(`update` describe 안에서만). 실제 프로덕션 시그니처는 `computeNextRuns(cronExpression: string, timezone: string, count: number)` 3-인자다(`schedules.service.ts:407` 선언, `187`/`267`/`360`/`373` 호출부 전부 3-인자 확인). `unknown` 경유 캐스트라 컴파일 에러는 없지만, 이 타입 주석만 읽으면 인자 없는 함수로 오해할 수 있다.
  - 제안: `spyOnComputeNextRuns(returnValue?: string[])` 류의 공용 헬퍼로 추출해 캐스트를 한 곳에 모으고, 인자 시그니처를 `(cron: string, tz: string, count: number) => string[]` 로 맞춘다. 이번 라운드에서 중복이 3→4로 늘었으므로 다음에 이 파일을 만질 때는 우선순위를 올릴 만하다.

- **[INFO]** `saved` 캡처 4줄 블록이 이제 파일 안에서 **4회** 그대로 반복
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:399-404`, `434-439`, `469-474`, `504-511` (전부 `const saved: Schedule[] = []; ... scheduleRepo.save.mockImplementation((sch) => { saved.push(sch as Schedule); return Promise.resolve(sch as Schedule); });`)
  - 상세: 신규 대조군 테스트가 동일 패턴을 그대로 복사해, 4개의 `update` 테스트 전부가 이 boilerplate 를 반복한다. 하나를 고치면(예: 여러 건 저장 지원) 4곳을 함께 바꿔야 한다.
  - 제안: `function captureSaved(): { saved: Schedule[] }` 헬퍼로 추출. 다만 이 파일 전반이 mock 을 테스트별로 명시적으로 다시 세팅하는 스타일을 선호하므로 WARNING 은 아니고 INFO 유지.

- **[INFO]** 「cron 변경」·「timezone 변경」 두 happy-path 테스트가 구조적으로 거의 동일 — `it.each` 파라미터화 여지
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:433-462` (cron) 와 `468-496` (timezone)
  - 상세: 두 테스트는 변경하는 DTO 필드(`cronExpression` vs `timezone`)와 기대 인자·반환값만 다르고 나머지 30줄 가까운 구조(찾기 mock, save mock, spy 설정, `update()` 호출, 두 개의 `expect`)가 라인 단위로 동일하다. `it.each`(`table`) 로 묶으면 "cron 항"과 "timezone 항" 각각의 판별력은 그대로 유지하면서 라인 수를 줄일 수 있다.
  - 제안: 강제 아님 — plan 자체가 "두 항이 각각 표면이라 따로 본다" 는 의도를 명시했고, 테스트 이름이 개별로 남아 실패 시 어느 분기가 깨졌는지 즉시 드러나는 것도 장점이라 현재 형태를 유지할 근거가 있다. 참고로만 남긴다.

- **[INFO]** 대조군 테스트의 `before` 리터럴이 `scheduleRow()` 기본값과 우연히 동일 — 의도가 주석 없이 드러나지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:502-507` (`const before = new Date('2020-01-01T00:00:00Z'); ... scheduleRow({ nextRunAt: before })`)
  - 상세: `scheduleRow()` 의 `nextRunAt` 기본값도 정확히 `new Date('2020-01-01T00:00:00Z')` 다(`schedules.service.spec.ts:379`). 즉 이 테스트의 `overrides` 전달은 현재 기본값과 같은 값을 다시 대입하는 것이라 겉보기엔 no-op 처럼 보인다. 아마 "팩토리 기본값이 나중에 바뀌어도 이 테스트가 검증하는 `before` 값은 고정돼야 한다"는 의도(암묵적 결합을 끊는 방어적 명시)로 보이지만, 그 의도를 알려주는 주석이 없어 다음 사람이 "왜 굳이 같은 값을 다시 넘기나"를 오해하거나 실수로 지울 수 있다.
  - 제안: 한 줄 주석("팩토리 기본값과 우연히 같지만, 기본값이 바뀌어도 이 테스트의 전제가 안 깨지도록 명시적으로 고정")을 붙이거나, 오히려 반대로 팩토리 기본값에 의존하지 않음을 강조하고 싶다면 기본값과 다른 임의의 날짜를 써서 결합을 시각적으로도 끊는 방법도 있다.

- **[INFO]** 신규 테스트가 이름-내용이 어긋난 거대 `describe` 블록에 계속 편입 — 라운드를 거치며 블록이 더 커짐
  - 위치: `describe('create — timezone fallback (§2.2)', ...)` 시작 `schedules.service.spec.ts:248` ~ 파일 끝(현재 842줄). 최상위 `describe('SchedulesService.runNow', ...)` 도 동일(17행).
  - 상세: 1라운드에서 이미 지적된 기존 구조 문제이며, 이번 라운드에서 테스트 3건이 추가되며 블록이 더 길어졌다(1라운드 시점 ~570줄 → 현재 파일 전체 842줄). `create — timezone fallback` 이라는 이름은 create 시 timezone 처리만 가리키지만 실제로는 create/update(cron·timezone 재계산 포함)/remove 전체를 담고 있다.
  - 제안: 필수는 아님 — 이번 diff 를 막을 사안이 아니라는 1라운드 판단 유지. 다음에 `update()` 영역을 크게 만질 때 `describe('update — cron/timezone 재계산', ...)` 같은 하위 블록으로 분리하면 파일 탐색성이 개선된다.

### 요약

1라운드에서 지적한 WARNING(신설 `scheduleRow()` 팩토리를 기존 테스트에 미적용해 리터럴 중복)은 커밋 `ae060b266` 에서 실제로 해소됐음을 코드 대조로 확인했고, 그 수정의 부수 효과로 JSDoc 배치 관련 INFO 도 함께 정리됐다. 같은 커밋에서 재계산 게이트의 "둘 다 거짓" 대조군 테스트가 새로 추가되어 판별력이 개선됐지만, 그 테스트도 기존 두 happy-path 테스트와 동일한 spy 캐스트·`saved` 캡처 boilerplate 를 그대로 복제해 각 반복 횟수가 3→4로 늘었다(둘 다 기존에 INFO 로 남아 있던 항목이며 이번 라운드가 그 규모만 키웠다). 새로 발견한 항목은 두 happy-path 테스트 간 구조적 중복(파라미터화 여지)과 대조군의 `before` 리터럴이 팩토리 기본값과 우연히 일치해 의도가 주석 없이 드러나지 않는다는 점으로, 둘 다 기능적 결함이 아닌 가독성 수준의 INFO 다. 프로덕션 로직 변경이 전혀 없고 남은 지적이 전부 INFO 수준의 중복·명명 이슈뿐이라, 이번 diff 를 막을 유지보수성 사유는 없다.

### 위험도

LOW
