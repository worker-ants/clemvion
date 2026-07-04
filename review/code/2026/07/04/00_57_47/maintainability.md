# 유지보수성(Maintainability) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (recoverStuckExecutions 전환 + 신규 `reclaimStuckRunningExecution` / `redriveStuckExecution` / `driveStuckRedrive` / `runStuckRecoveryScan`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규/개정 unit)
- `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` (`skipExecutedNodes` 옵션 추가)
- `codebase/backend/src/modules/executions/executions.controller.ts` (`_test/recover-stuck-executions` 엔드포인트 신설)
- `codebase/backend/test/execution-crash-redrive.e2e-spec.ts` (신규 e2e)
- plan/spec 문서(주로 서술 갱신 — 코드 유지보수성 관점에서는 참고용)

## 발견사항

- **[INFO]** `redriveStuckExecution` 내부에 try 안에 또 try(routing 재등록 best-effort)가 중첩되어 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `redriveStuckExecution` (약 L2735-2758, "§7.5 / CCH-AD-05 — slow-path 재개 시 outbound routing context 재등록" 블록)
  - 상세: outer try(setup 전체) 안에 inner try(routing 재등록, best-effort)가 중첩돼 가독성이 약간 떨어진다. 다만 이 패턴은 `driveResumeAwaited`(case A) 경로에서도 동일하게 쓰이는 기존 컨벤션이며, best-effort 실패를 전체 재구동 실패와 분리하려는 의도가 명확히 주석돼 있어 새로 도입된 문제는 아니다.
  - 제안: 우선순위 낮음. 원한다면 routing 재등록을 별도 private helper(`registerRoutingBestEffort(execution)`)로 추출해 두 호출부(driveResumeAwaited/redriveStuckExecution)가 공유하면 중복 코멘트·중첩이 줄어든다. 필수 아님.

- **[INFO]** `redriveStuckExecution`/`driveStuckRedrive` 분리 경계가 다소 미묘 — 어디까지가 "setup"이고 어디부터가 "drive"인지 이름만으로는 완전히 직관적이지 않음
  - 위치: `execution-engine.service.ts` `redriveStuckExecution` → `driveStuckRedrive` 호출 관계
  - 상세: `redriveStuckExecution`(로드+가드+routing+rehydrate+graph 빌드) → `driveStuckRedrive`(reachability seed+dispatch+완결). 이 분리 자체는 실패 지점별로 다른 에러 처리(전자는 RESUME_* terminal, 후자는 finalizeResumedExecutionOutcome)를 두기 위한 의도된 구조이며 JSDoc에 그 경계가 명확히 설명되어 있다. 다만 이름(`redrive` vs `drive`)이 유사해 첫 접근 시 구분이 쉽지 않다.
  - 제안: 선택적으로 `redriveStuckExecution` → `setupAndDriveStuckRedrive`, `driveStuckRedrive` → `driveStuckRedriveGraph` 등으로 조금 더 명시적인 이름을 고려할 수 있으나, 파일 전체가 이미 `driveResumeAwaited`/`driveResumeFrame`/`driveCallStackResume` 등 유사한 `drive*` 네이밍 계열을 쓰고 있어 이 diff만 리네이밍하면 오히려 일관성이 깨질 수 있다. 현행 유지 권장.

- **[INFO]** `recoverStuckExecutions`의 fire-and-forget 루프(`void this.redriveStuckExecution(...).catch(...)`) 자체는 간결하지만, 각 실행에 대한 재구동 실패가 로그 외에는 관찰되지 않음
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions` 본문, `for (const executionId of reclaimedIds) { void this.redriveStuckExecution(...).catch(...) }`
  - 상세: 이는 설계상 의도(§8 active-running 한도로 최종 종결, boot-only 트리거로 rate-limit)이며 spec draft에도 명시되어 있다. 유지보수성 관점에서는 문제라기보다 향후 관측성(PR4)에서 메트릭·알림을 추가할 자리로 남겨둔 것으로 보인다. 별도 조치 불요.

- **[INFO]** e2e 테스트(`execution-crash-redrive.e2e-spec.ts`) 폴링 로직이 다른 e2e 파일들의 `poll` 헬퍼와 유사한 패턴을 다시 구현
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts` L588-610 `poll`, L747-761 인라인 폴링 루프(codeB row 대기)
  - 상세: 같은 파일 안에 `poll` 헬퍼가 있음에도 불구하고 codeB row 완료를 기다리는 두 번째 폴링 루프(L748-761)는 별도 인라인 while 루프로 작성되어 있다. 판정 대상이 execution status가 아니라 DB row 라서 헬퍼 시그니처가 안 맞기 때문으로 보이나, 코멘트에 그 이유가 이미 명확히 설명돼 있다("Execution status='completed' 는 원 실행·재구동 양쪽에서 나타나 모호 ... 판정 신호로 쓰지 않는다").
  - 제안: 선택적으로 "DB row 조건 충족까지 폴링"하는 제네릭 헬퍼(`pollDb(queryFn, predicate)`)를 추출하면 향후 유사 e2e에서도 재사용 가능하나, 이번 diff 하나만 보면 중복이라기보다 다른 관심사(HTTP status vs DB row)를 위한 별도 구현이라 문제 삼기 애매하다.

- **[INFO]** `execution-engine.service.ts` 파일 자체가 7,281줄에 달하는 대형 파일(god-class)이며, 이번 diff로 3개의 새 private 메서드(`reclaimStuckRunningExecution`/`redriveStuckExecution`/`driveStuckRedrive`)와 1개의 public 메서드(`runStuckRecoveryScan`)가 추가되어 계속 커지고 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 전체
  - 상세: 이 문제는 diff 이전부터 존재하는 구조적 이슈이며(과거 C-1/M-1 리팩터로 일부 타입을 별도 모듈로 분리한 이력이 `graph-dispatch.types.ts` 헤더 주석에 남아있음), 이번 변경이 새로 야기한 것은 아니다. 신규 메서드들은 각각 책임이 좁고(re-claim / setup / drive) 문서화가 잘 되어 있어 개별 함수 단위로는 문제가 없다.
  - 제안: 이번 PR 범위 밖. 프로젝트 메모리에 따르면 리팩터 백로그(M-계열)가 이미 이런 구조적 이슈를 추적 중이므로 별도 항목 재발견은 불필요.

## 요약

이번 변경은 `recoverStuckExecutions`의 "일괄 FAILED 마킹" 로직을 "원자 re-claim + rehydration 기반 재구동"으로 교체하는 상당히 민감한 동시성/상태전이 변경이지만, 전반적으로 유지보수성이 높은 수준으로 작성되었다. 신규 메서드(`reclaimStuckRunningExecution`, `redriveStuckExecution`, `driveStuckRedrive`)는 각각 책임이 명확히 분리되어 있고, 기존 case A(`driveResumeAwaited`) 경로와 공유 가능한 부분(`finalizeResumedExecutionOutcome`, `finalizeRehydrationCleanup`, `markExecutionCancelled`, `runNodeDispatchLoop`)을 재사용해 불필요한 중복을 최소화했다. 매직 넘버는 기존 상수(`STUCK_RECOVERY_STALE_MS`)를 재사용했고, 새 옵션 필드(`skipExecutedNodes`)는 파일의 기존 JSDoc 컨벤션(각 필드에 "누가/언제/왜" 를 명시)을 그대로 따른다. Unit test는 기존 spec 파일의 스타일(사설 메서드에 대한 `as unknown as {...}` 캐스팅 후 spy)을 일관되게 유지했고, e2e 테스트도 시나리오·검증 근거를 상세한 한국어 주석으로 남겨 왜 특정 판정 신호를 쓰거나 쓰지 않는지(`Execution status`가 모호한 이유 등) 추론 과정을 그대로 보존하고 있어 후속 유지보수자가 이해하기 쉽다. 발견된 사항은 전부 INFO 수준으로, 기존 컨벤션과 일치하거나 사소한 개선 여지에 그친다.

## 위험도

NONE
