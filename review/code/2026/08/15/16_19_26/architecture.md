# 아키텍처(Architecture) Review

## 대상 요약

핵심 변경은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
`finalizeStalledExhausted` 를 `dataSource.transaction()` 으로 원자화한 것 하나다. 나머지
(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` 산출물, `spec/5-system/4-execution-engine.md`)
는 같은 변경의 문서/테스트/리뷰 아티팩트로, 실행 코드 구조에 영향을 주지 않는다.

`Read` 로 `execution-engine.service.ts` 전체를 열어 자매 함수 `cancelParkedExecution`(1023행),
`markWebChatIdleTimeout`(1152행), `finalizeStalledExhausted`(3340행) 세 곳을 직접 대조했다.

## 발견사항

- **[INFO]** 자매 3개 메서드에 걸친 트랜잭션 보일러플레이트 삼중화 (기존 정책상 의도적 defer)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution`(1023행), `markWebChatIdleTimeout`(1152행), `finalizeStalledExhausted`(3340행, 이번 diff 게이트 3340~3402행)
  - 상세: 세 메서드가 "조건부 Execution UPDATE → affected=0 이면 조기 return → 자식 NodeExecution cascade UPDATE → 트랜잭션 커밋 후 best-effort emit/cleanup" 구조를 클로저 캡처 변수(`cancelled`/`finalized`, `cancelledDurationMs`/`stalledDurationMs`)까지 포함해 거의 동일하게 반복한다. 재사용 가능한 추상화(예: "조건부 2-테이블 원자 종결" 헬퍼) 후보이지만, 이번 diff 는 세 번째 사례를 자매 패턴에 맞춰 정합화한 것뿐이라 그 자체로 새 결함은 아니다.
  - 제안: `plan/in-progress/eia-stalled-atomicity.md` §범위 밖 에 "관용구 헬퍼 추출"이 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 이미 등재돼 있고 이번 PR 에서 의도적으로 배제됐음을 확인했다 — 별도 조치 불요, 현행 defer 유지가 타당(넓은 일괄 편집이 스코프 밖을 건드린 전례가 있는 계열).

- **[INFO]** "자매와 동형" 서술과 실제 에러 핸들링 계약의 미세한 비대칭 (사전 존재, 이번 diff 의 회귀 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution`(1023~1088행, `try{...}catch(err){this.logger.error(...)}` 로 전체를 감쌈), `markWebChatIdleTimeout`(1152~1225행, 동일 구조) vs `finalizeStalledExhausted`(3340~3420행, 함수 전체를 감싸는 try/catch 없음)
  - 상세: JSDoc(3325~3329행)과 plan 문서 모두 세 함수를 "동형"이라 표현하지만, 두 자매는 DB 오류를 메서드 내부에서 흡수해 항상 정상 반환(cancel 은 `void`/`boolean`)하는 반면 `finalizeStalledExhausted` 는 트랜잭션 내부 예외를 그대로 전파한다. 현재는 유일한 호출자 `ExecutionRunProcessor.onFailed`(`queues/execution-run.processor.ts:88`)가 `.catch()` 로 흡수하므로 기능상 안전하지만, 이 메서드의 에러 처리 책임이 호출자에게 위임된 구조이며 이는 이번 diff 가 만든 것이 아니라 diff 이전부터 있던 비대칭이다(트랜잭션 도입 전에도 try/catch 없이 raw await 였다).
  - 제안: 조치 불필요 — 다만 향후 이 메서드에 새 호출자가 추가될 때 예외 처리 계약이 자매와 다르다는 점을 유의해야 한다. JSDoc 의 "자매와 동형" 표현은 트랜잭션 경계/순서에 한정된 것으로 이해하면 정확하다.

- **[INFO]** God-service 규모는 이번 diff 의 원인이 아님 (컨텍스트 기록용)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (전체 8,837줄)
  - 상세: 세 자매 메서드 모두 같은 8천 줄대 서비스 클래스 안에 있고, 리포지토리/트랜잭션 매니저를 직접 다뤄 영속 계층 관심사와 비즈니스 로직(전이 조건, emit, cleanup)이 한 메서드 안에 섞여 있다. 이는 이 코드베이스 전체의 기존 패턴이며 이번 3줄~60줄 규모의 diff 로 인해 악화되거나 개선되지 않았다. 새 위반이 아니므로 이번 리뷰의 액션 대상은 아니다.

## 요약

변경 범위가 좁고(단일 메서드를 이미 확립된 자매 2개의 트랜잭션 패턴에 맞춰 정합화) SOLID/결합도/레이어 책임 관점에서 새로운 위반을 만들지 않는다. `dataSource.transaction` 도입은 오히려 세 자매 함수 간 구조적 일관성을 회복시켜 "부분 커밋으로 자식이 유령 RUNNING 으로 잔류"하는 아키텍처 수준의 불변식 결함(원자성 계약이 세 함수 중 하나만 깨져 있던 상태)을 제거했다. 클로저 캡처 기반 제어 흐름과 트랜잭션 보일러플레이트 삼중화, 그리고 에러 핸들링 계약의 자매 간 미세한 비대칭은 관찰됐지만 모두 pre-existing 이거나 plan 문서에서 의도적으로 defer 된 항목이라 이번 diff 를 막을 사유가 아니다. 순환 의존성·모듈 경계 변경·새 디자인 패턴/안티패턴 도입은 없다.

## 위험도
NONE
