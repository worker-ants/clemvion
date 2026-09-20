# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — cron/timezone 재계산 happy-path 단위 테스트 2건 신설 (핵심 리뷰 대상)
- `plan/in-progress/sched-recalc-unit.md` — 신규 plan 문서. 코드가 아니므로 함수 길이·중첩·매직넘버 등 통상 기준은 해당 없음. 서술 자체는 명확하고 근거·비대상·테스트 판별 기준이 잘 구조화되어 있어 특기할 문제 없음.
- `review/consistency/2026/09/20/14_01_01/*` (SUMMARY.md, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md` 등) — 다른 checker sub-agent 가 생성한 감사 산출물이며 손으로 작성한 애플리케이션/테스트 코드가 아니다. 가독성·네이밍·함수 길이 등 코드 유지보수성 기준을 적용할 대상이 아니라고 판단해 별도 발견사항을 내지 않았다.

## 검증 방법 안내 준수

가설 확인을 위해 저장소를 뮤테이션하지 않았다. `Read`/`grep` 으로만 원본 파일(`schedules.service.spec.ts`, `schedules.service.ts`)을 직접 열어 줄 번호와 시그니처를 대조했다. `git status --short` 로도 리뷰 도중 저장소에 아무 변경도 남기지 않았음을 확인했다(뮤테이션 없음이므로 원복 불필요).

### 발견사항

- **[WARNING]** 신설한 `scheduleRow()` 팩토리를 바로 위 기존 테스트에 적용하지 않아 동일 리터럴이 중복
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:386`-`394` (기존 테스트, 인라인 리터럴) / 같은 파일 `427`-`438` (신설 `scheduleRow()` 팩토리)
  - 상세: 새로 추가된 `scheduleRow(overrides)` 팩토리(427-438행)는 바로 위에 있는 기존 테스트 `[방어 분기] 다음 실행 계산이 비면 nextRunAt 을 null 로 명시 대입한다`(384-417행)가 386-394행에서 인라인으로 만드는 것과 **완전히 동일한 7개 필드**(`id`, `workspaceId`, `isActive`, `cronExpression`, `timezone`, `triggerId`, `nextRunAt`)를 갖는 객체를 만든다. 새 팩토리가 이 기존 테스트를 리팩터링하는 데 쓰이지 않아, 두 벌의 동일한 fixture 정의가 몇 줄 간격으로 공존한다. 이후 기본 스케줄 shape 이 바뀌면(예: 필드 추가) 두 곳을 따로 갱신해야 하는 drift 위험이 생긴다.
  - 제안: 기존 테스트의 인라인 리터럴도 `scheduleRow()` 호출로 교체해 단일 정의로 합친다.

- **[INFO]** `computeNextRuns` spy 캐스트 boilerplate 가 3중 중복 + 타입이 실제 시그니처와 불일치
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:447`-`452`, `482`-`487` (신설) / `400`-`404` (기존, 동일 패턴)
  - 상세: `jest.spyOn(service as unknown as { computeNextRuns: () => string[] }, 'computeNextRuns')` 형태의 캐스트가 이제 파일 안에 3곳(기존 1 + 신설 2) 존재한다. 게다가 이 타입 주석은 `computeNextRuns` 를 인자 없는(nullary) 함수로 선언하지만, 실제 프로덕션 시그니처는 `computeNextRuns(cronExpression, timezone, count)` 3개 인자를 받는다(`schedules.service.ts:407`, 호출부 187/267/360/373행 모두 3-인자). `unknown` 캐스트라 컴파일 에러는 안 나지만, 이 타입을 읽는 사람은 실제 시그니처를 오해할 수 있고, 이번 커밋이 그 부정확한 패턴을 두 번 더 복제했다.
  - 제안: 공용 헬퍼(예: `spyOnComputeNextRuns(returnValue: string[])`)로 추출해 캐스트를 한 곳에 모으고, 인자 시그니처를 실제와 맞춘다(`(cron: string, tz: string, count: number) => string[]`).

- **[INFO]** `saved` 캡처 패턴이 신규 테스트 2건에서 또 복제
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:441`, `443`-`446` 및 `476`, `478`-`481` (신설) / `385`, `395`-`398` (기존, 동일 패턴)
  - 상세: `const saved: Schedule[] = []; ... scheduleRepo.save.mockImplementation((sch) => { saved.push(sch as Schedule); return Promise.resolve(sch as Schedule); });` 4줄짜리 블록이 이제 파일 안에서 최소 3회(기존 1 + 신설 2) 그대로 반복된다. 두 신규 테스트는 이 패턴을 그대로 복사해 붙여넣었다.
  - 제안: `function captureSaved(): { saved: Schedule[] }` 류의 공용 헬퍼로 추출하면 세 테스트가 한 줄로 줄고, 캡처 로직 변경 시 한 곳만 고치면 된다. 다만 이 파일 전반의 스타일(테스트별로 mock 을 명시적으로 다시 세팅하는 것을 선호)과 상충할 수 있어 WARNING 이 아닌 INFO 로 남긴다.

- **[INFO]** 신규 테스트가 이름과 실제 내용이 어긋난 거대 `describe` 블록에 그대로 편입됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:248` (`describe('create — timezone fallback (§2.2)', ...)` 시작) ~ `817` (해당 블록 종료). 신설 팩토리·테스트는 `427`-`503`.
  - 상세: `describe('create — timezone fallback (§2.2)', ...)` 라는 이름은 "create 시의 timezone fallback"만을 가리키지만, 실제로는 create/update(cron·timezone 재계산 포함)/remove 테스트 전체(약 570줄)를 담은 단일 블록이다. 최상위 `describe('SchedulesService.runNow', ...)`(17행) 도 마찬가지로 파일 전체 내용(findAll/create/update/remove)과 이름이 맞지 않는다 — 둘 다 이번 diff 이전부터 있던 기존 구조다. 이번 커밋은 그 블록을 개선(예: `update` 전용 `describe('update — cron/timezone 재계산', ...)` 서브블록 신설)할 기회가 있었지만, 새 테스트 2건을 기존의 이름이 안 맞는 블록에 그대로 추가해 문제를 답습했다.
  - 제안: 필수는 아니나, 다음에 이 영역을 만질 때 `update()` 전용 하위 `describe` 로 분리하면 파일 탐색성이 개선된다. 지금 당장 이 diff 를 막을 사안은 아니다.

- **[INFO]** 신규 JSDoc 주석이 함수가 아니라 그 아래 테스트들의 배경을 설명 — 주석과 대상의 물리적 결합이 모호
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:419`-`426`
  - 상세: 419-426행의 JSDoc 은 "위 방어 분기의 정상 쪽" 및 e2e 연말 창 결함(`schedule-cron-flake.md`)에 대한 배경을 설명하는데, 물리적으로는 바로 아래의 `scheduleRow()` **팩토리 함수** 선언(427행)에 붙어 있다. 실제로 이 주석이 설명하는 대상은 그 아래 두 `it(...)` 테스트(440행, 475행)이지 `scheduleRow` 함수 자체(필드 오버라이드 동작 등)가 아니다. 함수 바로 위 JSDoc 은 관례적으로 그 함수를 설명한다고 기대되므로, 읽는 사람이 "이 주석이 무엇을 설명하는가"를 한 번 더 확인해야 한다.
  - 제안: 배경 설명은 `scheduleRow()` 위가 아니라 첫 번째 `it(...)` 바로 위로 옮기거나, `describe` 블록 주석으로 승격한다.

### 요약

이번 diff 의 핵심은 순수 테스트 추가(`schedules.service.spec.ts`)이며 프로덕션 로직 변경이 없다. 새 테스트 2건 각각은 함수 길이·중첩 깊이·순환 복잡도 면에서 무리가 없고, 목적(연말 시각-의존 e2e 갭을 결정적 단위 테스트로 닫는다)과 판별 기준(무엇으로 호출됐는지까지 검증)이 doc 주석에 명확히 근거와 함께 남아 있어 가독성 자체는 좋다. 다만 새로 도입한 `scheduleRow()` 팩토리를 바로 옆의 동형 리터럴에 적용하지 않아 중복이 남았고(WARNING), `computeNextRuns` spy 캐스트·`saved` 캡처 boilerplate 가 각각 한 번씩 더 복제되었으며, 새 테스트가 이름-내용이 어긋난 거대 `describe` 블록을 개선 없이 답습했다(모두 INFO). 전체적으로 기능적 결함이나 구조적 위험은 없고, 사소한 중복·조직화 여지만 남은 수준이다.

### 위험도

LOW
