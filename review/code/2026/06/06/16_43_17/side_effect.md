# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts (테스트 추가)

- **[INFO]** 신규 `describe` 블록 두 개(`processFormResumeTurn — 4 branches`, `SUMMARY W3/W5/W6/W7`)가 각각 독립적인 NestJS `TestingModule`(`service2`, `service3`)을 생성한다.
  - 위치: diff +36~+453, +463~+835
  - 상세: 지역 변수(`service2`, `service3`, `mockExecRepo2`, `mockNodeExecRepo2` 등)가 describe 스코프 내에 선언되어 최상위의 `service`/`resolvedService` mutable 변수와 공유되지 않는다. `afterEach(() => jest.restoreAllMocks())`가 spy를 자동 정리한다.

- **[WARNING]** W5·W6·W7 테스트가 `svc.executionRepository.findOneBy`, `svc.nodeExecutionRepository.findOne`, `svc.nodeRepository.findOneBy`, `svc.workflowRepository.findOne`, `svc.executionNodeLogRepository.find` 등을 `jest.spyOn`이 아닌 직접 프로퍼티 재할당(`=`)으로 교체한다.
  - 위치: diff +703~+710 (W5), +749~+781 (W6), +803~+811 (W7)
  - 상세: 직접 재할당은 `jest.restoreAllMocks()`의 자동 복원 범위 밖이다. `service3`는 W3/W5/W6/W7이 공유하는 단일 인스턴스이므로 각 테스트가 순차 실행되는 현재 구성에서는 문제없지만, `smallRepo` 단일 인스턴스를 Execution·NodeExecution 두 레포 토큰에 동시 등록하기 때문에 어느 테스트의 재할당이 다른 테스트에서 관측될 수 있다. 각 테스트 본문이 독립적으로 재설정하므로 현재 순서에서는 오염이 발생하지 않는다.
  - 제안: `jest.spyOn(svc.executionRepository, 'findOneBy').mockResolvedValueOnce(...)` 패턴으로 교체하면 `restoreAllMocks()`가 자동 정리를 보장한다.

- **[INFO]** `makeContext()` 헬퍼가 `as unknown as FormResumeSubject` 캐스팅으로 private `contextService`에 접근한다.
  - 위치: diff +254~+277
  - 상세: API 변경 시 컴파일 타임 오류 없이 런타임 오류로만 감지된다. 기존 테스트 전반에서 확립된 패턴이므로 현행 유지가 허용 수준이다.

- **[INFO]** W7 테스트에서 `errorSpy.mockRestore()`를 수동 호출하는데 `afterEach` 의 `jest.restoreAllMocks()`가 이미 복원하므로 중복이다.
  - 위치: diff +831~+832
  - 상세: 무해하지만 스타일 불일치.

---

### 파일 2: execution-engine.service.ts (프로덕션 코드 변경)

- **[INFO]** 로그 메시지 변경: `"Rehydration launched (drive detached)"` → `"Rehydration completed (drive awaited)"`.
  - 위치: diff -1880/+1881 (`rehydrateAndResume` 내부)
  - 상세: 로그 문자열만 변경. 로직 변화 없음. 외부 모니터링·알람 시스템이 이 문자열 패턴을 키로 사용한다면 알람 누락이 발생할 수 있다.
  - 제안: 운영 로그 쿼리(Datadog/CloudWatch 등)에서 해당 문자열 패턴을 사용하는지 확인 권장.

- **[WARNING]** `failFirstSegmentSetup` 호출에 `.catch()` 래핑을 추가해 2차 오류를 `logger.error`만으로 흡수한다.
  - 위치: diff +2903~+2913 (`runExecutionFromQueue` catch 블록)
  - 상세: 기존에는 `failFirstSegmentSetup`이 throw하면 BullMQ worker로 예외가 전파되어 job 자동 재시도가 촉발됐다. 변경 후에는 2차 오류가 삼켜지므로 BullMQ double-exec 재시도가 발생하지 않는다. 트레이드오프로, `failFirstSegmentSetup`이 실패하면 Execution 행이 FAILED로 마킹되지 못하고 PENDING/RUNNING 상태로 잔류할 수 있다. 기존 `recoverStuckExecutions`(30분 heartbeat 타임아웃)가 이를 정기 수습하고, `logger.error`로 운영 관측이 가능하다. W7 단위 테스트로 명시적으로 검증된다.
  - 제안: 현 설계 수용 가능. 단, `failFirstSegmentSetup` 이중 실패 빈도를 메트릭으로 관측하고, 가능하다면 이차 실패 시 별도 best-effort DB update(execution status → FAILED 직접 UPDATE)를 고려할 것.

---

### 파일 3: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** plan 문서 체크박스 및 차수 메모 갱신.
  - 상세: `[ ]` → `[x]` 완료 표시 업데이트. plan 파일은 작업 추적 전용이며 시스템 런타임에 영향 없음.

---

### 파일 4~6: review/code/2026/06/06/15_45_59/ (리뷰 산출물 신규 생성)

- **[INFO]** `RESOLUTION.md`, `_resolution_log.md`, `_resolution_state.json` 신규 추가.
  - 상세: 프로젝트 규약 허용 경로(`review/code/**`)에 국한되며 시스템 동작에 영향 없음.

---

## 요약

이번 변경에서 부작용 관점으로 주목할 사항은 두 가지다. 첫째, `runExecutionFromQueue`에서 `failFirstSegmentSetup`의 2차 오류를 `.catch(logger.error)`로 흡수하는 프로덕션 변경은 BullMQ double-exec 재시도 방지를 위한 의도된 트레이드오프로, Execution 행이 FAILED로 마킹되지 못하는 부작용이 있으나 기존 `recoverStuckExecutions`가 주기적으로 수습하므로 허용 가능한 수준이다. 둘째, 신규 테스트 코드에서 `service3` 공유 인스턴스의 레포지토리 필드를 직접 프로퍼티 재할당으로 교체하는 패턴이 `restoreAllMocks()`의 자동 복원 범위를 벗어나 있으나, 각 테스트가 독립적으로 재설정하므로 현재 실행 순서에서는 오염이 발생하지 않는다. 전역 변수 신규 도입·파일시스템 예기치 않은 조작·환경 변수 조작·의도치 않은 네트워크 호출은 없다.

## 위험도

LOW
