# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[WARNING]** 테스트 모듈 setup 코드의 대규모 중복
  - 위치: diff 추가 라인 56-208 (describe `processFormResumeTurn`) vs. 495-625 (describe `SUMMARY W3/...`, inner `beforeEach`)
  - 상세: 두 describe 블록이 각각 독립 `beforeEach` 안에서 거의 동일한 NestJS `Test.createTestingModule` + `providers` 배열(20여 개 provider)을 복사·붙여넣기 식으로 반복한다. 차이는 `wfId`, repo mock 일부 기본값, 그리고 `ContinuationBusService` stub 상세(전체 `beforeEach`의 원본은 `subscribe`/`close`/`on` 차이 정도)에 불과하다. 코드 6~700줄 이상을 차지하는 이 중복은 향후 provider 추가/삭제 시 두 곳을 동시에 갱신해야 하는 드리프트 위험을 낳는다.
  - 제안: `buildTestModule(overrides?)` 헬퍼 팩토리를 `__test__/` 또는 해당 spec 파일 상단에 추출해 공통 provider 목록을 한 곳에서 관리한다. 각 describe는 오버라이드만 전달하도록 리팩터링한다.

- **[WARNING]** `service2` / `service3` 와 같이 숫자 접미어를 붙인 인스턴스 네이밍
  - 위치: diff 라인 44, 493 (`let service2`, `let service3`; `mockExecRepo2`, `mockNodeExecRepo2` 등)
  - 상세: 같은 서비스 타입의 인스턴스를 숫자 접미어로 구분하는 것은 각 describe가 왜 별도 인스턴스를 필요로 하는지를 드러내지 못한다. 리더가 `service2`가 `service`와 어떤 측면에서 다른지 파악하기 어렵다.
  - 제안: `formResumeService`, `callStackResumeService` 처럼 기능·시나리오를 표현하는 이름을 사용하거나, 위 헬퍼 팩토리 추출 후 각 describe 내부 스코프에만 `service`로 선언한다.

- **[WARNING]** `as unknown as SomeType` 캐스트 타입이 describe 안에 산재
  - 위치: diff 라인 236-252 (`FormResumeSubject`), 467-491 (`DriveW3Subject`), 693-700 (`W5Subject`), 729-743 (`W6Subject`), 795-799 (`W7Subject`)
  - 상세: private 메서드 접근을 위해 매번 인라인 타입 리터럴을 선언하고 `as unknown as X` 캐스트를 반복한다. 같은 서비스의 private surface를 여러 describe가 각자 다시 선언하므로 시그니처 변경 시 여러 타입 선언을 동시 수정해야 한다.
  - 제안: 서비스의 full private surface를 표현하는 단일 `ExecutionEngineServicePrivate` 타입을 spec 파일 상단(또는 `__test__/` 유틸)에 선언하고 공유한다. 각 테스트는 필요한 메서드만 픽업한다.

- **[INFO]** `subject()` 헬퍼 함수가 단일 describe 내에서만 사용됨에도 외부 참조처럼 보이는 화살표 함수 패턴
  - 위치: diff 라인 254 (`const subject = () => service2 as unknown as FormResumeSubject`)
  - 상세: 이 패턴은 각 `it` 블록에서 최신 `service2` 참조를 얻기 위한 의도이나, 같은 describe 내 다른 블록들은 `subject()`를 사용하지 않고 직접 캐스트하는 등 일관성이 없다.
  - 제안: describe 내 `it` 블록이 모두 동일한 캐스트 방식을 사용하도록 통일한다.

- **[INFO]** 매직 문자열 `'waiting_for_input'`, `'form_node'`, `'ai_agent'` 등이 테스트 객체에 하드코딩
  - 위치: diff 라인 221, 257-258, 669, 766 등
  - 상세: `NodeExecutionStatus.WAITING_FOR_INPUT` 같은 enum이 이미 존재하지만 일부 위치에서 string 리터럴을 직접 사용하고 있다. 타입 시스템 보호를 받지 못해 enum 값 변경 시 silent bug가 될 수 있다.
  - 제안: 모든 status 값은 `ExecutionStatus.*` / `NodeExecutionStatus.*` enum 상수를 사용하고, 노드 타입 문자열은 상수로 추출하거나 기존 상수가 있으면 그것을 사용한다.

- **[INFO]** W5/W6/W7 테스트가 `describe('W3 — ...')` 의 `beforeEach`가 만든 `service3`을 재사용
  - 위치: diff 라인 691, 729, 801 — "service3 재사용" 주석 포함
  - 상세: 무관한 시나리오(W5/W6/W7)가 W3 describe의 `beforeEach` 의존성을 암묵적으로 공유한다. W3 setup이 변경되면 W5~W7 테스트가 함께 영향을 받는다. 테스트 isolation이 낮다.
  - 제안: W5/W6/W7을 독립 describe 블록으로 분리하거나, 공통 헬퍼를 통해 명시적으로 모듈을 생성한다.

---

### 파일 2: execution-engine.service.ts

- **[INFO]** 인라인 `.catch()` 콜백 내 에러 메시지 구성 로직이 다소 장황함
  - 위치: diff 라인 +1906 ~ +1915 (`failFirstSegmentSetup secondary error` catch 블록)
  - 상세: `secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr)` 패턴은 코드베이스 내 여러 곳에서 반복될 가능성이 높다. 현재는 단일 위치이므로 임계 수준은 아니지만, 중복 누적 시 유틸 함수 추출이 유용하다.
  - 제안: 코드베이스에 `toErrorMessage(err: unknown): string` 같은 공유 유틸이 있다면 재사용한다. 없다면 현 수준은 수용 가능하다.

- **[INFO]** 주석 업데이트는 명확하고 의도가 잘 드러남 (개선 사항 없음)
  - 위치: diff 라인 +1877~+1896 (log 메시지 및 catch 설명 주석)
  - 상세: "fire-and-forget → await" 전환 사실을 주석과 로그 메시지 모두에서 일관되게 반영한 것은 긍정적이다.

---

### 파일 3: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** plan 문서 자체의 유지보수성은 양호함
  - 위치: 전체 diff
  - 상세: 완료 항목을 `[x]`로 명확히 표시하고, commit hash·PR 번호·날짜를 함께 기록하는 패턴이 일관성 있게 유지되고 있다. 잔여 항목도 "본 PR 범위 밖" / "비차단" 등의 분류가 명시되어 추적성이 좋다.

---

## 요약

이번 변경의 핵심 대상인 `execution-engine.service.ts` 수정(2곳)은 간결하고 의도가 명확하며 유지보수성 측면에서 특별한 우려가 없다. 반면 `execution-engine.service.spec.ts` 의 신규 테스트 블록들은 NestJS 테스트 모듈 셋업 코드를 describe마다 전량 복사하는 구조, 숫자 접미어 기반 인스턴스 네이밍, 서로 다른 describe 사이의 암묵적 `beforeEach` 공유 등으로 향후 provider 추가나 시그니처 변경 시 여러 곳을 동시에 손대야 하는 유지보수 부담을 가중시킨다. 이 패턴은 이번 PR에서 처음 도입된 것이 아니라 기존 spec 파일에 점진적으로 누적되어 온 것이지만, 이번 추가분이 그 규모를 크게 키웠다. 중복 모듈 빌더 추출과 공유 private-surface 타입 선언이 가장 효과적인 개선책이다. plan 문서는 변경 사항 추적 측면에서 우수하다.

## 위험도

MEDIUM
