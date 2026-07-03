# 아키텍처(Architecture) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `executeAsync` 의 fire-and-forget `runExecution(...).catch()` 핸들러에 `failFirstSegmentSetup` best-effort 마감 추가 (M-4, 06 concurrency Option B)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대한 단위 테스트 2건 추가

## 발견사항

- **[INFO]** 큐 경로(`runExecutionFromQueue`)와 fire-and-forget 경로(`executeAsync`)의 에러 마감 로직 중복
  - 위치: `execution-engine.service.ts:2835-2858` (`runExecutionFromQueue` catch 블록) vs `execution-engine.service.ts:3383-3406` (`executeAsync` catch 블록)
  - 상세: 두 경로 모두 `this.runExecution(...).catch(...)` → 에러 로깅 → `failFirstSegmentSetup(executionId, err).catch(secondaryErr => ...)` 로그 흡수라는 동일한 3단 패턴을 갖는다. `executeAsync` 쪽만 `releaseExecutionRouting` 호출이 빠진 것이 유일한 차이(sub-workflow 는 routing 미등록이라는 이유가 주석으로 명시돼 있어 의도적임이 명확하다). 이 구조 자체는 두 지점(큐 워커 / fire-and-forget sub-workflow 진입점)에 흩어진 "setup 단계 실패 시 best-effort terminal 마감" 책임을 각자 인라인으로 반복 구현한 것으로, 향후 세 번째 진입점이 생기면 또 복제될 소지가 있다.
  - 제안: 현재 2곳 중복은 아직 추출을 강제할 만한 임계치는 아니라고 판단된다(diff 크기가 작고, 기존 큐 경로 패턴을 그대로 답습해 일관성을 지킨 것이 오히려 장점). 다만 3번째 유사 진입점이 추가될 경우 `private async settleFailedSegment(executionId, err, { releaseRouting }: { releaseRouting: boolean })` 형태의 공통 헬퍼로 추출을 권장한다. 현 시점에서 강제 리팩터링은 불필요 — INFO로 기록만.

- **[INFO]** 예외 흡수(exception swallowing) 계층이 3중으로 중첩
  - 위치: `execution-engine.service.ts:3383-3406`
  - 상세: `runExecution` 자체 실패 → `.catch` → `failFirstSegmentSetup` 내부 try/catch(자체 마킹 실패 흡수, `execution-engine.service.ts:2032-2038`) → 외부 `.catch(secondaryErr => log)`. 이는 "fire-and-forget 컨텍스트에서는 unhandled rejection 을 만들지 않는다"는 명확한 설계 원칙(주석에 근거 명시)에 따른 의도적 계층화이며 안티패턴이 아니다. 다만 실패가 여러 겹으로 로그에만 남고 상위로 전파되지 않는 구조이므로, 모니터링/알림이 로그 기반 관측에 의존하고 있는지(예: 에러 로그 → 알림 파이프라인) 확인이 필요하다는 점만 참고사항으로 남긴다.

- **[INFO]** 테스트의 타입 캐스팅을 통한 private 메서드 spy 방식
  - 위치: `execution-engine.service.spec.ts:40-47` (`M4AsyncFailSubject` 타입 및 `service as unknown as M4AsyncFailSubject`)
  - 상세: private 메서드(`runExecution`, `failFirstSegmentSetup`)를 spy 하기 위해 `as unknown as` 캐스팅을 사용하는 패턴이다. 이는 이미 스펙 파일 전반(`CheckpointSubject`, `M4AsyncFailSubject` 등)에서 반복되는 기존 컨벤션이며, private 구현 세부사항에 대한 화이트박스 테스트라는 트레이드오프를 프로젝트가 이미 수용하고 있다. 신규 위반이 아니라 기존 패턴을 일관되게 따른 것.

## 요약

이번 변경은 sub-workflow 의 fire-and-forget 실행 경로(`executeAsync`)에서 `runExecution` setup 단계 throw 시 execution 이 RUNNING/PENDING 상태로 잔류하는 것을 막기 위해, 이미 큐 경로(`runExecutionFromQueue`)에 존재하던 `failFirstSegmentSetup` best-effort 마감 패턴을 동일하게 이식한 것이다. 새로운 추상화나 인터페이스 변경 없이 기존 헬퍼 메서드(`failFirstSegmentSetup`)를 재사용했고, 계약(같은 실행 종료 보장 시맨틱)을 두 진입점 사이에서 일관되게 유지한 점은 SRP·일관성 측면에서 바람직하다. 유일한 아쉬운 점은 두 catch 블록의 구조가 문자 그대로 복제되어 있다는 것인데, 현재 diff 규모(2곳, 각 20줄 내외)에서는 공통 헬퍼 추출을 강제할 정도의 중복은 아니며 프로젝트의 기존 관례(유사 패턴을 명시 주석으로 상호 참조하며 나란히 유지)와도 부합한다. 레이어 경계·순환 의존성·모듈 경계에 영향을 주는 변경은 없으며, 테스트도 기존 스펙 파일의 컨벤션(private 메서드 spy 를 위한 로컬 타입 캐스팅)을 그대로 따른다.

## 위험도

LOW
