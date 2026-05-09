### 발견사항

- **[WARNING]** plan 문서의 작업 항목이 완료됐음에도 체크박스가 미갱신
  - 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 작업 항목 1·2
  - 상세: 항목 1(`ContinuationBusService 방어적 가드`)과 항목 2(`recoverStuckExecutions 호출 시점 이동`)는 이미 구현됐지만 `[ ]` 로 남아 있음. CLAUDE.md 의 "작업 단계가 끝날 때마다 plan 문서를 갱신한다" 규약에 어긋남. 현재 상태로는 TEST WORKFLOW·REVIEW WORKFLOW 진행자가 어느 항목이 실제로 완료됐는지 판단할 수 없음.
  - 제안: 구현이 완료된 항목 1·2를 `[x]`로 전환하고 해당 커밋 SHA 또는 날짜를 주석으로 남길 것.

- **[WARNING]** `releaseLock` 미초기화 가드 로그 레벨 불일치
  - 위치: `continuation-bus.service.ts` — `releaseLock` 가드 블록
  - 상세: `publish` 와 `acquireLock` 의 미초기화 가드는 `logger.error`를 사용하지만 `releaseLock`만 `logger.warn`을 사용함. 동일 조건(publisher 미초기화)에서 다른 심각도로 기록되면 운영 알림·로그 필터 기준이 분산됨. `releaseLock`이 `recoverStuckExecutions`의 finally 블록에서 호출될 때는 `acquireLock`이 이미 `false`를 반환해 early-return 하므로 실제로 이 가드에 도달하는 경우는 외부 코드 오용 뿐이며, 이는 `error` 수준이 적절함.
  - 제안: `releaseLock` 가드도 `logger.error`로 통일하거나, 의도적인 차이라면 코드 주석으로 사유를 명시할 것.

- **[INFO]** plan 문서 외부 절대경로 참조
  - 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 1행
  - 상세: `[/Users/gehrig/.claude/plans/sorted-shimmying-wirth.md]` 경로는 특정 개발자의 로컬 파일시스템 절대경로임. 다른 팀원 환경에서는 링크가 깨짐.
  - 제안: 해당 파일이 저장소 내에 있다면 상대경로로, 저장소 외부라면 링크 제거 후 내용을 plan 내에 직접 요약할 것.

- **[INFO]** `onModuleInit` 동기화 동작 변경 미검증
  - 위치: `execution-engine.service.spec.ts` — `onModuleInit` 테스트
  - 상세: 테스트는 `service.onModuleInit()`을 호출하고 `acquireLock`이 호출되지 않음만 검증함. `registerHandlers()`와 `registerContinuationHandlers()` 가 여전히 호출되는지는 검증하지 않음. 이 메서드들이 `onModuleInit` 에서 실행되어야 한다는 기존 요구사항의 회귀 가드가 없음.
  - 제안: `onModuleInit` 테스트에 `mockBus.on`이 5회 호출됐는지(`registerContinuationHandlers` 호출 여부) 검증 추가 권고.

---

### 요약

이번 변경은 NestJS 모듈 초기화 순서에서 비롯된 `publisher` 미초기화 race를 두 계층에서 방어함 — `ContinuationBusService`의 세 메서드에 방어적 가드를 추가하고, `ExecutionEngineService`의 `recoverStuckExecutions` 호출 시점을 `onModuleInit`에서 `onApplicationBootstrap`으로 이동함. 요구사항(부팅 시 race 제거, 운영 가시성 보장, 분산 환경 안전성 유지)은 모두 충족됨. 주요 지적은 구현 완료 항목이 plan 문서에 반영되지 않은 프로세스 불일치, `releaseLock` 가드의 로그 레벨 불일치, 그리고 `onModuleInit` 테스트의 회귀 가드 부재이며, 모두 경미한 수준임.

### 위험도

**LOW**